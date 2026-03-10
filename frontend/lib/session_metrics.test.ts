import {
  createSessionMetrics,
  type SessionMetricEvent,
  toLatencyMetrics
} from "./session_metrics";


test("session metrics derive latency values from ordered events", () => {
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
    llmFirstTokenToTtsFirstAudioMs: 110
  });
});
