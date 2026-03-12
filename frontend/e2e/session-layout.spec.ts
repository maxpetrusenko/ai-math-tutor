import { expect, test } from "@playwright/test";

test("session composer stays pinned near the bottom for 3d avatar selections", async ({ page }) => {
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

  const composerBox = await composer.boundingBox();
  const avatarBox = await avatarStage.boundingBox();

  expect(composerBox).not.toBeNull();
  expect(avatarBox).not.toBeNull();
  expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeGreaterThan(620);
  expect(avatarBox?.height ?? 0).toBeGreaterThan(320);
});
