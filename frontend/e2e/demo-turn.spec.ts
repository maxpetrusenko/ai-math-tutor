import { expect, test } from "@playwright/test";

test("demo turn streams tutor reply", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Send Text Turn" }).click();

  await expect(page.getByTestId("avatar-subtitle").getByText(/Let us anchor the fraction idea first/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show history" })).toBeVisible();
});
