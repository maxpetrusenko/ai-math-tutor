import type { AvatarSpeechCue, WordTimestamp } from "./avatar_contract";

type BuildAvatarSpeechCueInput = {
  cueId: string;
  durationMs: number;
  segmentOffsetMs: number;
  segmentText: string;
  timestamps: WordTimestamp[];
};

function fallbackWordTimestamps(text: string, durationMs: number): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const slotMs = Math.max(80, durationMs / words.length);
  return words.map((word, index) => ({
    word,
    startMs: index * slotMs,
    endMs: Math.min(durationMs, index * slotMs + slotMs * 0.82),
  }));
}

export function buildAvatarSpeechCue({
  cueId,
  durationMs,
  segmentOffsetMs,
  segmentText,
  timestamps,
}: BuildAvatarSpeechCueInput): AvatarSpeechCue | null {
  const segmentEndMs = segmentOffsetMs + durationMs;
  const relativeTimestamps = timestamps
    .filter((timestamp) => timestamp.endMs > segmentOffsetMs && timestamp.startMs < segmentEndMs)
    .map((timestamp) => ({
      word: timestamp.word,
      startMs: Math.max(0, timestamp.startMs - segmentOffsetMs),
      endMs: Math.min(durationMs, timestamp.endMs - segmentOffsetMs),
    }));
  const cueTimestamps = relativeTimestamps.length > 0
    ? relativeTimestamps
    : fallbackWordTimestamps(segmentText, durationMs);

  if (cueTimestamps.length === 0) {
    return null;
  }

  return {
    id: cueId,
    words: cueTimestamps.map(({ word }) => word),
    wdurations: cueTimestamps.map(({ startMs, endMs }) => Math.max(40, endMs - startMs)),
    wtimes: cueTimestamps.map(({ startMs }) => startMs),
  };
}
