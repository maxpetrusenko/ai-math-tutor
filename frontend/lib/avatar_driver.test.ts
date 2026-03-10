import { buildAvatarFrame } from "./avatar_driver";

test("driver maps speaking signals into a rendered frame", () => {
  const frame = buildAvatarFrame({
    state: "speaking",
    energy: 0.7,
    nowMs: 90,
    timestamps: [{ word: "idea", startMs: 0, endMs: 180 }],
  });

  expect(frame.state).toBe("speaking");
  expect(frame.activeWord).toBe("idea");
  expect(frame.caption).toContain("Speaking");
  expect(frame.mouthOpen).toBeGreaterThan(0.8);
});

test("driver keeps listening provider-neutral", () => {
  const frame = buildAvatarFrame({
    state: "listening",
    energy: 0.12,
    nowMs: 0,
    timestamps: [],
  });

  expect(frame.mouthOpen).toBe(0.12);
  expect(frame.caption).toContain("Listening");
});
