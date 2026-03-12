export const AVATAR_PROVIDER_COOKIE_NAME = "nerdy_avatar_provider";
export const AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const AVATAR_PROVIDER_STORAGE_KEY = "nerdy_avatar_provider_preference";

export function readAvatarProviderPreference(): string | null {
  if (typeof window !== "undefined") {
    const storedValue = window.localStorage.getItem(AVATAR_PROVIDER_STORAGE_KEY);
    if (storedValue) {
      return storedValue;
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AVATAR_PROVIDER_COOKIE_NAME}=`))
    ?.split("=")[1];

  return cookieValue ? decodeURIComponent(cookieValue) : null;
}

export function writeAvatarProviderPreference(providerId: string) {
  if (typeof document === "undefined") {
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AVATAR_PROVIDER_STORAGE_KEY, providerId);
  }

  document.cookie = `${AVATAR_PROVIDER_COOKIE_NAME}=${encodeURIComponent(providerId)}; path=/; max-age=${AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
