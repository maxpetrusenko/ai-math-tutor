/**
 * Safe browser-storage helpers.
 *
 * Real devices hit storage failures constantly: Safari private browsing throws
 * `QuotaExceededError` on writes, browsers with blocked cookies throw
 * `SecurityError` on `window.localStorage` access, and exhausted quotas throw
 * on `setItem`. Use these helpers instead of touching `window.localStorage`
 * directly so persistence degrades to defaults instead of crashing the page.
 */

export function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStorageValue(key: string): string | null {
  const storage = getSafeStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageValue(key: string, value: string): boolean {
  const storage = getSafeStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageValue(key: string): boolean {
  const storage = getSafeStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
