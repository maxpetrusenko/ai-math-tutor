import {
  resolveCompatibleRuntimeSelectionForAvatar,
  resolveRuntimeCompatibilityPolicy,
} from "./avatar_runtime_compatibility";

test("local avatars keep the flexible runtime matrix", () => {
  const policy = resolveRuntimeCompatibilityPolicy("sage-svg-2d");

  expect(policy.mode).toBe("flexible");
  expect(policy.compatibleLlmProviders).toContain("gemini");
  expect(policy.compatibleLlmProviders).toContain("openai-realtime");
  expect(policy.compatibleTtsProviders).toContain("cartesia");
  expect(policy.compatibleTtsProviders).toContain("openai-realtime");
});

test("split realtime selections are repaired into the full realtime stack", () => {
  expect(
    resolveCompatibleRuntimeSelectionForAvatar("sage-svg-2d", {
      llmProvider: "openai-realtime",
      llmModel: "gpt-realtime-mini",
      ttsProvider: "cartesia",
      ttsModel: "sonic-2",
    }).selection
  ).toEqual({
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });
});

test("managed avatars force the realtime stack", () => {
  const policy = resolveRuntimeCompatibilityPolicy("simli-b97a7777-live");

  expect(policy.mode).toBe("realtime-only");
  expect(policy.compatibleLlmProviders).toEqual(["openai-realtime"]);
  expect(policy.compatibleTtsProviders).toEqual(["openai-realtime"]);

  expect(
    resolveCompatibleRuntimeSelectionForAvatar("simli-b97a7777-live", {
      llmProvider: "gemini",
      llmModel: "gemini-3-flash-preview",
      ttsProvider: "cartesia",
      ttsModel: "sonic-2",
    }).selection
  ).toEqual({
    llmProvider: "openai-realtime",
    llmModel: "gpt-realtime-mini",
    ttsProvider: "openai-realtime",
    ttsModel: "gpt-realtime-mini",
  });
});
