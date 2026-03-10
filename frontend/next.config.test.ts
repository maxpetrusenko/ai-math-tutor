import nextConfig from "./next.config";

test("uses default build dist dir when NEXT_DIST_DIR is unset", () => {
  const original = process.env.NEXT_DIST_DIR;
  delete process.env.NEXT_DIST_DIR;

  const config = nextConfig;

  expect(config.distDir).toBe(".next");

  if (original !== undefined) {
    process.env.NEXT_DIST_DIR = original;
  }
});

test("uses custom dist dir when NEXT_DIST_DIR is set", async () => {
  const original = process.env.NEXT_DIST_DIR;

  process.env.NEXT_DIST_DIR = ".next-dev";
  vi.resetModules();
  const { default: config } = await import("./next.config");

  expect(config.distDir).toBe(".next-dev");

  if (original === undefined) {
    delete process.env.NEXT_DIST_DIR;
  } else {
    process.env.NEXT_DIST_DIR = original;
  }
});
