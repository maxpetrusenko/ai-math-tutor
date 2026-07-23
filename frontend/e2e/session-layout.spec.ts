import { expect, test } from "@playwright/test";

test("legacy local selections migrate to TalkingHead without disturbing session layout", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nerdy_avatar_provider_preference", "robot-threejs-3d");
    document.cookie = "nerdy_avatar_provider=robot-threejs-3d; path=/";
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/session", { waitUntil: "networkidle" });

  const composer = page.locator(".session-panel--prompt");
  const avatarStage = page.locator(".session-panel--avatar");

  await expect(composer).toBeVisible();
  await expect(avatarStage).toBeVisible();
  await expect(page.getByTestId("avatar-surface-talkinghead")).toBeVisible();

  const composerBox = await composer.boundingBox();
  const avatarBox = await avatarStage.boundingBox();

  expect(composerBox).not.toBeNull();
  expect(avatarBox).not.toBeNull();
  expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeGreaterThan(620);
  expect(avatarBox?.height ?? 0).toBeGreaterThan(320);
});

test("session remains touch-friendly without horizontal overflow on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/session", { waitUntil: "networkidle" });

  await expect(page.getByTestId("talking-head")).toHaveAttribute("data-load-state", "ready", {
    timeout: 20_000,
  });

  const mobileLayout = await page.evaluate(() => {
    const subtitle = document.querySelector<HTMLElement>("[data-testid='avatar-subtitle']");
    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], input, textarea, select"),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const intersectsViewport =
        box.right > 0 && box.bottom > 0 && box.left < window.innerWidth && box.top < window.innerHeight;
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        box.width > 0 &&
        box.height > 0 &&
        intersectsViewport
      );
    });

    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      undersizedTargets: interactive
        .map((element) => ({
          label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }))
        .filter(({ width, height }) => width < 44 || height < 44),
      subtitlePosition: subtitle ? getComputedStyle(subtitle).position : null,
      subtitleClipped: subtitle ? subtitle.scrollHeight > subtitle.clientHeight : null,
    };
  });

  expect(mobileLayout.hasHorizontalOverflow).toBe(false);
  expect(mobileLayout.undersizedTargets).toEqual([]);
  expect(mobileLayout.subtitlePosition).toBe("static");
  expect(mobileLayout.subtitleClipped).toBe(false);
});
