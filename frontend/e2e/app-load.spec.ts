import { expect, test } from "@playwright/test";

test("app loads with core controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  const response = await page.goto("/", { waitUntil: "networkidle" });

  expect(response?.status()).toBe(200);
  expect(errors).toEqual([]);

  await expect(page.getByText("Live AI Video Tutor")).toBeVisible();
  await expect(page.getByLabel("Student prompt")).toBeVisible();
  await expect(page.getByLabel("Subject")).toBeVisible();
  await expect(page.getByLabel("Grade band")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send Text Turn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hold to talk" })).toBeVisible();
});
