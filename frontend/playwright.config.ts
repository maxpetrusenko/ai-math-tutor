import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3010",
    launchOptions: {
      args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
    },
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "BACKEND_PORT=8010 FRONTEND_PORT=3010 NEXT_DIST_DIR=.next-playwright NEXT_PUBLIC_SESSION_TRANSPORT=fixture NEXT_PUBLIC_SESSION_WS_URL=ws://127.0.0.1:8010/ws/session bash ../scripts/dev.sh",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
