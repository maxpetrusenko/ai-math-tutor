import { expect, test } from "@playwright/test";

test("default svg avatar shows measurable mouth motion during a lesson turn", async ({ page }) => {
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("avatar-subtitle").getByText(/fraction idea first/i)).toBeVisible();

  const mouth = page.getByTestId("avatar-mouth");
  const samples: number[] = [];

  for (let index = 0; index < 12; index += 1) {
    samples.push(Number((await mouth.getAttribute("data-open")) ?? "0"));
    await page.waitForTimeout(90);
  }

  expect(Math.max(...samples)).toBeGreaterThan(0.45);
  expect(new Set(samples.map((sample) => sample.toFixed(2))).size).toBeGreaterThan(2);
});
