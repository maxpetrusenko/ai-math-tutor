import { expect, test } from "@playwright/test";

test("interrupt returns the session to idle", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Interrupt", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Send Text Turn" }).click();
  await expect(page.getByTestId("avatar-subtitle").getByText(/Let us anchor the fraction idea first/i)).toBeVisible();

  await page.getByRole("button", { name: "Interrupt", exact: true }).click();

  await expect(page.locator("text=idle").first()).toBeVisible();
});
