import { expect, test } from "@playwright/test";

test("interrupt returns the session to idle", async ({ page }) => {
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("avatar-subtitle").getByText(/Let us anchor the fraction idea first/i)).toBeVisible();

  const mouth = page.getByTestId("avatar-mouth");
  await expect
    .poll(async () => Number((await mouth.getAttribute("data-open")) ?? "0"))
    .toBeGreaterThan(0.2);

  await page.keyboard.press("Escape");

  await expect
    .poll(async () => Number((await mouth.getAttribute("data-open")) ?? "0"))
    .toBeLessThanOrEqual(0.12);
});
