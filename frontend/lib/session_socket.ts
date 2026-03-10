import { createSessionMetrics, toLatencyMetrics } from "./session_metrics";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/TutorSession";
import type { PersistedLessonThread } from "./lesson_thread_store";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSessionSocketTransport(): SessionTransport {
  const baseWsUrl =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL
      ? process.env.NEXT_PUBLIC_SESSION_WS_URL
      : "ws://localhost:8000/ws/session";
  let currentSessionId = generateSessionId();

  let socket: WebSocket | null = null;
  let socketSessionId: string | null = null;
  let activeTurn:
    | {
        resolve: (result: TutorTurnResult) => void;
        reject: (error: Error) => void;
        metrics: ReturnType<typeof createSessionMetrics>;
        transcript: string;
        tutorText: string;
        state: string;
        timestamps: TutorTurnResult["timestamps"];
        audioSegments: NonNullable<TutorTurnResult["audioSegments"]>;
        pendingSegmentTexts: string[];
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

  const buildWsUrl = () => {
    const url = new URL(baseWsUrl);
    url.searchParams.set("session_id", currentSessionId);
    return url.toString();
  };

  const failActiveTurn = (message: string) => {
    if (!activeTurn) {
      return;
    }

    activeTurn.reject(new Error(message));
    activeTurn = null;
  };

  const handleMessage = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as Record<string, unknown>;
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
      activeTurn.metrics.mark({ name: "stt_final", tsMs: performance.now() });
    }
    if (payload.type === "state.changed") {
      activeTurn.state = String(payload.state);
    }
    if (payload.type === "tutor.text.committed") {
      const committedText = String(payload.text);
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
        timestamps: activeTurn.timestamps,
        audioSegments: activeTurn.audioSegments,
      });
      activeTurn = null;
    }
  };

  const ensureSocket = async () => {
    if (socket?.readyState === WebSocket.OPEN && socketSessionId === currentSessionId) {
      return socket;
    }

    return new Promise<WebSocket>((resolve, reject) => {
      const nextSocket = new WebSocket(buildWsUrl());

      nextSocket.onopen = () => {
        socket = nextSocket;
        socketSessionId = currentSessionId;
        resolve(nextSocket);
      };

      nextSocket.onmessage = handleMessage;
      nextSocket.onerror = () => {
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
      nextSocket.onclose = () => {
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
      connectedSocket.send(
        JSON.stringify({
          type: "session.restore",
          grade_band: thread.gradeBand,
          history: thread.conversation.flatMap((turn) => [
            { role: "user", content: turn.transcript },
            { role: "assistant", content: turn.tutorText },
          ]),
          student_profile: thread.preference ? { preference: thread.preference } : {},
          subject: thread.subject,
        })
      );
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
          transcript: request.studentText,
          tutorText: "",
          state: "thinking",
          timestamps: [],
          audioSegments: [],
          pendingSegmentTexts: [],
        };

        for (const chunk of request.audioChunks ?? [{ sequence: 1, size: 320 }]) {
          connectedSocket.send(
            JSON.stringify({
              type: "audio.chunk",
              sequence: chunk.sequence,
              size: chunk.size,
              bytes_b64: chunk.bytesBase64,
            })
          );
        }
        activeTurn.metrics.mark({ name: "speech_end", tsMs: performance.now() });
        connectedSocket.send(
          JSON.stringify({
            type: "speech.end",
            ts_ms: Date.now(),
            text: request.studentText,
            subject: request.subject,
            grade_band: request.gradeBand,
            student_profile: request.studentProfile,
          })
        );
      });
    },
    async interrupt() {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "interrupt" }));
      }
    },
    async reset() {
      const connectedSocket = await ensureSocket();
      if (activeTurn) {
        failActiveTurn("Lesson reset");
      }
      return new Promise<void>((resolve, reject) => {
        pendingReset = { resolve, reject };
        connectedSocket.send(JSON.stringify({ type: "session.reset" }));
      });
    },
    getSessionId() {
      return currentSessionId;
    },
    async switchSession(sessionId, thread) {
      const shouldRestore = Boolean(thread && thread.conversation.length > 0);
      if (sessionId === currentSessionId && socket?.readyState === WebSocket.OPEN && !shouldRestore) {
        return;
      }

      if (activeTurn) {
        failActiveTurn("Lesson switched");
      }
      pendingReset = null;
      pendingRestore = null;
      currentSessionId = sessionId;
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
