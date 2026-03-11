import { expect, test } from "@playwright/test";

test("avatar provider switch keeps 2d default and allows opting into 3d", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Human" })).toBeVisible();
  await expect(page.getByLabel("Render mode")).toHaveValue("2d");
  await expect(page.getByLabel("Avatar")).toHaveValue("human-css-2d");

  await page.getByLabel("Render mode").selectOption("3d");
  await page.getByLabel("Avatar").selectOption("human-threejs-3d");

  await expect(page.getByRole("heading", { name: "Human 3D" })).toBeVisible();
  await expect(page.getByLabel("Render mode")).toHaveValue("3d");
  await expect(page.getByLabel("Avatar")).toHaveValue("human-threejs-3d");

  await page.getByLabel("Render mode").selectOption("2d");
  await page.getByLabel("Avatar").selectOption("banana-css-2d");

  await expect(page.getByRole("heading", { name: "Banana" })).toBeVisible();
  await expect(page.getByLabel("Render mode")).toHaveValue("2d");
  await expect(page.getByLabel("Avatar")).toHaveValue("banana-css-2d");
});
