import { expect, test } from "@playwright/test";

test("app loads with core controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  const response = await page.goto("/session", { waitUntil: "networkidle" });

  expect(response?.status()).toBe(200);
  expect(errors).toEqual([]);

  await expect(page.getByRole("heading", { name: "AI Tutor" })).toBeVisible();
  await expect(page.getByLabel("Student prompt")).toBeVisible();
  await expect(page.getByTestId("avatar-surface-2d")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hold to talk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Lesson" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle history" })).toBeVisible();
});
