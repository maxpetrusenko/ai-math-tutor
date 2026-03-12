import { expect, test } from "@playwright/test";

test("new lesson clears transcript, reply, and conversation history", async ({ page }) => {
  const prompt = `Custom lesson prompt ${Date.now()}`;

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill(prompt);
  await page.getByRole("button", { name: "Send" }).click();

  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(page.getByTestId("conversation-history-panel").getByText(prompt)).toBeVisible();
  await page.getByRole("button", { name: "Close history" }).click();

  await page.getByRole("button", { name: "New Lesson" }).click();

  await expect(page.getByRole("button", { name: "Toggle history" })).toBeVisible();
  await expect(page.getByLabel("Student prompt")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "AI Tutor" })).toBeVisible();

  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(page.getByRole("heading", { name: "Previous lessons" })).toBeVisible();
  const archivedLessonButton = page.getByTestId(/^resume-lesson-/).first();
  await expect(archivedLessonButton).toBeVisible();
  await archivedLessonButton.click();

  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(page.getByLabel("Student prompt")).toHaveValue(prompt);
});

test("lesson thread stays visible after a page reload", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/session");

  await page.getByLabel("Student prompt").fill("Persist this lesson");
  await page.getByRole("button", { name: "Send" }).click();

  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(
    page.getByTestId("conversation-history-panel").locator(".conversation-turn__student p").first()
  ).toHaveText("Persist this lesson");

  await page.reload();

  await expect(page.getByLabel("Student prompt")).toHaveValue("Persist this lesson");
  await page.getByRole("button", { name: "Toggle history" }).click();
  await expect(
    page.getByTestId("conversation-history-panel").locator(".conversation-turn__student p").first()
  ).toHaveText("Persist this lesson");
});
