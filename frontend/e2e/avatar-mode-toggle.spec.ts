import { expect, test } from "@playwright/test";

test("avatar mode toggles between 2d and 3d without loading 3d by default", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Render mode")).toHaveValue("2d");
  await expect(page.getByLabel("Avatar")).toHaveValue("human-css-2d");
  await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
  await expect(page.getByText("Loading 3D avatar...")).toHaveCount(0);

  await page.getByLabel("Render mode").selectOption("3d");
  await page.getByLabel("Avatar").selectOption("human-threejs-3d");

  await expect(page.getByLabel("Render mode")).toHaveValue("3d");
  await expect(page.getByLabel("Avatar")).toHaveValue("human-threejs-3d");
  await expect(page.getByTestId("avatar-surface-3d")).toBeVisible();

  await page.getByLabel("Render mode").selectOption("2d");
  await page.getByLabel("Avatar").selectOption("banana-css-2d");

  await expect(page.getByLabel("Render mode")).toHaveValue("2d");
  await expect(page.getByLabel("Avatar")).toHaveValue("banana-css-2d");
  await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
});
