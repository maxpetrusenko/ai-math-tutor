import { getMouthOpenAmount } from "./avatar_timing";

test("mouth begins opening slightly before a word starts", () => {
  const timestamps = [{ word: "atom", startMs: 100, endMs: 220 }];

  expect(getMouthOpenAmount(timestamps, 85)).toBeGreaterThan(0);
});

test("vowel-heavy words open wider than closed-mouth sounds", () => {
  const wide = getMouthOpenAmount([{ word: "idea", startMs: 0, endMs: 180 }], 90);
  const narrow = getMouthOpenAmount([{ word: "mhm", startMs: 0, endMs: 180 }], 90);

  expect(wide).toBeGreaterThan(narrow);
});
