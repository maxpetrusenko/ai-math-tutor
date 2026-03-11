import type { AvatarConfig } from "../lib/avatar_contract";
import {
  DEFAULT_AVATAR_ID,
  listAvatarManifest,
  resolveAvatarManifestEntry,
  type AvatarManifestEntry,
  type AvatarMode,
} from "../lib/avatar_manifest";

export type AvatarProviderOption = AvatarManifestEntry;
export const DEFAULT_AVATAR_PROVIDER_ID = DEFAULT_AVATAR_ID;
export type AvatarRenderMode = AvatarMode;

export function listAvatarProviders(): AvatarProviderOption[] {
  return listAvatarManifest();
}

export function listAvatarProvidersForMode(mode: AvatarRenderMode): AvatarProviderOption[] {
  return listAvatarManifest(mode);
}

export function resolveAvatarMode(providerId: string = DEFAULT_AVATAR_PROVIDER_ID): AvatarRenderMode {
  return resolveAvatarProvider(providerId).mode;
}

export function resolveDefaultAvatarProviderId(mode: AvatarRenderMode = "2d"): string {
  const defaultProvider = resolveAvatarManifestEntry();
  if (defaultProvider.mode === mode) {
    return defaultProvider.id;
  }

  return listAvatarProvidersForMode(mode)[0]?.id ?? DEFAULT_AVATAR_PROVIDER_ID;
}

export function resolveAvatarProviderId(config: Pick<AvatarConfig, "provider" | "type" | "assetRef">): string {
  const match = listAvatarProviders().find(
    (option) =>
      option.config.provider === config.provider &&
      option.config.type === config.type &&
      (!config.assetRef || option.config.assetRef === config.assetRef)
  );

  return match?.id ?? DEFAULT_AVATAR_PROVIDER_ID;
}

export function resolveAvatarProvider(providerId: string = DEFAULT_AVATAR_PROVIDER_ID): AvatarProviderOption {
  return resolveAvatarManifestEntry(providerId);
}
