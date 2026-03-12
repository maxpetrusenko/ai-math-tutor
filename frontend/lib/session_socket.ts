import { createSessionMetrics, snapshotSessionMetrics, toLatencyMetrics } from "./session_metrics";
import { appendSessionActivityLog } from "./session_activity_log";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/session/session_types";
import { getCurrentFirebaseIdToken } from "./firebase_auth";
import { getFirebaseAuthClient } from "./firebase_client";
import type { PersistedLessonThread } from "./lesson_thread_store";

const SESSION_SOCKET_LOG_PREFIX = "[session_socket]";
const TURN_TIMEOUT_MS = 15_000;
const QUIET_SEND_TYPES = new Set<string>();
const QUIET_RECEIVE_TYPES = new Set([
  "audio.received",
  "session.restored",
  "session.started",
  "state.changed",
]);
const QUIET_ACTIVITY_TYPES = new Set([
  "audio.chunk",
  "audio.received",
  "tts.audio",
]);
const LOG_DEDUPE_WINDOW_MS = 2_000;
const MAX_BUFFERED_AMOUNT_BYTES = 256_000;
const SOCKET_DRAIN_POLL_MS = 16;
const CONNECT_TIMEOUT_MS = 5_000;
const LEGACY_SOCKET_AUTH_ERROR = "unknown message type: session.authenticate";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSessionId(sessionId: string | null | undefined): string {
  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  if (normalized && normalized !== "undefined" && normalized !== "null") {
    return normalized;
  }

  return generateSessionId();
}

let lastLogSignature = "";
let lastLogTsMs = 0;

function shouldSkipSessionLog(level: "info" | "warn" | "error", event: string, details: Record<string, unknown>) {
  const payloadType = typeof details.type === "string" ? details.type : "";
  if (event === "send" && QUIET_SEND_TYPES.has(payloadType)) {
    return true;
  }
  if (event === "receive" && QUIET_RECEIVE_TYPES.has(payloadType)) {
    return true;
  }

  const signature = JSON.stringify({ details, event, level });
  const now = Date.now();
  if (signature === lastLogSignature && now - lastLogTsMs < LOG_DEDUPE_WINDOW_MS) {
    return true;
  }

  lastLogSignature = signature;
  lastLogTsMs = now;
  return false;
}

function logSessionInfo(event: string, details: Record<string, unknown>) {
  if (!QUIET_ACTIVITY_TYPES.has(typeof details.type === "string" ? details.type : "")) {
    appendSessionActivityLog({
      event,
      level: "info",
      metadata: details,
      scope: "session-socket",
      summary: `${event} ${typeof details.type === "string" ? details.type : "event"}`,
    });
  }
  if (shouldSkipSessionLog("info", event, details)) {
    return;
  }
  console.info(SESSION_SOCKET_LOG_PREFIX, event, details);
}

function logSessionWarn(event: string, details: Record<string, unknown>) {
  appendSessionActivityLog({
    event,
    level: "warn",
    metadata: details,
    scope: "session-socket",
    summary: `${event} ${typeof details.type === "string" ? details.type : "event"}`,
  });
  if (shouldSkipSessionLog("warn", event, details)) {
    return;
  }
  console.warn(SESSION_SOCKET_LOG_PREFIX, event, details);
}

function logSessionError(event: string, details: Record<string, unknown>) {
  appendSessionActivityLog({
    event,
    level: "error",
    metadata: details,
    scope: "session-socket",
    summary: `${event} ${typeof details.type === "string" ? details.type : "event"}`,
  });
  if (shouldSkipSessionLog("error", event, details)) {
    return;
  }
  console.error(SESSION_SOCKET_LOG_PREFIX, event, details);
}

