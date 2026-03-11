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

export type SessionMetricSnapshot = Partial<Record<SessionMetricName, number>>;

export type SessionMetricsTracker = {
  mark: (event: SessionMetricEvent) => void;
  getTs: (name: SessionMetricName) => number | null;
};

const SESSION_METRIC_NAMES: SessionMetricName[] = [
  "speech_end",
  "stt_final",
  "llm_first_token",
  "tts_first_audio",
  "first_viseme",
  "audio_done",
];

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

export function snapshotSessionMetrics(metrics: SessionMetricsTracker): SessionMetricSnapshot {
  return Object.fromEntries(
    SESSION_METRIC_NAMES
      .map((name) => [name, metrics.getTs(name)])
      .filter((entry): entry is [SessionMetricName, number] => entry[1] !== null)
  );
}

export function hydrateSessionMetrics(snapshot: SessionMetricSnapshot): SessionMetricsTracker {
  const metrics = createSessionMetrics();

  for (const name of SESSION_METRIC_NAMES) {
    const tsMs = snapshot[name];
    if (typeof tsMs === "number") {
      metrics.mark({ name, tsMs });
    }
  }

  return metrics;
}

export function seedSessionMetricsFromLatency(
  latency: Pick<
    ReturnType<typeof toLatencyMetrics>,
    "speechEndToSttFinalMs" | "sttFinalToLlmFirstTokenMs" | "llmFirstTokenToTtsFirstAudioMs"
  >,
  referenceTsMs: number = performance.now()
): SessionMetricsTracker {
  const metrics = createSessionMetrics();
  const ttsFirstAudioTsMs = referenceTsMs;
  const llmFirstTokenTsMs = ttsFirstAudioTsMs - latency.llmFirstTokenToTtsFirstAudioMs;
  const sttFinalTsMs = llmFirstTokenTsMs - latency.sttFinalToLlmFirstTokenMs;
  const speechEndTsMs = sttFinalTsMs - latency.speechEndToSttFinalMs;

  metrics.mark({ name: "speech_end", tsMs: speechEndTsMs });
  metrics.mark({ name: "stt_final", tsMs: sttFinalTsMs });
  metrics.mark({ name: "llm_first_token", tsMs: llmFirstTokenTsMs });
  metrics.mark({ name: "tts_first_audio", tsMs: ttsFirstAudioTsMs });
  return metrics;
}

export function toLatencyMetrics(metrics: SessionMetricsTracker) {
  const speechEnd = metrics.getTs("speech_end");
  const sttFinal = metrics.getTs("stt_final");
  const llmFirstToken = metrics.getTs("llm_first_token");
  const ttsFirstAudio = metrics.getTs("tts_first_audio");
  const firstViseme = metrics.getTs("first_viseme");
  const audioDone = metrics.getTs("audio_done");
  const missingEvents: SessionMetricName[] = [];

  for (const eventName of SESSION_METRIC_NAMES) {
    if (metrics.getTs(eventName) === null) {
      missingEvents.push(eventName);
    }
  }

  return {
    speechEndToSttFinalMs: diffOrZero(speechEnd, sttFinal),
    sttFinalToLlmFirstTokenMs: diffOrZero(sttFinal, llmFirstToken),
    llmFirstTokenToTtsFirstAudioMs: diffOrZero(llmFirstToken, ttsFirstAudio),
    ttsFirstAudioToFirstVisemeMs: diffOrNull(ttsFirstAudio, firstViseme),
    speechEndToFirstVisemeMs: diffOrNull(speechEnd, firstViseme),
    speechEndToAudioDoneMs: diffOrNull(speechEnd, audioDone),
    missingEvents,
    requiredEventCoverageComplete: missingEvents.length === 0,
  };
}

function diffOrZero(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return 0;
  }
  return Math.max(0, Math.round(end - start));
}

function diffOrNull(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return null;
  }
  return Math.max(0, Math.round(end - start));
}
