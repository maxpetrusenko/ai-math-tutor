import type { AvatarFrame, AvatarSignal } from "./avatar_contract";
import { getMouthOpenAmount } from "./avatar_timing";

export function buildAvatarFrame(signal: AvatarSignal): AvatarFrame {
  const speakingLike = signal.state === "speaking" || signal.state === "fading";
  const activeWord = signal.timestamps.find(
    (timestamp) => signal.nowMs >= timestamp.startMs - 30 && signal.nowMs <= timestamp.endMs + 60
  )?.word;

  return {
    activeWord,
    caption:
      signal.state === "listening"
        ? "Listening for the student's reasoning."
        : signal.state === "thinking"
          ? "Planning the next question."
          : signal.state === "fading"
            ? "Landing the last syllable."
            : signal.state === "speaking"
              ? activeWord
                ? `Speaking: ${activeWord}`
                : "Guiding out loud."
              : "Ready for the next turn.",
    mouthOpen: speakingLike ? Math.max(getMouthOpenAmount(signal.timestamps, signal.nowMs), signal.energy * 0.42) : 0.12,
    state: signal.state,
  };
}
