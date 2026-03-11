export const DEFAULT_LLM_PROVIDER = "gemini";
export const DEFAULT_LLM_MODEL = "gemini-2.5-flash";
export const DEFAULT_TTS_PROVIDER = "cartesia";
export const DEFAULT_TTS_MODEL = "sonic-2";
export const OPENAI_REALTIME_PROVIDER = "openai-realtime";
export const OPENAI_REALTIME_MODEL = "gpt-realtime-mini";

export const RUNTIME_OPTIONS = {
  llm: {
    gemini: [
      { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    ],
    minimax: [
      { label: "MiniMax M2.5", value: "minimax-m2.5" },
    ],
    "openai-realtime": [
      { label: "GPT Realtime Mini", value: OPENAI_REALTIME_MODEL },
    ],
  },
  tts: {
    cartesia: [
      { label: "Sonic 2", value: "sonic-2" },
    ],
    minimax: [
      { label: "MiniMax Speech", value: "minimax-speech" },
    ],
    "openai-realtime": [
      { label: "GPT Realtime Mini", value: OPENAI_REALTIME_MODEL },
    ],
  },
} as const;

export type LlmProviderId = keyof typeof RUNTIME_OPTIONS.llm;
export type TtsProviderId = keyof typeof RUNTIME_OPTIONS.tts;

export type RuntimeSelection = {
  llmModel: string;
  llmProvider: string;
  ttsModel: string;
  ttsProvider: string;
};

export function isOpenAIRealtimeProvider(provider: string) {
  return provider === OPENAI_REALTIME_PROVIDER;
}

function resolveSupportedLlmProvider(provider: string): LlmProviderId {
  return provider in RUNTIME_OPTIONS.llm ? (provider as LlmProviderId) : DEFAULT_LLM_PROVIDER;
}

function resolveSupportedTtsProvider(provider: string): TtsProviderId {
  return provider in RUNTIME_OPTIONS.tts ? (provider as TtsProviderId) : DEFAULT_TTS_PROVIDER;
}

function hasOptionValue(options: ReadonlyArray<{ value: string }>, value: string) {
  return options.some((option) => option.value === value);
}

export function resolveDefaultLlmModel(provider: string) {
  const normalized = resolveSupportedLlmProvider(provider);
  return RUNTIME_OPTIONS.llm[normalized][0].value;
}

export function resolveDefaultTtsModel(provider: string) {
  const normalized = resolveSupportedTtsProvider(provider);
  return RUNTIME_OPTIONS.tts[normalized][0].value;
}

export function normalizeRuntimeSelection(selection: RuntimeSelection): RuntimeSelection {
  if (isOpenAIRealtimeProvider(selection.llmProvider) || isOpenAIRealtimeProvider(selection.ttsProvider)) {
    return {
      llmModel: OPENAI_REALTIME_MODEL,
      llmProvider: OPENAI_REALTIME_PROVIDER,
      ttsModel: OPENAI_REALTIME_MODEL,
      ttsProvider: OPENAI_REALTIME_PROVIDER,
    };
  }

  const llmProvider = resolveSupportedLlmProvider(selection.llmProvider);
  const ttsProvider = resolveSupportedTtsProvider(selection.ttsProvider);
  const llmModel = hasOptionValue(RUNTIME_OPTIONS.llm[llmProvider], selection.llmModel)
    ? selection.llmModel
    : resolveDefaultLlmModel(llmProvider);
  const ttsModel = hasOptionValue(RUNTIME_OPTIONS.tts[ttsProvider], selection.ttsModel)
    ? selection.ttsModel
    : resolveDefaultTtsModel(ttsProvider);

  return {
    llmModel,
    llmProvider,
    ttsModel,
    ttsProvider,
  };
}
