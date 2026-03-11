import {
  applyRuntimeProviderChange,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
  normalizeRuntimeSelection,
} from "./runtime_options";

test("runtime defaults start on the openai realtime combo", () => {
  expect(DEFAULT_LLM_PROVIDER).toBe("openai-realtime");
  expect(DEFAULT_LLM_MODEL).toBe("gpt-realtime-mini");
  expect(DEFAULT_TTS_PROVIDER).toBe("openai-realtime");
  expect(DEFAULT_TTS_MODEL).toBe("gpt-realtime-mini");
});

test("switching llm away from realtime falls back to the chosen llm plus cartesia", () => {
  expect(
    applyRuntimeProviderChange(
      normalizeRuntimeSelection({
        llmProvider: "openai-realtime",
        llmModel: "gpt-realtime-mini",
        ttsProvider: "openai-realtime",
        ttsModel: "gpt-realtime-mini",
      }),
      "llm",
      "gemini"
    )
  ).toEqual({
    llmProvider: "gemini",
    llmModel: "gemini-3-flash-preview",
    ttsProvider: "cartesia",
    ttsModel: "sonic-2",
  });
});

test("switching tts away from realtime falls back to openai plus cartesia", () => {
  expect(
    applyRuntimeProviderChange(
      normalizeRuntimeSelection({
        llmProvider: "openai-realtime",
        llmModel: "gpt-realtime-mini",
        ttsProvider: "openai-realtime",
        ttsModel: "gpt-realtime-mini",
      }),
      "tts",
      "cartesia"
    )
  ).toEqual({
    llmProvider: "openai",
    llmModel: "gpt-4.1-mini",
    ttsProvider: "cartesia",
    ttsModel: "sonic-2",
  });
});
