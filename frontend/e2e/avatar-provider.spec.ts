import { expect, test } from "@playwright/test";

test("avatar provider switch keeps 2d default and allows opting into 3d", async ({ page }) => {
  await page.goto("/avatar");

  await expect(page.getByRole("heading", { name: "Choose Your Tutor" })).toBeVisible();
  await expect(page.locator(".section-title")).toHaveText("Sage");
  await expect(page.locator(".section-copy")).toContainText("Warm mentor who explains it clearly.");

  await page.getByRole("button", { name: "3D tutors" }).click();
  await page
    .locator(".avatar-option")
    .filter({
      has: page.locator(".avatar-option__name", { hasText: /^Human 3D$/i }),
    })
    .first()
    .click();

  await expect(page.locator(".section-title")).toHaveText("Human 3D");
  await expect(page.locator(".section-copy")).toContainText("Full-scene tutor for the most lifelike sessions.");

  await page.getByRole("button", { name: "2D tutors" }).click();
  await page
    .locator(".avatar-option")
    .filter({
      has: page.locator(".avatar-option__name", { hasText: /^Banana$/i }),
    })
    .first()
    .click();

  await expect(page.locator(".section-title")).toHaveText("Banana");
  await expect(page.locator(".section-copy")).toContainText("Bright and playful for warm-up practice.");
});
