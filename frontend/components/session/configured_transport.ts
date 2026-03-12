import { createFixtureTransport } from "../../lib/fixture_transport";
import { createOpenAIRealtimeTransport } from "../../lib/openai_realtime_transport";
import { OPENAI_REALTIME_PROVIDER } from "../../lib/runtime_options";
import { createSessionSocketTransport } from "../../lib/session_socket";
import { generateLessonSessionId, type PersistedLessonThread } from "../../lib/lesson_thread_store";
import type { SessionTransport } from "./session_types";

export function createConfiguredTransport(): SessionTransport {
  const socketTransport = createSessionSocketTransport();
  const openaiRealtimeTransport = createOpenAIRealtimeTransport();

  if (
    typeof process !== "undefined"
    && process.env.NEXT_PUBLIC_SESSION_TRANSPORT === "fixture"
  ) {
    const searchParams =
      typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const avatarId = searchParams.get("fixtureAvatar") ?? undefined;
    const scenario = searchParams.get("fixtureScenario");
    return createFixtureTransport({
      avatarId,
      scenarioId: scenario === "science-observation" ? scenario : undefined,
    });
  }

  return {
    async connect() {
      return socketTransport.connect();
    },
    getSessionId() {
      return socketTransport.getSessionId?.() ?? openaiRealtimeTransport.getSessionId?.() ?? generateLessonSessionId();
    },
    async runTurn(request) {
      if (request.llmProvider === "openai-realtime" && request.ttsProvider === "openai-realtime") {
        return openaiRealtimeTransport.runTurn(request);
      }
      return socketTransport.runTurn(request);
    },
    async transcribeAudio(request) {
      const socketTranscribe = socketTransport.transcribeAudio;
      const realtimeTranscribe = openaiRealtimeTransport.transcribeAudio;

      if (socketTranscribe) {
        try {
          return await socketTranscribe(request);
        } catch (error) {
          if (
            request.llmProvider === OPENAI_REALTIME_PROVIDER
            && request.ttsProvider === OPENAI_REALTIME_PROVIDER
            && realtimeTranscribe
          ) {
            return realtimeTranscribe(request);
          }
          throw error;
        }
      }
      if (
        request.llmProvider === OPENAI_REALTIME_PROVIDER
        && request.ttsProvider === OPENAI_REALTIME_PROVIDER
        && realtimeTranscribe
      ) {
        return realtimeTranscribe(request);
      }
      return request.studentText;
    },
    async reportMetric(event) {
      await socketTransport.reportMetric?.(event);
    },
    async interrupt() {
      await Promise.allSettled([
        socketTransport.interrupt(),
        openaiRealtimeTransport.interrupt(),
      ]);
    },
    async reset() {
      await Promise.allSettled([
        socketTransport.reset(),
        openaiRealtimeTransport.reset(),
      ]);
    },
    async switchSession(sessionId: string, thread?: PersistedLessonThread) {
      await Promise.allSettled([
        socketTransport.switchSession?.(sessionId, thread),
        openaiRealtimeTransport.switchSession?.(sessionId, thread),
      ]);
    },
  };
}
