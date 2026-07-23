import type { AvatarConfig } from "./avatar_contract";

export type AvatarMode = "local" | "live";
export type AvatarStatus = "ready" | "fallback";
export type AvatarRenderMode = AvatarMode;
export type AvatarKind = "local" | "managed";
export type AvatarVoicePresentation =
  | "adult-masculine"
  | "adult-feminine"
  | "child-masculine"
  | "child-feminine";

export type AvatarVoiceProfile = {
  presentation: AvatarVoicePresentation;
  cartesiaVoiceId: string;
  openAIRealtimeVoice: string;
};

export type AvatarManifestEntry = {
  id: string;
  label: string;
  kind: AvatarKind;
  mode: AvatarMode;
  assetRef: string;
  bestFor?: string;
  status: AvatarStatus;
  config: AvatarConfig;
  description?: string;
  persona?: string;
  previewGreeting?: string;
  previewPosterUrl?: string;
  previewVideoUrl?: string;
  voiceProfile?: AvatarVoiceProfile;
};

export const DEFAULT_AVATAR_ID = "nerdy-talkinghead-3d";
export const DEFAULT_AVATAR_PROVIDER_ID = DEFAULT_AVATAR_ID;

export const LEGACY_LOCAL_AVATAR_IDS = [
  "sage-svg-2d",
  "albert-svg-2d",
  "nova-svg-2d",
  "dex-svg-2d",
  "banana-css-2d",
  "apple-css-2d",
  "human-css-2d",
  "robot-css-2d",
  "human-threejs-3d",
  "robot-threejs-3d",
  "wizard-school-inspired-threejs-3d",
  "yellow-sidekick-inspired-threejs-3d",
] as const;

const LEGACY_AVATAR_ID_MAP = new Map<string, string>(
  LEGACY_LOCAL_AVATAR_IDS.map((id) => [id, DEFAULT_AVATAR_ID])
);

export const AVATAR_MANIFEST: AvatarManifestEntry[] = [
  {
    id: DEFAULT_AVATAR_ID,
    label: "Nerdy Tutor",
    kind: "local",
    mode: "local",
    assetRef: "nerdy-tutor",
    status: "ready",
    config: {
      provider: "talkinghead",
      type: "3d",
      assetRef: "nerdy-tutor",
      model_url: "/avatars/nerdy-tutor.glb?v=7a05c998",
      features: {
        lip_sync: true,
        eye_tracking: true,
        head_rotation: true,
        idle_animation: true,
      },
    },
    bestFor: "expressive local tutoring",
    description: "A self-hosted young woman tutor with phoneme-aware realtime lip sync.",
    persona: "Patient young woman guide",
    voiceProfile: {
      presentation: "adult-feminine",
      cartesiaVoiceId: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
      openAIRealtimeVoice: "marin",
    },
  },
  {
    id: "simli-b97a7777-live",
    label: "Simli Tutor",
    kind: "managed",
    mode: "live",
    assetRef: "b97a7777-a82e-4925-ad14-861d62c32bec",
    status: "ready",
    config: {
      provider: "simli",
      providerId: "simli-b97a7777-live",
      type: "video",
      assetRef: "b97a7777-a82e-4925-ad14-861d62c32bec",
      livekit: { provider: "simli" },
    },
    bestFor: "remote realtime lip sync",
    description: "Realtime face with fast lip sync.",
    persona: "Studio tutor",
    previewGreeting: "Hello, ready to learn?",
    previewPosterUrl: "/avatar-previews/simli-tutor-preview.jpg",
    previewVideoUrl: "/avatar-previews/simli-tutor-preview.mp4",
  },
  {
    id: "heygen-liveavatar-default",
    label: "HeyGen Tutor",
    kind: "managed",
    mode: "live",
    assetRef: "liveavatar",
    status: "ready",
    config: {
      provider: "liveavatar",
      providerId: "heygen-liveavatar-default",
      type: "video",
      assetRef: "liveavatar",
      livekit: { provider: "liveavatar" },
    },
    bestFor: "managed wow-factor demos",
    description: "Polished studio presenter.",
    persona: "Studio tutor",
  },
];

export function listAvatarManifest(mode?: AvatarMode): AvatarManifestEntry[] {
  return mode ? AVATAR_MANIFEST.filter((entry) => entry.mode === mode) : AVATAR_MANIFEST;
}

export function listSelectableAvatarManifest(): AvatarManifestEntry[] {
  return AVATAR_MANIFEST.filter((entry) => entry.kind === "local");
}

export function isSelectableAvatarId(id: string): boolean {
  const migratedId = migrateAvatarProviderId(id);
  return listSelectableAvatarManifest().some((entry) => entry.id === migratedId);
}

export function migrateAvatarProviderId(id?: string | null): string {
  if (!id) {
    return DEFAULT_AVATAR_ID;
  }
  return LEGACY_AVATAR_ID_MAP.get(id) ?? id;
}

export function resolveAvatarManifestEntry(id: string = DEFAULT_AVATAR_ID): AvatarManifestEntry {
  const migratedId = migrateAvatarProviderId(id);
  return AVATAR_MANIFEST.find((entry) => entry.id === migratedId)
    ?? AVATAR_MANIFEST.find((entry) => entry.id === DEFAULT_AVATAR_ID)!;
}
