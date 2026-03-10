import type { AvatarVisualState, WordTimestamp } from "./avatar_contract";
import { getMouthOpenAmount } from "./avatar_timing";

export type Avatar3DSignal = {
  energy: number;
  nowMs: number;
  state: Exclude<AvatarVisualState, "fading">;
  timeSeconds: number;
  timestamps: WordTimestamp[];
};

export type Avatar3DFrame = {
  avatarOffsetY: number;
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  mouthPositionY: number;
  mouthScaleY: number;
};

export function sampleAvatar3DFrame(signal: Avatar3DSignal): Avatar3DFrame {
  const mouthOpen = signal.state === "speaking" ? getMouthOpenAmount(signal.timestamps, signal.nowMs) : 0;
  const speakingIntensity = Math.max(mouthOpen, signal.energy * 0.35);

  if (signal.state === "thinking") {
    return {
      avatarOffsetY: 0,
      headRotationX: 0.1 + Math.sin(signal.timeSeconds * 2) * 0.1,
      headRotationY: Math.sin(signal.timeSeconds * 1.5) * 0.2,
      headRotationZ: 0,
      mouthPositionY: -0.1,
      mouthScaleY: 0.2,
    };
  }

  if (signal.state === "speaking") {
    return {
      avatarOffsetY: Math.sin(signal.timeSeconds * 3) * 0.01,
      headRotationX: 0,
      headRotationY: Math.sin(signal.timeSeconds * 0.6) * 0.04,
      headRotationZ: Math.sin(signal.timeSeconds * 8) * (signal.energy * 0.1),
      mouthPositionY: -0.11 + speakingIntensity * 0.07,
      mouthScaleY: 0.18 + speakingIntensity * 0.8,
    };
  }

  return {
    avatarOffsetY: Math.sin(signal.timeSeconds * 0.5) * 0.02,
    headRotationX: signal.state === "listening" ? -0.1 : 0,
    headRotationY: Math.sin(signal.timeSeconds * 0.3) * 0.1,
    headRotationZ: 0,
    mouthPositionY: -0.1,
    mouthScaleY: 0.18,
  };
}
