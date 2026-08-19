// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PUBLIC_ORIGIN = "https://aitutor.maxpetrusenko.com";

function readPublicFile(fileName: string): string {
  return readFileSync(fileURLToPath(new URL(`./public/${fileName}`, import.meta.url)), "utf8");
}

describe("public discovery files", () => {
  test("ships a sitemap for the public hosted tutor routes", () => {
    const sitemap = readPublicFile("sitemap.xml");

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain(`<loc>${PUBLIC_ORIGIN}/</loc>`);
    expect(sitemap).toContain(`<loc>${PUBLIC_ORIGIN}/session</loc>`);
    expect(sitemap).toContain(`<loc>${PUBLIC_ORIGIN}/avatar</loc>`);
    expect(sitemap).not.toContain("localhost");
  });

  test("ships an llms.txt summary for LLM crawlers instead of an HTML 404", () => {
    const llms = readPublicFile("llms.txt");

    expect(llms).toContain("# AI Math Tutor");
    expect(llms).toContain(PUBLIC_ORIGIN);
    expect(llms).toContain(`${PUBLIC_ORIGIN}/session`);
    expect(llms).toContain(`${PUBLIC_ORIGIN}/avatar`);
    expect(llms).toContain("realtime voice tutor");
  });
});
