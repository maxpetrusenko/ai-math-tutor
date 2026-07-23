import { expect, test } from "@playwright/test";

test("TalkingHead avatar activates native multi-shape visemes during a lesson turn", async ({ page }) => {
  await page.addInitScript(() => {
    class DeterministicSpeechUtterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onstart: (() => void) | null = null;
      volume = 1;

      constructor(public text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: DeterministicSpeechUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: DeterministicSpeechUtterance) {
          window.setTimeout(() => utterance.onstart?.(), 0);
          window.setTimeout(() => utterance.onend?.(), 3_000);
        },
      },
    });
  });
  await page.goto("/session");

  await expect(page.getByTestId("talking-head-loading")).toBeHidden({ timeout: 20_000 });
  const avatar = page.getByTestId("talking-head");
  await expect(avatar).toHaveAttribute("data-load-state", "ready");
  await expect(page.getByRole("alert", { name: /avatar could not load/i })).toHaveCount(0);

  await page.getByLabel("Student prompt").fill("Fractions still confuse me.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("avatar-subtitle").getByText(/fraction idea first/i)).toBeVisible();
  await page.waitForTimeout(3_000);
  const firstVisibleVisemeMs = Number(
    (await avatar.getAttribute("data-first-visible-viseme-ms")) ?? "Infinity",
  );
  expect(firstVisibleVisemeMs, "first rendered mouth shape should begin with the audio").toBeLessThanOrEqual(45);
  const observedVisemes = (await avatar.getAttribute("data-observed-visemes")) ?? "";
  expect(
    observedVisemes.split("+").filter(Boolean).length,
    `Observed only these rendered visemes: ${observedVisemes}`,
  ).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => Number((await avatar.getAttribute("data-last-viseme-word-count")) ?? "0"))
    .toBeGreaterThan(5);
  await expect(avatar).not.toHaveAttribute("data-last-viseme-cue-id", "");
});
