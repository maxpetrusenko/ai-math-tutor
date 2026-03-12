export type AvatarVisualState = "idle" | "listening" | "thinking" | "speaking" | "fading";

export type AvatarConfig = {
  provider: string;
  type: "2d" | "3d" | "video";
  assetRef?: string;
  model_url?: string;
  providerId?: string;
  scale?: number;
  enable_shadows?: boolean;
  features?: {
    lip_sync: boolean;
    eye_tracking: boolean;
    head_rotation: boolean;
    idle_animation: boolean;
  };
  livekit?: {
    provider: "simli" | "liveavatar";
  };
};

export type WordTimestamp = {
  word: string;
  startMs: number;
  endMs: number;
};

export type AvatarSignal = {
  energy: number;
  nowMs: number;
  state: AvatarVisualState;
  timestamps: WordTimestamp[];
};

export type AvatarFrame = {
  activeWord?: string;
  caption: string;
  mouthOpen: number;
  state: AvatarVisualState;
};
