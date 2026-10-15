import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:3010", headless: true },
  webServer: {
    command: "PORT=3010 node --import tsx server.ts",
    url: "http://127.0.0.1:3010/healthz",
    reuseExistingServer: false,
  },
  reporter: "list",
});
