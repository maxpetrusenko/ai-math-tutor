import { expect, test } from "vitest";

import { buildAvatarVisemeTimeline, sampleAvatarVisemeTimeline } from "./avatar_viseme_timeline";

const processor = {
  preProcessText: (text: string) => text,
  wordsToVisemes: () => ({
    durations: [1, 1, 1],
    times: [0, 1, 2],
    visemes: ["PP", "aa", "FF"],
  }),
};

test("builds and samples multiple phoneme shapes inside one timed word", () => {
  const events = buildAvatarVisemeTimeline(
    { id: "cue", words: ["baby"], wtimes: [0], wdurations: [300] },
    processor,
  );

  expect(events.map((event) => event.viseme)).toEqual(["PP", "aa", "FF"]);
  expect(events[0].peakMs).toBeLessThanOrEqual(24);
  expect(events.every((event) => event.endMs - event.attackMs >= 75)).toBe(true);
  const observed = new Set<string>();
  for (let elapsedMs = 0; elapsedMs <= 350; elapsedMs += 10) {
    sampleAvatarVisemeTimeline(events, elapsedMs).forEach((value, viseme) => {
      if (value >= 0.08) {
        observed.add(viseme);
      }
    });
  }
  expect(observed).toEqual(new Set(["PP", "aa", "FF"]));
});

test("uses the vowel nucleus when a short word has room for one visible shape", () => {
  const events = buildAvatarVisemeTimeline(
    { id: "cue", words: ["map"], wtimes: [0], wdurations: [74] },
    processor,
  );

  expect(events.map((event) => event.viseme)).toEqual(["aa"]);
  expect(sampleAvatarVisemeTimeline(events, 30).get("aa")).toBeGreaterThan(0.5);
});
