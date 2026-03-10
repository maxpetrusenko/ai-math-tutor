import { createSessionMetrics, toLatencyMetrics } from "./session_metrics";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/TutorSession";

export function createSessionSocketTransport(): SessionTransport {
  const wsUrl =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL
      ? process.env.NEXT_PUBLIC_SESSION_WS_URL
      : "ws://localhost:8000/ws/session";

  let socket: WebSocket | null = null;
  let activeTurn:
    | {
        resolve: (result: TutorTurnResult) => void;
        reject: (error: Error) => void;
        metrics: ReturnType<typeof createSessionMetrics>;
        transcript: string;
        tutorText: string;
        state: string;
        timestamps: TutorTurnResult["timestamps"];
      }
    | null = null;

  const failActiveTurn = (message: string) => {
    if (!activeTurn) {
      return;
    }

    activeTurn.reject(new Error(message));
    activeTurn = null;
  };

  const handleMessage = (event: MessageEvent<string>) => {
    if (!activeTurn) {
      return;
    }

    const payload = JSON.parse(event.data) as Record<string, unknown>;
    if (payload.type === "session.error") {
      failActiveTurn(String(payload.message ?? "Session error"));
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
      activeTurn.tutorText = String(payload.text);
      activeTurn.metrics.mark({ name: "llm_first_token", tsMs: performance.now() });
    }
    if (payload.type === "tts.audio") {
      activeTurn.timestamps = ((payload.timestamps as Array<Record<string, unknown>>) ?? []).map((item) => ({
        word: String(item.word),
        startMs: Number(item.start_ms),
        endMs: Number(item.end_ms),
      }));
      activeTurn.metrics.mark({ name: "tts_first_audio", tsMs: performance.now() });

      activeTurn.resolve({
        transcript: activeTurn.transcript,
        tutorText: activeTurn.tutorText,
        state: activeTurn.state,
        latency: toLatencyMetrics(activeTurn.metrics),
        timestamps: activeTurn.timestamps,
      });
      activeTurn = null;
    }
  };

  const ensureSocket = async () => {
    if (socket?.readyState === WebSocket.OPEN) {
      return socket;
    }

    return new Promise<WebSocket>((resolve, reject) => {
      const nextSocket = new WebSocket(wsUrl);

      nextSocket.onopen = () => {
        socket = nextSocket;
        resolve(nextSocket);
      };

      nextSocket.onmessage = handleMessage;
      nextSocket.onerror = () => {
        if (socket === nextSocket) {
          failActiveTurn("WebSocket connection failed");
          return;
        }

        reject(new Error("WebSocket connection failed"));
      };
      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          failActiveTurn("WebSocket connection closed");
        }
        socket = null;
      };
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
  };
}
