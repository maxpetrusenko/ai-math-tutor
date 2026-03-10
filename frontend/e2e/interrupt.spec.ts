import { expect, test } from "@playwright/test";

test("interrupt returns the session to idle", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Run Demo Turn" }).click();
  await expect(page.getByText(/Nice start\./)).toBeVisible();

  await page.getByRole("button", { name: "Interrupt", exact: true }).click();

  await expect(page.locator("text=idle").first()).toBeVisible();
});
