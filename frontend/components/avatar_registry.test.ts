import {
  DEFAULT_AVATAR_PROVIDER_ID,
  listAvatarProviders,
  listAvatarProvidersForMode,
  resolveAvatarProvider,
  resolveAvatarProviderId,
} from "./avatar_registry";

test("registry exposes provider options for session controls", () => {
  const options = listAvatarProviders();

  expect(options.map((option) => option.id)).toEqual(
    expect.arrayContaining([
      "banana-css-2d",
      "apple-css-2d",
      "human-css-2d",
      "robot-css-2d",
      "human-threejs-3d",
      "wizard-school-inspired-threejs-3d",
      "yellow-sidekick-inspired-threejs-3d",
    ])
  );
  expect(options.find((option) => option.id === "human-css-2d")?.label).toBe("Human");
});

test("registry falls back to the default provider when config is unknown", () => {
  expect(resolveAvatarProviderId({ provider: "unknown", type: "3d" })).toBe(DEFAULT_AVATAR_PROVIDER_ID);
});

test("registry can filter avatar presets by render mode", () => {
  expect(listAvatarProvidersForMode("2d").map((option) => option.id)).toEqual(
    expect.arrayContaining(["banana-css-2d", "apple-css-2d", "human-css-2d", "robot-css-2d"])
  );
  expect(listAvatarProvidersForMode("3d").map((option) => option.id)).toEqual(
    expect.arrayContaining([
      "human-threejs-3d",
      "robot-threejs-3d",
      "wizard-school-inspired-threejs-3d",
      "yellow-sidekick-inspired-threejs-3d",
    ])
  );
});

test("registry resolves backend 3d config to the default 3d preset", () => {
  const provider = resolveAvatarProvider(resolveAvatarProviderId({ provider: "threejs", type: "3d" }));

  expect(provider.id).toBe("human-threejs-3d");
  expect(provider.mode).toBe("3d");
});
