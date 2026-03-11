export const DEFAULT_LLM_PROVIDER = "gemini";
export const DEFAULT_LLM_MODEL = "gemini-2.5-flash";
export const DEFAULT_TTS_PROVIDER = "cartesia";
export const DEFAULT_TTS_MODEL = "sonic-2";

export const RUNTIME_OPTIONS = {
  llm: {
    gemini: [
      { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    ],
    minimax: [
      { label: "MiniMax M2.5", value: "minimax-m2.5" },
    ],
  },
  tts: {
    cartesia: [
      { label: "Sonic 2", value: "sonic-2" },
    ],
    minimax: [
      { label: "MiniMax Speech", value: "minimax-speech" },
    ],
  },
} as const;

export type LlmProviderId = keyof typeof RUNTIME_OPTIONS.llm;
export type TtsProviderId = keyof typeof RUNTIME_OPTIONS.tts;

export function resolveDefaultLlmModel(provider: string) {
  const normalized = provider in RUNTIME_OPTIONS.llm ? (provider as LlmProviderId) : DEFAULT_LLM_PROVIDER;
  return RUNTIME_OPTIONS.llm[normalized][0].value;
}

export function resolveDefaultTtsModel(provider: string) {
  const normalized = provider in RUNTIME_OPTIONS.tts ? (provider as TtsProviderId) : DEFAULT_TTS_PROVIDER;
  return RUNTIME_OPTIONS.tts[normalized][0].value;
}
