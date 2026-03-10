import { sampleAvatar3DFrame } from "./avatar_3d_driver";


test("3d frame opens the mouth during the active word window", () => {
  const speakingFrame = sampleAvatar3DFrame({
    energy: 0.4,
    nowMs: 80,
    state: "speaking",
    timeSeconds: 1,
    timestamps: [{ word: "idea", startMs: 0, endMs: 180 }],
  });
  const idleFrame = sampleAvatar3DFrame({
    energy: 0.4,
    nowMs: 260,
    state: "speaking",
    timeSeconds: 1,
    timestamps: [{ word: "idea", startMs: 0, endMs: 180 }],
  });

  expect(speakingFrame.mouthScaleY).toBeGreaterThan(idleFrame.mouthScaleY);
  expect(speakingFrame.mouthPositionY).toBeGreaterThan(idleFrame.mouthPositionY);
});


test("3d frame reflects thinking pose from the latest state", () => {
  const thinkingFrame = sampleAvatar3DFrame({
    energy: 0.2,
    nowMs: 0,
    state: "thinking",
    timeSeconds: 1,
    timestamps: [],
  });

  expect(thinkingFrame.headRotationX).toBeGreaterThan(0);
  expect(Math.abs(thinkingFrame.headRotationY)).toBeGreaterThan(0);
});
