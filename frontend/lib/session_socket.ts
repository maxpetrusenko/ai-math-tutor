import { createSessionMetrics, snapshotSessionMetrics, toLatencyMetrics } from "./session_metrics";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/TutorSession";
import { getCurrentFirebaseIdToken } from "./firebase_auth";
import type { PersistedLessonThread } from "./lesson_thread_store";

const SESSION_SOCKET_LOG_PREFIX = "[session_socket]";
const TURN_TIMEOUT_MS = 15_000;
const QUIET_SEND_TYPES = new Set(["audio.chunk"]);
const QUIET_RECEIVE_TYPES = new Set([
  "audio.received",
  "session.started",
  "state.changed",
  "transcript.partial_stable",
  "tutor.text.committed",
  "tts.audio",
]);
const LOG_DEDUPE_WINDOW_MS = 2_000;

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
  if (shouldSkipSessionLog("info", event, details)) {
    return;
  }
  console.info(SESSION_SOCKET_LOG_PREFIX, event, details);
}

function logSessionWarn(event: string, details: Record<string, unknown>) {
  if (shouldSkipSessionLog("warn", event, details)) {
    return;
  }
  console.warn(SESSION_SOCKET_LOG_PREFIX, event, details);
}

function logSessionError(event: string, details: Record<string, unknown>) {
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
    summary.bytesBase64Prefix = bytesBase64.slice(0, 24);
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
    summary.ttsProvider = payload.tts_provider;
    summary.ttsModel = payload.tts_model;
    summary.tsMs = payload.ts_ms;
  }

  if (payload.type === "session.error") {
    summary.detail = payload.detail ?? payload.message;
  }

  if (payload.type === "tts.audio") {
    summary.isFinal = payload.is_final;
    summary.audioBase64Length = typeof payload.audio_b64 === "string" ? payload.audio_b64.length : 0;
    summary.timestampCount = Array.isArray(payload.timestamps) ? payload.timestamps.length : 0;
  }

  if (payload.type === "transcript.final" || payload.type === "transcript.partial_stable") {
    summary.text = typeof payload.text === "string" ? payload.text.slice(0, 120) : "";
    summary.textLength = typeof payload.text === "string" ? payload.text.length : 0;
  }

  return summary;
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
        timestamps: TutorTurnResult["timestamps"];
        audioSegments: NonNullable<TutorTurnResult["audioSegments"]>;
        pendingSegmentTexts: string[];
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

  const ensureCurrentSessionId = () => {
    currentSessionId = normalizeSessionId(currentSessionId);
    return currentSessionId;
  };

  const buildWsUrl = async () => {
    const url = new URL(baseWsUrl);
    url.searchParams.set("session_id", ensureCurrentSessionId());
    const idToken = await getCurrentFirebaseIdToken();
    if (idToken) {
      url.searchParams.set("auth_token", idToken);
    } else {
      url.searchParams.delete("auth_token");
    }
    return url.toString();
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
      failActiveTurn(message);
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

  const ensureSocket = async () => {
    if (socket?.readyState === WebSocket.OPEN && socketSessionId === currentSessionId) {
      return socket;
    }

    return new Promise<WebSocket>((resolve, reject) => {
      void buildWsUrl()
        .then((url) => {
          const sessionId = ensureCurrentSessionId();
          const nextSocket = new WebSocket(url);
          let didOpen = false;
          let preOpenFailureLogged = false;

          nextSocket.onopen = () => {
            didOpen = true;
            socket = nextSocket;
            socketSessionId = ensureCurrentSessionId();
            logSessionInfo("open", { sessionId: socketSessionId, url: nextSocket.url });
            resolve(nextSocket);
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
            } else {
              logSessionError("error", errorDetails);
            }
            if (socket === nextSocket) {
              failActiveTurn("WebSocket connection failed");
              pendingReset?.reject(new Error("WebSocket connection failed"));
              pendingReset = null;
              pendingRestore?.reject(new Error("WebSocket connection failed"));
              pendingRestore = null;
              return;
            }

            reject(new Error("WebSocket connection failed"));
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
              failActiveTurn("WebSocket connection closed");
              pendingReset?.reject(new Error("WebSocket connection closed"));
              pendingReset = null;
              pendingRestore?.reject(new Error("WebSocket connection closed"));
              pendingRestore = null;
            }
            socket = null;
            socketSessionId = null;
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
      logSessionInfo("send", {
        historyLength: thread.conversation.length,
        sessionId: ensureCurrentSessionId(),
        ...summarizePayload(payload),
      });
      connectedSocket.send(JSON.stringify(payload));
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

        for (const chunk of request.audioChunks ?? [{ sequence: 1, size: 320 }]) {
          const payload = {
            type: "audio.chunk",
            sequence: chunk.sequence,
            size: chunk.size,
            bytes_b64: chunk.bytesBase64,
            mime_type: chunk.mimeType,
            ts_ms: Date.now(),
          };
          logSessionInfo("send", { sessionId: ensureCurrentSessionId(), ...summarizePayload(payload) });
          connectedSocket.send(JSON.stringify(payload));
        }
        activeTurn.metrics.mark({ name: "speech_end", tsMs: performance.now() });
        const payload = {
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
          };
        logSessionInfo("send", { sessionId: ensureCurrentSessionId(), ...summarizePayload(payload) });
        connectedSocket.send(JSON.stringify(payload));
      });
    },
    async interrupt() {
      if (socket?.readyState === WebSocket.OPEN) {
        const payload = { type: "interrupt" };
        logSessionInfo("send", { sessionId: ensureCurrentSessionId(), ...summarizePayload(payload) });
        socket.send(JSON.stringify(payload));
      }
    },
    async reset() {
      const connectedSocket = await ensureSocket();
      if (activeTurn) {
        failActiveTurn("Lesson reset");
      }
      return new Promise<void>((resolve, reject) => {
        pendingReset = { resolve, reject };
        const payload = { type: "session.reset" };
        logSessionInfo("send", { sessionId: ensureCurrentSessionId(), ...summarizePayload(payload) });
        connectedSocket.send(JSON.stringify(payload));
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
