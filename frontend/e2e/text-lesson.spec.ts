import { expect, test } from "@playwright/test";

test("text-only lesson turn works in fixture mode", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send Text Turn" }).click();

  await expect(page.getByTestId("avatar-subtitle").getByText(/fraction idea first/i)).toBeVisible();
  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Turn 1")).toBeVisible();
});
