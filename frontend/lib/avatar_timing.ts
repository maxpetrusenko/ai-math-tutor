import type { WordTimestamp } from "./avatar_contract";

const PRE_OPEN_MS = 45;
const POST_CLOSE_MS = 70;
const MIN_MOUTH_OPEN = 0.08;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getWordShapeTarget(word: string) {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) {
    return 0.55;
  }

  const vowels = letters.match(/[aeiouy]/g)?.length ?? 0;
  const rounded = /o|u/.test(letters);
  const closed = /^(mhm|mm|hm|shh)$/.test(letters) || /^[bmp]+$/.test(letters);
  const vowelRatio = vowels / letters.length;

  if (closed) {
    return 0.34;
  }

  const base = 0.42 + vowelRatio * 0.48 + vowels * 0.06 + (rounded ? 0.08 : 0);
  return clamp(base, 0.34, 0.96);
}

export function getMouthOpenAmount(timestamps: WordTimestamp[], nowMs: number) {
  const active = timestamps.find(
    (timestamp) => nowMs >= timestamp.startMs - PRE_OPEN_MS && nowMs <= timestamp.endMs + POST_CLOSE_MS
  );

  if (!active) {
    return 0;
  }

  const target = getWordShapeTarget(active.word);

  if (nowMs < active.startMs) {
    const attackProgress = clamp((nowMs - (active.startMs - PRE_OPEN_MS)) / PRE_OPEN_MS, 0, 1);
    return clamp(MIN_MOUTH_OPEN + target * attackProgress * 0.42, 0, 1);
  }

  if (nowMs > active.endMs) {
    const decayProgress = clamp(1 - (nowMs - active.endMs) / POST_CLOSE_MS, 0, 1);
    return clamp(MIN_MOUTH_OPEN + target * decayProgress * 0.38, 0, 1);
  }

  const durationMs = Math.max(40, active.endMs - active.startMs);
  const progress = clamp((nowMs - active.startMs) / durationMs, 0, 1);
  const cadence = 0.74 + Math.sin(progress * Math.PI) * 0.26;

  return clamp(MIN_MOUTH_OPEN + target * cadence, 0, 1);
}
