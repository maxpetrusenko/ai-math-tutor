import type { AvatarSpeechCue } from "./avatar_contract";

export const AVATAR_VISEMES = [
  "aa", "E", "I", "O", "U", "PP", "SS", "TH", "DD", "FF", "kk", "nn", "RR", "CH",
] as const;

export type AvatarViseme = (typeof AVATAR_VISEMES)[number];

export type VisemeProcessor = {
  preProcessText(text: string): string;
  wordsToVisemes(word: string): {
    durations: number[];
    times: number[];
    visemes: string[];
  };
};

export type AvatarVisemeEvent = {
  attackMs: number;
  endMs: number;
  level: number;
  peakMs: number;
  viseme: AvatarViseme;
};

const OPEN_VISEMES = new Set<AvatarViseme>(["aa", "E", "I", "O", "U"]);

function isAvatarViseme(value: string): value is AvatarViseme {
  return (AVATAR_VISEMES as readonly string[]).includes(value);
}

export function buildAvatarVisemeTimeline(
  cue: AvatarSpeechCue,
  processor: VisemeProcessor,
): AvatarVisemeEvent[] {
  const events: AvatarVisemeEvent[] = [];

  cue.words.forEach((word, wordIndex) => {
    const result = processor.wordsToVisemes(processor.preProcessText(word));
    const availableVisemes = result.visemes.filter(isAvatarViseme);
    const distinctVisemes = availableVisemes.filter((viseme, index) => viseme !== availableVisemes[index - 1]);
    if (distinctVisemes.length === 0) {
      return;
    }

    const wordStartMs = cue.wtimes[wordIndex] ?? 0;
    const nextWordStartMs = cue.wtimes[wordIndex + 1];
    const wordWindowMs = Math.max(
      100,
      cue.wdurations[wordIndex] ?? 0,
      nextWordStartMs === undefined ? 0 : nextWordStartMs - wordStartMs,
    );
    // The avatar renders at 30 FPS. Preserve representative phonemes for long
    // enough to survive that cadence instead of scheduling invisible 10 ms shapes.
    const shapeCount = Math.min(distinctVisemes.length, 3, Math.max(1, Math.floor(wordWindowMs / 75)));
    const selectedVisemes = Array.from({ length: shapeCount }, (_, index) => {
      if (shapeCount === 1) {
        // A short word still needs visible articulation. Its first phoneme is
        // often a closed consonant, so preserve the vowel nucleus instead.
        return distinctVisemes.find((viseme) => OPEN_VISEMES.has(viseme))
          ?? distinctVisemes[Math.floor(distinctVisemes.length / 2)];
      }
      const sourceIndex = Math.round(index * (distinctVisemes.length - 1) / (shapeCount - 1));
      return distinctVisemes[sourceIndex];
    });
    const slotMs = wordWindowMs / selectedVisemes.length;

    selectedVisemes.forEach((viseme, visemeIndex) => {
      const slotStartMs = wordStartMs + visemeIndex * slotMs;
      const slotEndMs = wordStartMs + (visemeIndex + 1) * slotMs;
      events.push({
        attackMs: Math.max(0, slotStartMs - 12),
        endMs: slotEndMs + 12,
        level: viseme === "PP" || viseme === "FF" ? 0.92 : 0.78,
        peakMs: slotStartMs + Math.min(24, slotMs / 3),
        viseme,
      });
    });
  });

  return events;
}

export function sampleAvatarVisemeTimeline(events: AvatarVisemeEvent[], elapsedMs: number) {
  const values = new Map<AvatarViseme, number>();
  events.forEach((event) => {
    if (elapsedMs < event.attackMs || elapsedMs > event.endMs) {
      return;
    }
    const value = elapsedMs <= event.peakMs
      ? event.level * (elapsedMs - event.attackMs) / Math.max(1, event.peakMs - event.attackMs)
      : event.level * (event.endMs - elapsedMs) / Math.max(1, event.endMs - event.peakMs);
    values.set(event.viseme, Math.max(values.get(event.viseme) ?? 0, Math.max(0, Math.min(1, value))));
  });
  return values;
}
