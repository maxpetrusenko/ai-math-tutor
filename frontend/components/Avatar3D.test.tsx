import React from "react";
import { render } from "@testing-library/react";
import { loadAvatarAsset, type Avatar3DAsset } from "../lib/avatar_asset_loader";

const mocks = vi.hoisted(() => ({
  applyAvatar3DFrame: vi.fn(),
  createAvatar3DScene: vi.fn(),
  sampleAvatar3DFrame: vi.fn(),
}));

vi.mock("../lib/avatar_3d_scene", () => ({
  createAvatar3DScene: mocks.createAvatar3DScene,
}));

vi.mock("../lib/avatar_3d_runtime", () => ({
  applyAvatar3DFrame: mocks.applyAvatar3DFrame,
}));

vi.mock("../lib/avatar_3d_driver", () => ({
  sampleAvatar3DFrame: mocks.sampleAvatar3DFrame,
}));

import { Avatar3D } from "./Avatar3D";

beforeEach(() => {
  mocks.applyAvatar3DFrame.mockReset();
  mocks.createAvatar3DScene.mockReset();
  mocks.sampleAvatar3DFrame.mockReset();
});

test("avatar 3d creates a scene, applies frames, and disposes on unmount", () => {
  const dispose = vi.fn();
  mocks.createAvatar3DScene.mockReturnValue({
    avatar: { position: { y: 0 } },
    camera: {},
    dispose,
    headGroup: { rotation: { x: 0, y: 0, z: 0 } },
    mouth: { position: { y: 0 }, scale: { y: 0.3 } },
    renderer: { render: vi.fn() },
    scene: {},
  });
  mocks.sampleAvatar3DFrame.mockReturnValue({
    avatarOffsetY: 0,
    headRotationX: 0,
    headRotationY: 0,
    headRotationZ: 0,
    mouthPositionY: -0.08,
    mouthScaleY: 0.3,
  });

  const { unmount } = render(
    <Avatar3D
      asset={loadAvatarAsset({ type: "3d", assetRef: "human" }) as Avatar3DAsset}
      config={{ provider: "threejs", type: "3d" }}
      energy={0.4}
      nowMs={80}
      state="speaking"
      timestamps={[{ word: "idea", startMs: 0, endMs: 100 }]}
    />
  );

  expect(mocks.createAvatar3DScene).toHaveBeenCalled();
  expect(mocks.sampleAvatar3DFrame).toHaveBeenCalled();
  expect(mocks.applyAvatar3DFrame).toHaveBeenCalled();

  unmount();
  expect(dispose).toHaveBeenCalled();
});

test("avatar 3d reports scene creation failures to the caller", () => {
  const onError = vi.fn();
  mocks.createAvatar3DScene.mockImplementation(() => {
    throw new Error("Error creating WebGL context.");
  });

  render(
    <Avatar3D
      asset={loadAvatarAsset({ type: "3d", assetRef: "human" }) as Avatar3DAsset}
      config={{ provider: "threejs", type: "3d" }}
      nowMs={0}
      onError={onError}
      state="idle"
      timestamps={[]}
    />
  );

  expect(onError).toHaveBeenCalledWith(expect.objectContaining({
    message: "Error creating WebGL context.",
  }));
  expect(mocks.applyAvatar3DFrame).not.toHaveBeenCalled();
});
