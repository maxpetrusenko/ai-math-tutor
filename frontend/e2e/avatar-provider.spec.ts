import { expect, test } from "@playwright/test";

test("avatar provider switch keeps 2d default and allows opting into 3d", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Avatar").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "2D CSS" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "3D Three.js" }).click();

  await expect(page.getByRole("heading", { name: "Avatar (3D)" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "3D Three.js" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "2D CSS" }).click();

  await expect(page.getByText("Avatar").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "2D CSS" })).toHaveAttribute("aria-pressed", "true");
});
