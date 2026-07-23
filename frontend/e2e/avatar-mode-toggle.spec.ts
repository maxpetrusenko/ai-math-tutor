import { expect, test } from "@playwright/test";

test("avatar picker exposes only the local tutor", async ({ page }) => {
  await page.goto("/avatar");

  await expect(page.getByRole("button", { name: "Local tutor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Live avatars" })).toHaveCount(0);
  await expect(page.getByTestId("avatar-surface-talkinghead")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Nerdy Tutor" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Simli Tutor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "HeyGen Tutor" })).toHaveCount(0);
  await expect(page.getByTestId("avatar-surface-talkinghead")).toHaveCount(1);
});
