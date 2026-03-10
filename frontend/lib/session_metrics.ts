export type SessionMetricName =
  | "speech_end"
  | "stt_final"
  | "llm_first_token"
  | "tts_first_audio"
  | "first_viseme"
  | "audio_done";

export type SessionMetricEvent = {
  name: SessionMetricName;
  tsMs: number;
};

export type SessionMetricsTracker = {
  mark: (event: SessionMetricEvent) => void;
  getTs: (name: SessionMetricName) => number | null;
};

export function createSessionMetrics(): SessionMetricsTracker {
  const events = new Map<SessionMetricName, number>();

  return {
    mark(event) {
      if (!events.has(event.name)) {
        events.set(event.name, event.tsMs);
      }
    },
    getTs(name) {
      return events.get(name) ?? null;
    }
  };
}

export function toLatencyMetrics(metrics: SessionMetricsTracker) {
  const speechEnd = metrics.getTs("speech_end");
  const sttFinal = metrics.getTs("stt_final");
  const llmFirstToken = metrics.getTs("llm_first_token");
  const ttsFirstAudio = metrics.getTs("tts_first_audio");

  return {
    speechEndToSttFinalMs: diffOrZero(speechEnd, sttFinal),
    sttFinalToLlmFirstTokenMs: diffOrZero(sttFinal, llmFirstToken),
    llmFirstTokenToTtsFirstAudioMs: diffOrZero(llmFirstToken, ttsFirstAudio)
  };
}

function diffOrZero(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return 0;
  }
  return Math.max(0, Math.round(end - start));
}
