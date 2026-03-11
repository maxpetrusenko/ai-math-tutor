import {
  createSessionMetrics,
  hydrateSessionMetrics,
  seedSessionMetricsFromLatency,
  type SessionMetricEvent,
  snapshotSessionMetrics,
  toLatencyMetrics
} from "./session_metrics";


test("session metrics derive latency values from ordered events", () => {
  const metrics = createSessionMetrics();
  const events: SessionMetricEvent[] = [
    { name: "speech_end", tsMs: 100 },
    { name: "stt_final", tsMs: 220 },
    { name: "llm_first_token", tsMs: 360 },
    { name: "tts_first_audio", tsMs: 470 },
    { name: "first_viseme", tsMs: 520 },
    { name: "audio_done", tsMs: 1210 }
  ];

  for (const event of events) {
    metrics.mark(event);
  }

  expect(toLatencyMetrics(metrics)).toEqual({
    speechEndToSttFinalMs: 120,
    sttFinalToLlmFirstTokenMs: 140,
    llmFirstTokenToTtsFirstAudioMs: 110,
    ttsFirstAudioToFirstVisemeMs: 50,
    speechEndToFirstVisemeMs: 420,
    speechEndToAudioDoneMs: 1110,
    missingEvents: [],
    requiredEventCoverageComplete: true
  });
});

test("session metrics report missing benchmark events when sync stages are absent", () => {
  const metrics = createSessionMetrics();
  const events: SessionMetricEvent[] = [
    { name: "speech_end", tsMs: 100 },
    { name: "stt_final", tsMs: 220 },
    { name: "llm_first_token", tsMs: 360 },
    { name: "tts_first_audio", tsMs: 470 }
  ];

  for (const event of events) {
    metrics.mark(event);
  }

  expect(toLatencyMetrics(metrics)).toEqual({
    speechEndToSttFinalMs: 120,
    sttFinalToLlmFirstTokenMs: 140,
    llmFirstTokenToTtsFirstAudioMs: 110,
    ttsFirstAudioToFirstVisemeMs: null,
    speechEndToFirstVisemeMs: null,
    speechEndToAudioDoneMs: null,
    missingEvents: ["first_viseme", "audio_done"],
    requiredEventCoverageComplete: false
  });
});

test("session metrics snapshot round-trips tracker timestamps", () => {
  const metrics = createSessionMetrics();
  metrics.mark({ name: "speech_end", tsMs: 10 });
  metrics.mark({ name: "stt_final", tsMs: 20 });
  metrics.mark({ name: "llm_first_token", tsMs: 30 });
  metrics.mark({ name: "tts_first_audio", tsMs: 40 });

  const restored = hydrateSessionMetrics(snapshotSessionMetrics(metrics));

  expect(toLatencyMetrics(restored)).toMatchObject({
    speechEndToSttFinalMs: 10,
    sttFinalToLlmFirstTokenMs: 10,
    llmFirstTokenToTtsFirstAudioMs: 10,
  });
});

test("session metrics can seed a tracker from latency values", () => {
  const metrics = seedSessionMetricsFromLatency({
    speechEndToSttFinalMs: 120,
    sttFinalToLlmFirstTokenMs: 140,
    llmFirstTokenToTtsFirstAudioMs: 110,
  }, 470);

  expect(toLatencyMetrics(metrics)).toMatchObject({
    speechEndToSttFinalMs: 120,
    sttFinalToLlmFirstTokenMs: 140,
    llmFirstTokenToTtsFirstAudioMs: 110,
  });
});
