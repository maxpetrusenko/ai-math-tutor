import { expect, test } from "@playwright/test";

const avatarCases = [
  { mode: "2d", value: "banana-css-2d", heading: "Banana", preset: "Banana" },
  { mode: "2d", value: "robot-css-2d", heading: "Robot", preset: "Robot" },
  { mode: "3d", value: "human-threejs-3d", heading: "Human 3D", preset: "Human" },
  { mode: "3d", value: "wizard-school-inspired-threejs-3d", heading: "Wizard School Inspired", preset: "Wizard School Inspired" },
] as const;

test("avatar matrix covers local presets across both render modes", async ({ page }) => {
  await page.goto("/avatar");

  for (const avatarCase of avatarCases) {
    await page
      .getByRole("button", { name: avatarCase.mode === "3d" ? "3D tutors" : "2D tutors" })
      .click();
    await page
      .locator(".avatar-option")
      .filter({
        has: page.locator(".avatar-option__name", { hasText: new RegExp(`^${avatarCase.heading}$`, "i") }),
      })
      .first()
      .click();

    await expect(page.locator(".section-title")).toHaveText(avatarCase.heading);
    if (avatarCase.mode === "3d") {
      await expect(page.getByTestId("avatar-surface-3d").first()).toBeVisible();
    } else {
      await expect(page.getByTestId("avatar-surface-2d").first()).toBeVisible();
    }
  }
});
