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
      "sage-svg-2d",
      "albert-svg-2d",
      "nova-svg-2d",
      "dex-svg-2d",
      "banana-css-2d",
      "apple-css-2d",
      "human-css-2d",
      "robot-css-2d",
      "human-threejs-3d",
      "wizard-school-inspired-threejs-3d",
      "yellow-sidekick-inspired-threejs-3d",
      "simli-b97a7777-live",
      "heygen-liveavatar-default",
    ])
  );
  expect(options.find((option) => option.id === "human-css-2d")?.label).toBe("Human");
  expect(options.find((option) => option.id === "sage-svg-2d")?.persona).toBe("Patient guide");
});

test("registry falls back to the default provider when config is unknown", () => {
  expect(resolveAvatarProviderId({ provider: "unknown", type: "3d" })).toBe(DEFAULT_AVATAR_PROVIDER_ID);
});

test("registry can filter avatar presets by render mode", () => {
  expect(listAvatarProvidersForMode("2d").map((option) => option.id)).toEqual(
    expect.arrayContaining([
      "sage-svg-2d",
      "albert-svg-2d",
      "nova-svg-2d",
      "dex-svg-2d",
      "banana-css-2d",
      "apple-css-2d",
      "human-css-2d",
      "robot-css-2d",
    ])
  );
  expect(listAvatarProvidersForMode("3d").map((option) => option.id)).toEqual(
    expect.arrayContaining([
      "human-threejs-3d",
      "robot-threejs-3d",
      "wizard-school-inspired-threejs-3d",
      "yellow-sidekick-inspired-threejs-3d",
    ])
  );
  expect(listAvatarProvidersForMode("live").map((option) => option.id)).toEqual(
    expect.arrayContaining([
      "simli-b97a7777-live",
      "heygen-liveavatar-default",
    ])
  );
});

test("registry resolves backend 3d config to the default 3d preset", () => {
  const provider = resolveAvatarProvider(resolveAvatarProviderId({ provider: "threejs", type: "3d" }));

  expect(provider.id).toBe("human-threejs-3d");
  expect(provider.mode).toBe("3d");
});

test("registry resolves backend svg config to the matching 2d preset", () => {
  const provider = resolveAvatarProvider(resolveAvatarProviderId({ provider: "svg", type: "2d", assetRef: "nova" }));

  expect(provider.id).toBe("nova-svg-2d");
  expect(provider.mode).toBe("2d");
});

test("registry resolves managed avatar entries", () => {
  const provider = resolveAvatarProvider("simli-b97a7777-live");

  expect(provider.kind).toBe("managed");
  expect(provider.mode).toBe("live");
  expect(provider.config.provider).toBe("simli");
});
