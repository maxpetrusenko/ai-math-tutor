import { expect, test } from "@playwright/test";

test("avatar mode toggles between 2d and 3d without loading 3d by default", async ({ page }) => {
  await page.goto("/avatar");

  await expect(page.getByRole("button", { name: "2D" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3D" })).toBeVisible();
  await expect(page.getByTestId("avatar-surface-2d").first()).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
  await expect(page.getByText("Loading 3D avatar...")).toHaveCount(0);

  await page.getByRole("button", { name: "3D" }).click();
  await page.getByRole("button", { name: /Human 3D/i }).click();

  await expect(page.getByTestId("avatar-surface-3d").first()).toBeVisible();

  await page.getByRole("button", { name: "2D" }).click();
  await page.getByRole("button", { name: /Banana/i }).click();

  await expect(page.getByTestId("avatar-surface-2d").first()).toBeVisible();
  await expect(page.getByTestId("avatar-surface-3d")).toHaveCount(0);
});
