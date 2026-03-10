import type { AvatarConfig } from "../lib/avatar_contract";

export type AvatarProviderOption = {
  id: string;
  label: string;
  config: AvatarConfig;
};

const AVATAR_PROVIDER_OPTIONS: AvatarProviderOption[] = [
  {
    id: "css-2d",
    label: "2D CSS",
    config: {
      provider: "css",
      type: "2d",
    },
  },
  {
    id: "threejs-3d",
    label: "3D Three.js",
    config: {
      provider: "threejs",
      type: "3d",
    },
  },
];

export const DEFAULT_AVATAR_PROVIDER_ID = "css-2d";

export function listAvatarProviders(): AvatarProviderOption[] {
  return AVATAR_PROVIDER_OPTIONS;
}

export function resolveAvatarProviderId(config: Pick<AvatarConfig, "provider" | "type">): string {
  const match = AVATAR_PROVIDER_OPTIONS.find(
    (option) => option.config.provider === config.provider && option.config.type === config.type
  );

  return match?.id ?? DEFAULT_AVATAR_PROVIDER_ID;
}

export function resolveAvatarProvider(providerId: string = DEFAULT_AVATAR_PROVIDER_ID): AvatarProviderOption {
  return AVATAR_PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? AVATAR_PROVIDER_OPTIONS[0];
}
