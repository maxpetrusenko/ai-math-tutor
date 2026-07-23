// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

test("the shipped tutor model contains distinct consonant and vowel viseme morphs", () => {
  const modelPath = fileURLToPath(new URL("../public/avatars/nerdy-tutor.glb", import.meta.url));
  const modelBytes = readFileSync(modelPath).toString("latin1");

  expect(modelBytes).toContain("viseme_PP");
  expect(modelBytes).toContain("viseme_FF");
  expect(modelBytes).toContain("viseme_O");
  expect(modelBytes).toContain("viseme_U");
  expect(modelBytes).toContain("viseme_E");
  expect(modelBytes).toContain("viseme_I");
  expect(modelBytes).toContain("viseme_aa");
});
