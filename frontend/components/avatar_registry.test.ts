import { DEFAULT_AVATAR_PROVIDER_ID, listAvatarProviders, resolveAvatarProviderId } from "./avatar_registry";

test("registry exposes provider options for session controls", () => {
  const options = listAvatarProviders();

  expect(options.map((option) => option.id)).toEqual(expect.arrayContaining(["css-2d", "threejs-3d"]));
  expect(options.find((option) => option.id === "css-2d")?.label).toBe("2D CSS");
});

test("registry falls back to the default provider when config is unknown", () => {
  expect(resolveAvatarProviderId({ provider: "unknown", type: "3d" })).toBe(DEFAULT_AVATAR_PROVIDER_ID);
});
