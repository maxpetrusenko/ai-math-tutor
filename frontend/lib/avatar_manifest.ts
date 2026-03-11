import type { AvatarConfig } from "./avatar_contract";

export type AvatarMode = "2d" | "3d";
export type AvatarStatus = "ready" | "fallback";
export type AvatarRenderMode = AvatarMode;

export type AvatarManifestEntry = {
  id: string;
  label: string;
  mode: AvatarMode;
  assetRef: string;
  status: AvatarStatus;
  config: AvatarConfig;
  description?: string;
};

export const DEFAULT_AVATAR_ID = "human-css-2d";
export const DEFAULT_AVATAR_PROVIDER_ID = DEFAULT_AVATAR_ID;

export const AVATAR_MANIFEST: AvatarManifestEntry[] = [
  {
    id: "banana-css-2d",
    label: "Banana",
    mode: "2d",
    assetRef: "banana",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "banana" },
  },
  {
    id: "apple-css-2d",
    label: "Apple",
    mode: "2d",
    assetRef: "apple",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "apple" },
  },
  {
    id: "human-css-2d",
    label: "Human",
    mode: "2d",
    assetRef: "human",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "human" },
  },
  {
    id: "robot-css-2d",
    label: "Robot",
    mode: "2d",
    assetRef: "robot",
    status: "ready",
    config: { provider: "css", type: "2d", assetRef: "robot" },
  },
  {
    id: "human-threejs-3d",
    label: "Human 3D",
    mode: "3d",
    assetRef: "human",
    status: "ready",
    config: { provider: "threejs", type: "3d", assetRef: "human", model_url: "/avatars/human.glb" },
  },
  {
    id: "robot-threejs-3d",
    label: "Robot 3D",
    mode: "3d",
    assetRef: "robot",
    status: "ready",
    config: { provider: "threejs", type: "3d", assetRef: "robot", model_url: "/avatars/robot.glb" },
  },
  {
    id: "wizard-school-inspired-threejs-3d",
    label: "Wizard School Inspired",
    mode: "3d",
    assetRef: "wizard-school-inspired",
    status: "ready",
    config: {
      provider: "threejs",
      type: "3d",
      assetRef: "wizard-school-inspired",
      model_url: "/avatars/wizard-school-inspired.glb",
    },
  },
  {
    id: "yellow-sidekick-inspired-threejs-3d",
    label: "Yellow Sidekick Inspired",
    mode: "3d",
    assetRef: "yellow-sidekick-inspired",
    status: "ready",
    config: {
      provider: "threejs",
      type: "3d",
      assetRef: "yellow-sidekick-inspired",
      model_url: "/avatars/yellow-sidekick-inspired.glb",
    },
  },
];

export function listAvatarManifest(mode?: AvatarMode): AvatarManifestEntry[] {
  return mode ? AVATAR_MANIFEST.filter((entry) => entry.mode === mode) : AVATAR_MANIFEST;
}

export function resolveAvatarManifestEntry(id: string = DEFAULT_AVATAR_ID): AvatarManifestEntry {
  return AVATAR_MANIFEST.find((entry) => entry.id === id) ?? AVATAR_MANIFEST.find((entry) => entry.id === DEFAULT_AVATAR_ID)!;
}
