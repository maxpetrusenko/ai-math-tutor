import { describe, expect, test } from "vitest";

import { loadAvatarAsset, LOCAL_AVATAR_ASSET_REFS } from "./avatar_asset_loader";

describe("avatar asset loader", () => {
  test("ships the local preset catalog for offline avatar smoke coverage", () => {
    expect(LOCAL_AVATAR_ASSET_REFS).toEqual([
      "banana",
      "apple",
      "human",
      "robot",
      "wizard-school-inspired",
      "yellow-sidekick-inspired",
    ]);
  });

  test("loads a ready local asset for a known preset", () => {
    expect(loadAvatarAsset({ type: "2d", assetRef: "banana" })).toMatchObject({
      assetRef: "banana",
      fallback: false,
      mode: "2d",
      status: "ready",
    });

    expect(loadAvatarAsset({ type: "3d", assetRef: "robot" })).toMatchObject({
      assetRef: "robot",
      fallback: false,
      mode: "3d",
      status: "ready",
    });
  });

  test("falls back to a safe local baseline when the preset is missing or invalid", () => {
    expect(loadAvatarAsset({ type: "2d", assetRef: "missing" })).toMatchObject({
      assetRef: "human",
      fallback: true,
      mode: "2d",
      status: "fallback",
    });

    expect(
      loadAvatarAsset({
        type: "3d",
        assetRef: "robot",
        model_url: "https://cdn.example.com/not-local.glb",
      })
    ).toMatchObject({
      assetRef: "human",
      fallback: true,
      mode: "3d",
      status: "fallback",
    });
  });
});
