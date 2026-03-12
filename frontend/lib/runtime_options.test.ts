import {
  applyRuntimeProviderChange,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
  normalizeRuntimeSelection,
} from "./runtime_options";

test("runtime defaults start on the socket pipeline combo", () => {
  expect(DEFAULT_LLM_PROVIDER).toBe("gemini");
  expect(DEFAULT_LLM_MODEL).toBe("gemini-3-flash-preview");
  expect(DEFAULT_TTS_PROVIDER).toBe("cartesia");
  expect(DEFAULT_TTS_MODEL).toBe("sonic-2");
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

test("switching tts away from realtime falls back to the socket defaults", () => {
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
    llmProvider: "gemini",
    llmModel: "gemini-3-flash-preview",
    ttsProvider: "cartesia",
    ttsModel: "sonic-2",
  });
});
