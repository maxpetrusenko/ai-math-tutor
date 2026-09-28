import {
  DEFAULT_SESSION_PREFERENCES,
  readSessionPreferences,
  SESSION_PREFERENCES_STORAGE_KEY,
  type SessionPreferences,
  writeSessionPreferences,
} from "./session_preferences";
import { denyStorageAccess, failStorageWrites } from "./storage_test_helpers";

afterEach(() => {
  window.localStorage.clear();
});

test("reads defaults when no saved session preferences exist", () => {
  expect(readSessionPreferences()).toEqual(DEFAULT_SESSION_PREFERENCES);
});

test("writes normalized session preferences", () => {
  const saved = writeSessionPreferences({
    audioVolume: 2,
    gradeBand: "9-10",
    interfaceLanguage: "fr",
    llmProvider: "openai-realtime",
    preference: "Use short hints",
    pushNotifications: false,
    soundEffects: false,
    subject: "science",
    ttsProvider: "cartesia",
  });

  expect(saved).toMatchObject({
    audioVolume: 1,
    gradeBand: "9-10",
    interfaceLanguage: "fr",
    llmProvider: "openai-realtime",
    preference: "Use short hints",
    pushNotifications: false,
    soundEffects: false,
    subject: "science",
    ttsProvider: "cartesia",
  });

  expect(JSON.parse(window.localStorage.getItem(SESSION_PREFERENCES_STORAGE_KEY) ?? "{}")).toMatchObject({
    gradeBand: "9-10",
    interfaceLanguage: "fr",
    preference: "Use short hints",
    pushNotifications: false,
    soundEffects: false,
    subject: "science",
  });
});

test("recovers from invalid stored preferences", () => {
  window.localStorage.setItem(SESSION_PREFERENCES_STORAGE_KEY, "{bad json");

  expect(readSessionPreferences()).toEqual(DEFAULT_SESSION_PREFERENCES);
});

test("falls back to defaults when browser storage is unavailable", () => {
  const restoreStorage = denyStorageAccess();

  try {
    expect(readSessionPreferences()).toEqual(DEFAULT_SESSION_PREFERENCES);
    expect(() => writeSessionPreferences({ gradeBand: "9-10" })).not.toThrow();
    expect(writeSessionPreferences({ gradeBand: "9-10" })).toMatchObject({ gradeBand: "9-10" });
  } finally {
    restoreStorage();
  }
});

test("survives quota errors when saving preferences", () => {
  const restoreStorage = failStorageWrites();

  try {
    let saved: SessionPreferences | null = null;
    expect(() => {
      saved = writeSessionPreferences({ gradeBand: "9-10" });
    }).not.toThrow();
    expect(saved).toMatchObject({ gradeBand: "9-10" });
  } finally {
    restoreStorage();
  }
});
