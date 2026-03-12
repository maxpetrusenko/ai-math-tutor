import {
  DEFAULT_SESSION_PREFERENCES,
  readSessionPreferences,
  SESSION_PREFERENCES_STORAGE_KEY,
  writeSessionPreferences,
} from "./session_preferences";

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
