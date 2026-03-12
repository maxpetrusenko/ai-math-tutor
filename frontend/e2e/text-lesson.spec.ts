import { expect, test } from "@playwright/test";

test("text-only lesson turn works in fixture mode", async ({ page }) => {
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("avatar-subtitle").getByText(/fraction idea first/i)).toBeVisible();
  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByTestId("conversation-history-panel").getByText("Fractions still confuse me.")).toBeVisible();
});
