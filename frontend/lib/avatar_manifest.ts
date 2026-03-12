import type { AvatarConfig } from "./avatar_contract";

export type AvatarMode = "2d" | "3d" | "live";
export type AvatarStatus = "ready" | "fallback";
export type AvatarRenderMode = AvatarMode;
export type AvatarKind = "local" | "managed";

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
};

export const DEFAULT_AVATAR_ID = "sage-svg-2d";
export const DEFAULT_AVATAR_PROVIDER_ID = DEFAULT_AVATAR_ID;

export const AVATAR_MANIFEST: AvatarManifestEntry[] = [
  {
    id: "sage-svg-2d",
    label: "Sage",
    kind: "local",
    mode: "2d",
    assetRef: "sage",
    status: "ready",
    config: { provider: "svg", type: "2d", assetRef: "sage" },
    bestFor: "calm explanations",
    description: "Warm mentor who explains it clearly.",
    persona: "Patient guide",
  },
  {
    id: "albert-svg-2d",
    label: "Albert",
    kind: "local",
    mode: "2d",
    assetRef: "albert",
    status: "ready",
    config: { provider: "svg", type: "2d", assetRef: "albert" },
    bestFor: "step-by-step learning",
    description: "Classic mentor who breaks it down step by step.",
    persona: "Classic teacher",
  },
  {
    id: "nova-svg-2d",
    label: "Nova",
    kind: "local",
    mode: "2d",
    assetRef: "nova",
    status: "ready",
    config: { provider: "svg", type: "2d", assetRef: "nova" },
    bestFor: "confidence boosts",
    description: "Friendly robot helper for hints and encouragement.",
    persona: "Robot coach",
  },
  {
    id: "dex-svg-2d",
    label: "Dex",
    kind: "local",
    mode: "2d",
    assetRef: "dex",
    status: "ready",
    config: { provider: "svg", type: "2d", assetRef: "dex" },
    bestFor: "puzzle mode",
    description: "Playful challenger for puzzle mode.",
    persona: "Fast challenger",
  },
  {
    id: "banana-css-2d",
    label: "Banana",
    kind: "local",
    mode: "2d",
    assetRef: "banana",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "banana" },
    bestFor: "younger learners",
    description: "Bright and playful for warm-up practice.",
    persona: "Cartoon helper",
  },
  {
    id: "apple-css-2d",
    label: "Apple",
    kind: "local",
    mode: "2d",
    assetRef: "apple",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "apple" },
    bestFor: "gentle coaching",
    description: "Friendly and simple for quick review sessions.",
    persona: "Friendly coach",
  },
  {
    id: "human-css-2d",
    label: "Human",
    kind: "local",
    mode: "2d",
    assetRef: "human",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "human" },
    bestFor: "classic classroom feel",
    description: "A grounded tutor style for focused study.",
    persona: "Human mentor",
  },
  {
    id: "robot-css-2d",
    label: "Robot",
    kind: "local",
    mode: "2d",
    assetRef: "robot",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "robot" },
    bestFor: "fast drills",
    description: "Sharp and energetic for repetition practice.",
    persona: "Robot drill coach",
  },
  {
    id: "human-threejs-3d",
    label: "Human 3D",
    kind: "local",
    mode: "3d",
    assetRef: "human",
    status: "ready",
    config: { provider: "threejs", type: "3d", assetRef: "human", model_url: "/avatars/human.glb" },
    bestFor: "immersive tutoring",
    description: "Full-scene tutor for the most lifelike sessions.",
    persona: "Studio mentor",
  },
  {
    id: "robot-threejs-3d",
    label: "Robot 3D",
    kind: "local",
    mode: "3d",
    assetRef: "robot",
    status: "ready",
    config: { provider: "threejs", type: "3d", assetRef: "robot", model_url: "/avatars/robot.glb" },
    bestFor: "animated demos",
    description: "Tech-forward style with stronger stage presence.",
    persona: "Animated robot",
  },
  {
    id: "wizard-school-inspired-threejs-3d",
    label: "Wizard School Inspired",
    kind: "local",
    mode: "3d",
    assetRef: "wizard-school-inspired",
    status: "ready",
    config: {
      provider: "threejs",
      type: "3d",
      assetRef: "wizard-school-inspired",
      model_url: "/avatars/wizard-school-inspired.glb",
    },
    bestFor: "story-led learning",
    description: "Best when the tutor session should feel imaginative.",
    persona: "Magic guide",
  },
  {
    id: "yellow-sidekick-inspired-threejs-3d",
    label: "Yellow Sidekick Inspired",
    kind: "local",
    mode: "3d",
    assetRef: "yellow-sidekick-inspired",
    status: "ready",
    config: {
      provider: "threejs",
      type: "3d",
      assetRef: "yellow-sidekick-inspired",
      model_url: "/avatars/yellow-sidekick-inspired.glb",
    },
    bestFor: "energy and delight",
    description: "A playful sidekick for learners who like motion and character.",
    persona: "Comic helper",
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

export function resolveAvatarManifestEntry(id: string = DEFAULT_AVATAR_ID): AvatarManifestEntry {
  return AVATAR_MANIFEST.find((entry) => entry.id === id) ?? AVATAR_MANIFEST.find((entry) => entry.id === DEFAULT_AVATAR_ID)!;
}
