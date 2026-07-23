import { describe, expect, test } from "vitest";

import { buildAvatarSpeechCue } from "./avatar_speech_cue";

describe("buildAvatarSpeechCue", () => {
  test("slices cumulative word timings into a segment-relative viseme cue", () => {
    expect(buildAvatarSpeechCue({
      cueId: "turn-2",
      durationMs: 500,
      segmentOffsetMs: 500,
      segmentText: "five vowels",
      timestamps: [
        { word: "before", startMs: 0, endMs: 300 },
        { word: "five", startMs: 520, endMs: 700 },
        { word: "vowels", startMs: 730, endMs: 980 },
      ],
    })).toEqual({
      id: "turn-2",
      words: ["five", "vowels"],
      wdurations: [180, 250],
      wtimes: [20, 230],
    });
  });

  test("builds a deterministic fallback cue when the provider has no word timings", () => {
    const cue = buildAvatarSpeechCue({
      cueId: "fallback",
      durationMs: 600,
      segmentOffsetMs: 0,
      segmentText: "baby puppy five",
      timestamps: [],
    });

    expect(cue?.words).toEqual(["baby", "puppy", "five"]);
    expect(cue?.wtimes).toEqual([0, 200, 400]);
    expect(cue?.wdurations).toEqual([164, 164, 164]);
  });
});
