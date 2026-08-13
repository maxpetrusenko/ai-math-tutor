// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";
import { AVATAR_MANIFEST } from "./avatar_manifest";

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

test("the shipped tutor model URL version matches its content hash", () => {
  const modelPath = fileURLToPath(new URL("../public/avatars/nerdy-tutor.glb", import.meta.url));
  const modelBytes = readFileSync(modelPath);
  const digestPrefix = createHash("sha256").update(modelBytes).digest("hex").slice(0, 8);
  const defaultAvatar = AVATAR_MANIFEST.find((entry) => entry.id === "nerdy-talkinghead-3d");

  expect(defaultAvatar?.config.model_url).toBe(`/avatars/nerdy-tutor.glb?v=${digestPrefix}`);
});
