import { vi } from "vitest";

/**
 * Test-only helpers for exercising browser-storage failure modes.
 *
 * Real devices hit these constantly: Safari private browsing throws
 * `QuotaExceededError` on writes, browsers with blocked cookies throw
 * `SecurityError` on `window.localStorage` access, and full quotas throw on
 * `setItem`. Production code must degrade gracefully in all three cases.
 */

/** Makes `window.localStorage` access throw, as browsers with blocked storage do. */
export function denyStorageAccess(): () => void {
  const original = window.localStorage;

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    },
  });

  return () => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: original });
  };
}

/** Makes every storage write throw, as exhausted quotas and Safari private mode do. */
export function failStorageWrites(): () => void {
  const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  });

  return () => {
    spy.mockRestore();
  };
}
