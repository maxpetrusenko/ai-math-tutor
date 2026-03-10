import { expect, test } from "@playwright/test";

test("avatar mode toggles between 2d and 3d without loading 3d by default", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("avatar-mode-css-2d")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
  await expect(page.getByText("Loading 3D avatar...")).toHaveCount(0);

  await page.getByTestId("avatar-mode-threejs-3d").click();

  await expect(page.getByTestId("avatar-mode-threejs-3d")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("avatar-surface-3d")).toBeVisible();

  await page.getByTestId("avatar-mode-css-2d").click();

  await expect(page.getByTestId("avatar-mode-css-2d")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
});
