import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
  normalizeRuntimeSelection,
  type RuntimeSelection,
} from "./runtime_options";

export const SESSION_PREFERENCES_STORAGE_KEY = "nerdy_session_preferences";

const SUPPORTED_SUBJECTS = ["math", "science", "english"] as const;
const SUPPORTED_GRADE_BANDS = ["6-8", "9-10", "11-12"] as const;

export type SessionPreferences = RuntimeSelection & {
  audioVolume: number;
  gradeBand: string;
  interfaceLanguage: string;
  pushNotifications: boolean;
  preference: string;
  soundEffects: boolean;
  subject: string;
};

export const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  audioVolume: 1,
  gradeBand: "6-8",
  interfaceLanguage: "en",
  llmModel: DEFAULT_LLM_MODEL,
  llmProvider: DEFAULT_LLM_PROVIDER,
  preference: "",
  pushNotifications: true,
  soundEffects: true,
  subject: "math",
  ttsModel: DEFAULT_TTS_MODEL,
  ttsProvider: DEFAULT_TTS_PROVIDER,
};

function clampVolume(candidate: unknown): number {
  if (typeof candidate !== "number" || Number.isNaN(candidate)) {
    return DEFAULT_SESSION_PREFERENCES.audioVolume;
  }

  return Math.max(0, Math.min(1, candidate));
}

function normalizeSubject(candidate: unknown): string {
  return typeof candidate === "string" && SUPPORTED_SUBJECTS.includes(candidate as (typeof SUPPORTED_SUBJECTS)[number])
    ? candidate
    : DEFAULT_SESSION_PREFERENCES.subject;
}

function normalizeGradeBand(candidate: unknown): string {
  return typeof candidate === "string" && SUPPORTED_GRADE_BANDS.includes(candidate as (typeof SUPPORTED_GRADE_BANDS)[number])
    ? candidate
    : DEFAULT_SESSION_PREFERENCES.gradeBand;
}

function normalizePreference(candidate: unknown): string {
  return typeof candidate === "string" ? candidate : DEFAULT_SESSION_PREFERENCES.preference;
}

function normalizeBoolean(candidate: unknown, fallback: boolean) {
  return typeof candidate === "boolean" ? candidate : fallback;
}

function normalizeLanguage(candidate: unknown) {
  if (candidate === "es" || candidate === "fr" || candidate === "en") {
    return candidate;
  }

  return DEFAULT_SESSION_PREFERENCES.interfaceLanguage;
}

function resolveStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function normalizeSessionPreferences(candidate: Partial<SessionPreferences> | null | undefined): SessionPreferences {
  const runtimeSelection = normalizeRuntimeSelection({
    llmModel: candidate?.llmModel ?? DEFAULT_SESSION_PREFERENCES.llmModel,
    llmProvider: candidate?.llmProvider ?? DEFAULT_SESSION_PREFERENCES.llmProvider,
    ttsModel: candidate?.ttsModel ?? DEFAULT_SESSION_PREFERENCES.ttsModel,
    ttsProvider: candidate?.ttsProvider ?? DEFAULT_SESSION_PREFERENCES.ttsProvider,
  });

  return {
    audioVolume: clampVolume(candidate?.audioVolume),
    gradeBand: normalizeGradeBand(candidate?.gradeBand),
    interfaceLanguage: normalizeLanguage(candidate?.interfaceLanguage),
    llmModel: runtimeSelection.llmModel,
    llmProvider: runtimeSelection.llmProvider,
    preference: normalizePreference(candidate?.preference),
    pushNotifications: normalizeBoolean(candidate?.pushNotifications, DEFAULT_SESSION_PREFERENCES.pushNotifications),
    soundEffects: normalizeBoolean(candidate?.soundEffects, DEFAULT_SESSION_PREFERENCES.soundEffects),
    subject: normalizeSubject(candidate?.subject),
    ttsModel: runtimeSelection.ttsModel,
    ttsProvider: runtimeSelection.ttsProvider,
  };
}

export function readSessionPreferences(): SessionPreferences {
  const storage = resolveStorage();
  if (!storage) {
    return DEFAULT_SESSION_PREFERENCES;
  }

  const rawValue = storage.getItem(SESSION_PREFERENCES_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_SESSION_PREFERENCES;
  }

  try {
    return normalizeSessionPreferences(JSON.parse(rawValue) as Partial<SessionPreferences>);
  } catch {
    return DEFAULT_SESSION_PREFERENCES;
  }
}

export function writeSessionPreferences(
  nextPreferences: Partial<SessionPreferences> | SessionPreferences
): SessionPreferences {
  const storage = resolveStorage();
  const merged = normalizeSessionPreferences({
    ...readSessionPreferences(),
    ...nextPreferences,
  });

  storage?.setItem(SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify(merged));

  return merged;
}
