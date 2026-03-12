const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  delete env.NEXT_DIST_DIR;
  delete env.NODE_ENV;
  vi.resetModules();
});

test("uses the default dist dir and keeps standalone disabled in dev", async () => {
  env.NODE_ENV = "development";
  delete env.NEXT_DIST_DIR;

  const { default: config } = await import("./next.config");

  expect(config.distDir).toBe(".next");
  expect(config.output).toBeUndefined();
});

test("uses the custom dist dir and keeps standalone disabled in dev", async () => {
  env.NODE_ENV = "development";
  env.NEXT_DIST_DIR = ".next-dev";

  const { default: config } = await import("./next.config");

  expect(config.distDir).toBe(".next-dev");
  expect(config.output).toBeUndefined();
});

test("enables standalone packaging for production builds", async () => {
  env.NODE_ENV = "production";

  const { default: config } = await import("./next.config");

  expect(config.output).toBe("standalone");
});
