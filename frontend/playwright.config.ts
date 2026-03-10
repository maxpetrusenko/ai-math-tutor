import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "BACKEND_PORT=8010 FRONTEND_PORT=3010 NEXT_PUBLIC_SESSION_WS_URL=ws://127.0.0.1:8010/ws/session bash ../scripts/dev.sh",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
