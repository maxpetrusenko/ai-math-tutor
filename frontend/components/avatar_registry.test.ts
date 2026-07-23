import {
  DEFAULT_AVATAR_PROVIDER_ID,
  listAvatarProviders,
  listAvatarProvidersForMode,
  resolveAvatarProvider,
  resolveAvatarProviderId,
} from "./avatar_registry";
import { LEGACY_LOCAL_AVATAR_IDS } from "../lib/avatar_manifest";

test("registry exposes one local tutor and two managed providers", () => {
  expect(listAvatarProviders().map((option) => option.id)).toEqual([
    "nerdy-talkinghead-3d",
    "simli-b97a7777-live",
    "heygen-liveavatar-default",
  ]);
});

test("registry filters local and live modes", () => {
  expect(listAvatarProvidersForMode("local").map((option) => option.id)).toEqual([
    "nerdy-talkinghead-3d",
  ]);
  expect(listAvatarProvidersForMode("live").map((option) => option.id)).toEqual([
    "simli-b97a7777-live",
    "heygen-liveavatar-default",
  ]);
});

test("every removed local avatar ID migrates to the TalkingHead tutor", () => {
  for (const legacyId of LEGACY_LOCAL_AVATAR_IDS) {
    expect(resolveAvatarProvider(legacyId).id).toBe(DEFAULT_AVATAR_PROVIDER_ID);
  }
});

test("unknown local config resolves to the TalkingHead tutor", () => {
  expect(resolveAvatarProviderId({ provider: "threejs", type: "3d" })).toBe(DEFAULT_AVATAR_PROVIDER_ID);
  expect(resolveAvatarProvider(resolveAvatarProviderId({ provider: "threejs", type: "3d" })).mode).toBe("local");
});

test("registry resolves managed avatar entries", () => {
  const provider = resolveAvatarProvider("simli-b97a7777-live");

  expect(provider.kind).toBe("managed");
  expect(provider.mode).toBe("live");
  expect(provider.config.provider).toBe("simli");
});
