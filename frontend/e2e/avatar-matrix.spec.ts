import { expect, test } from "@playwright/test";

const avatarCases = [
  { mode: "2d", value: "banana-css-2d", heading: "Banana", preset: "Banana" },
  { mode: "2d", value: "robot-css-2d", heading: "Robot", preset: "Robot" },
  { mode: "3d", value: "human-threejs-3d", heading: "Human 3D", preset: "Human" },
  { mode: "3d", value: "wizard-school-inspired-threejs-3d", heading: "Wizard School Inspired", preset: "Wizard School Inspired" },
] as const;

test("avatar matrix covers local presets across both render modes", async ({ page }) => {
  await page.goto("/");

  for (const avatarCase of avatarCases) {
    await page.getByLabel("Render mode").selectOption(avatarCase.mode);
    await page.getByLabel("Avatar").selectOption(avatarCase.value);

    await expect(page.getByRole("heading", { name: avatarCase.heading }).first()).toBeVisible();
    if (avatarCase.mode === "3d") {
      await expect(page.getByTestId("avatar-surface-3d")).toBeVisible();
    } else {
      await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
    }
  }
});
