import { expect, test } from "@playwright/test";

test("new lesson clears transcript, reply, and conversation history", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Student prompt").fill("Custom lesson prompt");
  await page.getByRole("button", { name: "Send Text Turn" }).click();

  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText("Turn 1")).toBeVisible();
  await expect(page.getByTestId("conversation-history-panel").getByText("Custom lesson prompt")).toBeVisible();

  await page.getByRole("button", { name: "New Lesson" }).click();

  await expect(page.getByRole("button", { name: "Show history" })).toBeVisible();
  await expect(page.getByLabel("Student prompt")).toHaveValue("");
  await expect(page.getByLabel("Subject")).toHaveValue("math");
  await expect(page.getByLabel("Grade band")).toHaveValue("6-8");

  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText("Previous lessons (1)")).toBeVisible();
  await page.getByRole("button", { name: "Custom lesson prompt" }).click();

  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText("Turn 1")).toBeVisible();
  await expect(page.getByLabel("Student prompt")).toHaveValue("Custom lesson prompt");
});

test("lesson thread stays visible after a page reload", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Student prompt").fill("Persist this lesson");
  await page.getByRole("button", { name: "Send Text Turn" }).click();

  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText("Turn 1")).toBeVisible();
  await expect(page.getByTestId("conversation-history-panel").getByText("Persist this lesson")).toBeVisible();

  await page.reload();

  await expect(page.getByLabel("Student prompt")).toHaveValue("Persist this lesson");
  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText("Turn 1")).toBeVisible();
  await expect(page.getByTestId("conversation-history-panel").getByText("Persist this lesson")).toBeVisible();
});
