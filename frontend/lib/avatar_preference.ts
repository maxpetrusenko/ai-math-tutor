export const AVATAR_PROVIDER_COOKIE_NAME = "nerdy_avatar_provider";
export const AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeAvatarProviderPreference(providerId: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AVATAR_PROVIDER_COOKIE_NAME}=${encodeURIComponent(providerId)}; path=/; max-age=${AVATAR_PROVIDER_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
