import { expect, test } from "@playwright/test";

test("demo turn streams tutor reply", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Run Demo Turn" }).click();

  await expect(page.getByText(/Nice start\./)).toBeVisible();
  await expect(page.getByText(/What number or operation is attached to x in the equation/)).toBeVisible();
  await expect(page.getByText("Student Transcript")).toBeVisible();
});