function summarizePayload(payload: Record<string, unknown>) {
  const summary: Record<string, unknown> = {
    type: typeof payload.type === "string" ? payload.type : "unknown",
  };

  if (payload.type === "audio.chunk") {
    const bytesBase64 = typeof payload.bytes_b64 === "string" ? payload.bytes_b64 : "";
    summary.sequence = payload.sequence;
    summary.size = payload.size;
    summary.mimeType = payload.mime_type;
    summary.tsMs = payload.ts_ms;
    summary.bytesBase64Length = bytesBase64.length;
  }

  if (payload.type === "speech.end") {
    summary.subject = payload.subject;
    summary.gradeBand = payload.grade_band;
    summary.llmProvider = payload.llm_provider;
    summary.llmModel = payload.llm_model;
    summary.studentProfileKeys =
      payload.student_profile && typeof payload.student_profile === "object"
        ? Object.keys(payload.student_profile as Record<string, unknown>)
        : [];
    summary.textLength = typeof payload.text === "string" ? payload.text.length : 0;
    summary.transcribeOnly = payload.transcribe_only;
    summary.ttsProvider = payload.tts_provider;
    summary.ttsModel = payload.tts_model;
    summary.tsMs = payload.ts_ms;
  }

  if (payload.type === "session.error") {
    summary.detail = payload.detail ?? payload.message;
  }

  if (payload.type === "transcript.partial_stable" || payload.type === "transcript.final") {
    const text = typeof payload.text === "string" ? payload.text : "";
    summary.text = text;
    summary.textLength = text.length;
  }

  if (payload.type === "tutor.text.committed") {
    const text = typeof payload.text === "string" ? payload.text : "";
    summary.text = text;
    summary.textLength = text.length;
  }

  if (payload.type === "tts.audio") {
    summary.isFinal = payload.is_final;
    summary.audioBase64Length = typeof payload.audio_b64 === "string" ? payload.audio_b64.length : 0;
    summary.audioMimeType = payload.audio_mime_type;
    summary.timestampCount = Array.isArray(payload.timestamps) ? payload.timestamps.length : 0;
  }

  if (payload.type === "latency.metric") {
    summary.name = payload.name;
    summary.tsMs = payload.ts_ms;
    summary.turnId = payload.turn_id;
  }

  if (payload.type === "transcript.final" || payload.type === "transcript.partial_stable") {
    summary.text = typeof payload.text === "string" ? payload.text.slice(0, 120) : "";
    summary.textLength = typeof payload.text === "string" ? payload.text.length : 0;
  }

  return summary;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function isFirebaseSocketAuthRequired() {
  const value = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH
    : undefined;
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function combineAudioChunksForTranscription(audioChunks: NonNullable<TutorTurnRequest["audioChunks"]>) {
  if (audioChunks.length <= 1) {
    return audioChunks;
  }

  const payloadChunks = audioChunks.filter((chunk) => typeof chunk.bytesBase64 === "string" && chunk.bytesBase64.length > 0);
  if (payloadChunks.length !== audioChunks.length) {
    return audioChunks;
  }

  const mimeTypes = new Set(payloadChunks.map((chunk) => chunk.mimeType ?? ""));
  if (mimeTypes.size > 1) {
    return audioChunks;
  }

  const byteParts = payloadChunks.map((chunk) => base64ToBytes(chunk.bytesBase64 as string));
  const totalBytes = byteParts.reduce((sum, chunk) => sum + chunk.length, 0);
  const combinedBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of byteParts) {
    combinedBytes.set(part, offset);
    offset += part.length;
  }

  return [
    {
      sequence: 1,
      size: totalBytes,
      bytesBase64: bytesToBase64(combinedBytes),
      mimeType: payloadChunks[0]?.mimeType,
    },
  ];
}

type TurnPhase = "stt" | "llm" | "tts";

function resolveInitialTurnPhase(request: TutorTurnRequest): TurnPhase {
  const hasAudioBytes = (request.audioChunks ?? []).some((chunk) => Boolean(chunk.bytesBase64));
  return hasAudioBytes ? "stt" : "llm";
}

function describeTurnPhase(phase: TurnPhase) {
  switch (phase) {
    case "stt":
      return "speech transcription";
    case "tts":
      return "speech synthesis";
    case "llm":
    default:
      return "tutor response generation";
  }
}

function summarizeCloseEvent(event?: CloseEvent) {
  return {
    code: event?.code,
    reason: event?.reason ?? "",
    wasClean: event?.wasClean ?? false,
  };
}

function resolveBufferedAmount(socket: WebSocket) {
  const bufferedAmount = (socket as WebSocket & { bufferedAmount?: number }).bufferedAmount;
  return typeof bufferedAmount === "number" ? bufferedAmount : 0;
}

export function createSessionSocketTransport(): SessionTransport {
  const baseWsUrl =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL
      ? process.env.NEXT_PUBLIC_SESSION_WS_URL
      : "ws://localhost:8000/ws/session";
  let currentSessionId = normalizeSessionId(generateSessionId());

  let socket: WebSocket | null = null;
  let socketSessionId: string | null = null;
  let activeTurn:
      | {
        resolve: (result: TutorTurnResult) => void;
        reject: (error: Error) => void;
        metrics: ReturnType<typeof createSessionMetrics>;
        onTranscriptFinal?: (text: string) => void;
        transcript: string;
        tutorText: string;
        state: string;
        phase: TurnPhase;
        turnId?: string;
        timestamps: TutorTurnResult["timestamps"];
        audioSegments: NonNullable<TutorTurnResult["audioSegments"]>;
        pendingSegmentTexts: string[];
        timeoutId: ReturnType<typeof setTimeout> | null;
      }
    | null = null;
  let pendingTranscription:
    | {
        onTranscriptUpdate?: (text: string) => void;
        reject: (error: Error) => void;
        resolve: (transcript: string) => void;
        timeoutId: ReturnType<typeof setTimeout> | null;
      }
    | null = null;
  let pendingReset:
    | {
        resolve: () => void;
        reject: (error: Error) => void;
      }
    | null = null;
  let pendingRestore:
    | {
        resolve: () => void;
        reject: (error: Error) => void;
      }
    | null = null;
  let pendingConnect:
    | {
        resolve: (socket: WebSocket) => void;
        reject: (error: Error) => void;
        timeoutId: ReturnType<typeof setTimeout> | null;
      }
    | null = null;
  let sendQueue = Promise.resolve();

  const ensureCurrentSessionId = () => {
    currentSessionId = normalizeSessionId(currentSessionId);
    return currentSessionId;
  };

  const buildWsUrl = async () => {
    const url = new URL(baseWsUrl);
    url.searchParams.set("session_id", ensureCurrentSessionId());
    const authRequired = isFirebaseSocketAuthRequired();
    const idToken = authRequired ? await getCurrentFirebaseIdToken() : null;
    if (authRequired && !idToken && getFirebaseAuthClient()) {
      throw new Error("Firebase sign-in required");
    }
    return { authToken: idToken, url: url.toString() };
  };

  const rejectPendingConnect = (error: Error) => {
    if (!pendingConnect) {
      return;
    }
    if (pendingConnect.timeoutId) {
      clearTimeout(pendingConnect.timeoutId);
    }
    pendingConnect.reject(error);
    pendingConnect = null;
  };

  const failActiveTurn = (message: string) => {
    if (!activeTurn) {
      return;
    }

    if (activeTurn.timeoutId) {
      clearTimeout(activeTurn.timeoutId);
    }
    activeTurn.reject(new Error(message));
    activeTurn = null;
  };

  const handleMessage = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as Record<string, unknown>;
    logSessionInfo("receive", summarizePayload(payload));
    if (payload.type === "session.reset") {
      pendingReset?.resolve();
      pendingReset = null;
      activeTurn = null;
      return;
    }
    if (payload.type === "session.restored") {
      pendingRestore?.resolve();
      pendingRestore = null;
      return;
    }
    if (payload.type === "session.error") {
      const message = String(payload.detail ?? payload.message ?? "Session error");
      if (message === LEGACY_SOCKET_AUTH_ERROR) {
        logSessionWarn("receive.ignored", {
          detail: message,
          sessionId: ensureCurrentSessionId(),
          reason: "legacy-backend-auth-message",
        });
        return;
      }
      if (pendingConnect) {
        rejectPendingConnect(new Error(message));
        return;
      }
      if (pendingReset) {
        pendingReset.reject(new Error(message));
        pendingReset = null;
        return;
      }
      if (pendingRestore) {
        pendingRestore.reject(new Error(message));
        pendingRestore = null;
        return;
      }
      if (pendingTranscription) {
        if (pendingTranscription.timeoutId) {
          clearTimeout(pendingTranscription.timeoutId);
        }
        pendingTranscription.reject(new Error(message));
        pendingTranscription = null;
        return;
      }
      failActiveTurn(message);
      return;
    }
    if (payload.type === "session.started" && pendingConnect) {
      if (pendingConnect.timeoutId) {
        clearTimeout(pendingConnect.timeoutId);
      }
      pendingConnect.resolve(socket as WebSocket);
      pendingConnect = null;
      return;
    }
    if (pendingTranscription) {
      if (payload.type === "transcript.partial_stable" || payload.type === "transcript.final") {
        const transcriptText = String(payload.text ?? "");
        pendingTranscription.onTranscriptUpdate?.(transcriptText);
        if (payload.type === "transcript.final") {
          if (pendingTranscription.timeoutId) {
            clearTimeout(pendingTranscription.timeoutId);
          }
          pendingTranscription.resolve(transcriptText);
          pendingTranscription = null;
        }
      }
      return;
    }
    if (!activeTurn) {
      return;
    }
    if (payload.type === "transcript.final") {
      activeTurn.transcript = String(payload.text);
      activeTurn.phase = "llm";
      activeTurn.onTranscriptFinal?.(activeTurn.transcript);
      activeTurn.metrics.mark({ name: "stt_final", tsMs: performance.now() });
    }
    if (payload.type === "state.changed") {
      activeTurn.state = String(payload.state);
    }
    if (payload.type === "tutor.turn.started") {
      activeTurn.turnId = String(payload.turn_id ?? "");
    }
    if (payload.type === "tutor.text.committed") {
      const committedText = String(payload.text);
      activeTurn.phase = "tts";
      activeTurn.tutorText = appendCommittedText(activeTurn.tutorText, committedText);
      activeTurn.pendingSegmentTexts.push(committedText);
      activeTurn.metrics.mark({ name: "llm_first_token", tsMs: performance.now() });
    }
    if (payload.type === "tts.audio") {
      const incomingTimestamps = ((payload.timestamps as Array<Record<string, unknown>>) ?? []).map((item) => ({
        word: String(item.word),
        startMs: Number(item.start_ms),
        endMs: Number(item.end_ms),
      }));
      activeTurn.timestamps = appendTimestamps(
        activeTurn.timestamps,
        incomingTimestamps
      );
      const segmentText = activeTurn.pendingSegmentTexts.shift() ?? "";
      activeTurn.audioSegments.push({
        text: appendCommittedText("", segmentText),
        audioBase64: typeof payload.audio_b64 === "string" ? payload.audio_b64 : undefined,
        audioMimeType: typeof payload.audio_mime_type === "string" ? payload.audio_mime_type : undefined,
        durationMs: incomingTimestamps.at(-1)?.endMs,
      });
      activeTurn.metrics.mark({ name: "tts_first_audio", tsMs: performance.now() });
      if (payload.is_final === false) {
        return;
      }

      activeTurn.resolve({
        turnId: activeTurn.turnId,
        transcript: activeTurn.transcript,
        tutorText: activeTurn.tutorText,
        state: activeTurn.state,
        latency: toLatencyMetrics(activeTurn.metrics),
        metricEvents: snapshotSessionMetrics(activeTurn.metrics),
        timestamps: activeTurn.timestamps,
        audioSegments: activeTurn.audioSegments,
      });
      if (activeTurn.timeoutId) {
        clearTimeout(activeTurn.timeoutId);
      }
      activeTurn = null;
    }
  };

  const waitForSocketDrain = async (connectedSocket: WebSocket) => {
    while (connectedSocket.readyState === WebSocket.OPEN && resolveBufferedAmount(connectedSocket) > MAX_BUFFERED_AMOUNT_BYTES) {
      await new Promise((resolve) => setTimeout(resolve, SOCKET_DRAIN_POLL_MS));
    }

    if (connectedSocket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket connection closed");
    }
  };

  const queueSocketPayload = (connectedSocket: WebSocket, payload: Record<string, unknown>) => {
    sendQueue = sendQueue
      .catch(() => undefined)
      .then(async () => {
        await waitForSocketDrain(connectedSocket);
        logSessionInfo("send", { sessionId: ensureCurrentSessionId(), ...summarizePayload(payload) });
        connectedSocket.send(JSON.stringify(payload));
      });
    return sendQueue;
  };

  const ensureSocket = async () => {
    if (socket?.readyState === WebSocket.OPEN && socketSessionId === currentSessionId) {
      return socket;
    }

    return new Promise<WebSocket>((resolve, reject) => {
      void buildWsUrl()
        .then(({ authToken, url }) => {
          const sessionId = ensureCurrentSessionId();
          const nextSocket = new WebSocket(url);
          let didOpen = false;
          let preOpenFailureLogged = false;

          nextSocket.onopen = () => {
            didOpen = true;
            socket = nextSocket;
            socketSessionId = ensureCurrentSessionId();
            logSessionInfo("open", { sessionId: socketSessionId, url: nextSocket.url });
            pendingConnect = {
              resolve,
              reject,
              timeoutId: setTimeout(() => {
                rejectPendingConnect(new Error("WebSocket session start timed out"));
              }, CONNECT_TIMEOUT_MS),
            };
            if (authToken) {
              void queueSocketPayload(nextSocket, {
                type: "session.authenticate",
                auth_token: authToken,
              }).catch((error) => {
                rejectPendingConnect(error instanceof Error ? error : new Error("WebSocket authentication failed"));
              });
            }
          };

          nextSocket.onmessage = handleMessage;
          nextSocket.onerror = () => {
            const errorDetails = {
              readyState: nextSocket.readyState,
              sessionId,
              url: nextSocket.url,
            };
            if (!didOpen) {
              preOpenFailureLogged = true;
              logSessionWarn("connect.failed", errorDetails);
              reject(new Error("WebSocket connection failed"));
              return;
            } else {
              logSessionError("error", errorDetails);
            }
            if (socket === nextSocket) {
              rejectPendingConnect(new Error("WebSocket connection failed"));
              if (pendingTranscription) {
                if (pendingTranscription.timeoutId) {
                  clearTimeout(pendingTranscription.timeoutId);
                }
                pendingTranscription.reject(new Error("WebSocket connection failed"));
                pendingTranscription = null;
              }
              failActiveTurn("WebSocket connection failed");
              pendingReset?.reject(new Error("WebSocket connection failed"));
              pendingReset = null;
              pendingRestore?.reject(new Error("WebSocket connection failed"));
              pendingRestore = null;
              return;
            }

          };
          nextSocket.onclose = (event) => {
            if (preOpenFailureLogged && !didOpen) {
              socket = null;
              socketSessionId = null;
              return;
            }
            logSessionWarn("close", {
              sessionId: ensureCurrentSessionId(),
              url: nextSocket.url,
              ...summarizeCloseEvent(event),
            });
            if (socket === nextSocket) {
              rejectPendingConnect(new Error("WebSocket connection closed"));
              if (pendingTranscription) {
                if (pendingTranscription.timeoutId) {
                  clearTimeout(pendingTranscription.timeoutId);
                }
                pendingTranscription.reject(new Error("WebSocket connection closed"));
                pendingTranscription = null;
              }
              failActiveTurn("WebSocket connection closed");
              pendingReset?.reject(new Error("WebSocket connection closed"));
              pendingReset = null;
              pendingRestore?.reject(new Error("WebSocket connection closed"));
              pendingRestore = null;
            }
            socket = null;
            socketSessionId = null;
            sendQueue = Promise.resolve();
          };
        })
        .catch((error) => {
          reject(error instanceof Error ? error : new Error("WebSocket URL build failed"));
        });
    });
  };

  const closeSocket = () => {
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // ignore close errors during session switches
      }
    }
    socket = null;
    socketSessionId = null;
    rejectPendingConnect(new Error("WebSocket connection closed"));
    sendQueue = Promise.resolve();
  };

  const restoreSession = async (thread: PersistedLessonThread) => {
    const connectedSocket = await ensureSocket();
    return new Promise<void>((resolve, reject) => {
      pendingRestore = { resolve, reject };
      const payload = {
        type: "session.restore",
        grade_band: thread.gradeBand,
        history: thread.conversation.flatMap((turn) => [
          { role: "user", content: turn.transcript },
          { role: "assistant", content: turn.tutorText },
        ]),
        student_profile: thread.preference ? { preference: thread.preference } : {},
        subject: thread.subject,
      };
      void queueSocketPayload(connectedSocket, payload).catch((error) => {
        pendingRestore?.reject(error instanceof Error ? error : new Error("Session restore failed"));
        pendingRestore = null;
      });
    });
  };

  return {
    async connect() {
      try {
        await ensureSocket();
        return "connected";
      } catch {
        return "failed";
      }
    },
    async runTurn(request: TutorTurnRequest) {
      if (typeof window === "undefined") {
        return {
          transcript: request.studentText,
          tutorText: "Nice start. What should you isolate first?",
          state: "speaking",
          latency: {
            speechEndToSttFinalMs: 120,
            sttFinalToLlmFirstTokenMs: 140,
            llmFirstTokenToTtsFirstAudioMs: 110,
          },
          timestamps: [{ word: "Nice", startMs: 0, endMs: 100 }],
        };
      }

      const connectedSocket = await ensureSocket();
      if (activeTurn) {
        throw new Error("A tutor turn is already in progress");
      }

      return new Promise<TutorTurnResult>((resolve, reject) => {
        activeTurn = {
          resolve,
          reject,
          metrics: createSessionMetrics(),
          onTranscriptFinal: request.onTranscriptFinal,
          transcript: request.studentText,
          tutorText: "",
          state: "thinking",
          phase: resolveInitialTurnPhase(request),
          timestamps: [],
          audioSegments: [],
          pendingSegmentTexts: [],
          timeoutId: null,
        };
        activeTurn.timeoutId = setTimeout(() => {
          const phase = activeTurn?.phase ?? resolveInitialTurnPhase(request);
          logSessionWarn("turn.timeout", {
            phase,
            phaseLabel: describeTurnPhase(phase),
            sessionId: ensureCurrentSessionId(),
            timeoutMs: TURN_TIMEOUT_MS,
            transcriptLength: activeTurn?.transcript.length ?? 0,
          });
          failActiveTurn(`Tutor turn timed out during ${describeTurnPhase(phase)}`);
        }, TURN_TIMEOUT_MS);

        void (async () => {
          for (const chunk of request.audioChunks ?? [{ sequence: 1, size: 320 }]) {
            await queueSocketPayload(connectedSocket, {
              type: "audio.chunk",
              sequence: chunk.sequence,
              size: chunk.size,
              bytes_b64: chunk.bytesBase64,
              mime_type: chunk.mimeType,
              ts_ms: Date.now(),
            });
          }
          activeTurn?.metrics.mark({ name: "speech_end", tsMs: performance.now() });
          await queueSocketPayload(connectedSocket, {
            type: "speech.end",
            ts_ms: Date.now(),
            text: request.studentText,
            subject: request.subject,
            grade_band: request.gradeBand,
            llm_provider: request.llmProvider,
            llm_model: request.llmModel,
            student_profile: request.studentProfile,
            tts_provider: request.ttsProvider,
            tts_model: request.ttsModel,
          });
        })().catch((error) => {
          failActiveTurn(error instanceof Error ? error.message : "WebSocket send failed");
        });
      });
    },
    async transcribeAudio(request: TutorTurnRequest) {
      if (typeof window === "undefined") {
        return request.studentText;
      }

      const connectedSocket = await ensureSocket();
      if (activeTurn || pendingTranscription) {
        throw new Error("A tutor turn is already in progress");
      }

      return new Promise<string>((resolve, reject) => {
        pendingTranscription = {
          onTranscriptUpdate: request.onTranscriptUpdate,
          reject,
          resolve,
          timeoutId: setTimeout(() => {
            logSessionWarn("turn.timeout", {
              phase: "stt",
              phaseLabel: describeTurnPhase("stt"),
              sessionId: ensureCurrentSessionId(),
              timeoutMs: TURN_TIMEOUT_MS,
              transcriptLength: 0,
            });
            if (pendingTranscription) {
              pendingTranscription.reject(new Error("Tutor turn timed out during speech transcription"));
              pendingTranscription = null;
            }
          }, TURN_TIMEOUT_MS),
        };

        const audioChunks = combineAudioChunksForTranscription(request.audioChunks ?? [{ sequence: 1, size: 320 }]);
        logSessionInfo("transcribe.start", {
          chunkCount: audioChunks.length,
          mimeTypes: Array.from(new Set(audioChunks.map((chunk) => chunk.mimeType).filter(Boolean))),
          sessionId: ensureCurrentSessionId(),
          totalBytes: audioChunks.reduce((sum, chunk) => sum + chunk.size, 0),
          transcribeOnly: true,
        });

        void (async () => {
          for (const chunk of audioChunks) {
            await queueSocketPayload(connectedSocket, {
              type: "audio.chunk",
              sequence: chunk.sequence,
              size: chunk.size,
              bytes_b64: chunk.bytesBase64,
              mime_type: chunk.mimeType,
              ts_ms: Date.now(),
            });
          }
          await queueSocketPayload(connectedSocket, {
            type: "speech.end",
            ts_ms: Date.now(),
            text: request.studentText,
            subject: request.subject,
            grade_band: request.gradeBand,
            student_profile: request.studentProfile,
            transcribe_only: true,
          });
        })().catch((error) => {
          if (pendingTranscription) {
            if (pendingTranscription.timeoutId) {
              clearTimeout(pendingTranscription.timeoutId);
            }
            pendingTranscription.reject(error instanceof Error ? error : new Error("WebSocket send failed"));
            pendingTranscription = null;
          }
        });
      });
    },
    async interrupt() {
      if (pendingTranscription) {
        if (pendingTranscription.timeoutId) {
          clearTimeout(pendingTranscription.timeoutId);
        }
        pendingTranscription.reject(new Error("Tutor turn interrupted"));
        pendingTranscription = null;
      }
      if (socket?.readyState === WebSocket.OPEN) {
        await queueSocketPayload(socket, { type: "interrupt" });
      }
    },
    async reset() {
      const connectedSocket = await ensureSocket();
      if (activeTurn) {
        failActiveTurn("Lesson reset");
      }
      if (pendingTranscription) {
        if (pendingTranscription.timeoutId) {
          clearTimeout(pendingTranscription.timeoutId);
        }
        pendingTranscription.reject(new Error("Lesson reset"));
        pendingTranscription = null;
      }
      return new Promise<void>((resolve, reject) => {
        pendingReset = { resolve, reject };
        void queueSocketPayload(connectedSocket, { type: "session.reset" }).catch((error) => {
          pendingReset?.reject(error instanceof Error ? error : new Error("Session reset failed"));
          pendingReset = null;
        });
      });
    },
    async reportMetric(event) {
      const connectedSocket = await ensureSocket();
      await queueSocketPayload(connectedSocket, {
        type: "latency.metric",
        turn_id: event.turnId,
        name: event.name,
        ts_ms: event.tsMs,
      });
    },
    getSessionId() {
      return ensureCurrentSessionId();
    },
    async switchSession(sessionId, thread) {
      const shouldRestore = Boolean(thread && thread.conversation.length > 0);
      const nextSessionId = normalizeSessionId(sessionId);
      if (nextSessionId === ensureCurrentSessionId() && socket?.readyState === WebSocket.OPEN && !shouldRestore) {
        return;
      }

      if (activeTurn) {
        failActiveTurn("Lesson switched");
      }
      if (pendingTranscription) {
        if (pendingTranscription.timeoutId) {
          clearTimeout(pendingTranscription.timeoutId);
        }
        pendingTranscription.reject(new Error("Lesson switched"));
        pendingTranscription = null;
      }
      pendingReset = null;
      pendingRestore = null;
      currentSessionId = nextSessionId;
      closeSocket();

      if (thread && shouldRestore) {
        await restoreSession(thread);
      }
    },
  };
}

function appendCommittedText(current: string, next: string) {
  const normalizedNext = next.trim();
  if (!normalizedNext) {
    return current;
  }
  if (!current.trim()) {
    return normalizedNext;
  }
  return `${current.trimEnd()} ${normalizedNext}`;
}

function appendTimestamps(
  current: TutorTurnResult["timestamps"],
  incoming: TutorTurnResult["timestamps"]
) {
  if (incoming.length === 0) {
    return current;
  }

  const offsetMs = current.at(-1)?.endMs ?? 0;
  const normalizedIncoming = incoming.map((item) => ({
    ...item,
    startMs: item.startMs + offsetMs,
    endMs: item.endMs + offsetMs,
  }));
  return [...current, ...normalizedIncoming];
}
