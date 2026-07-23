import { DEFAULT_AVATAR_ID, isSelectableAvatarId, migrateAvatarProviderId } from "./avatar_manifest";

export const AVATAR_PROVIDER_COOKIE_NAME = "nerdy_avatar_provider";
export const AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const AVATAR_PROVIDER_STORAGE_KEY = "nerdy_avatar_provider_preference";

export function readAvatarProviderPreference(): string | null {
  if (typeof window !== "undefined") {
    const storedValue = window.localStorage.getItem(AVATAR_PROVIDER_STORAGE_KEY);
    if (storedValue) {
      const migratedValue = migrateAvatarProviderId(storedValue);
      return isSelectableAvatarId(migratedValue) ? migratedValue : DEFAULT_AVATAR_ID;
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AVATAR_PROVIDER_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!cookieValue) {
    return null;
  }
  const migratedValue = migrateAvatarProviderId(decodeURIComponent(cookieValue));
  return isSelectableAvatarId(migratedValue) ? migratedValue : DEFAULT_AVATAR_ID;
}

export function writeAvatarProviderPreference(providerId: string) {
  if (typeof document === "undefined") {
    return;
  }

  const migratedProviderId = migrateAvatarProviderId(providerId);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AVATAR_PROVIDER_STORAGE_KEY, migratedProviderId);
  }

  document.cookie = `${AVATAR_PROVIDER_COOKIE_NAME}=${encodeURIComponent(migratedProviderId)}; path=/; max-age=${AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
