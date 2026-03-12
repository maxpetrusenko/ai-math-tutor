import { expect, test } from "@playwright/test";

test("demo turn streams tutor reply", async ({ page }) => {
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("avatar-subtitle").getByText(/Let us anchor the fraction idea first/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle history" })).toBeVisible();
});
