import { defineConfig } from "@playwright/test";
// Browser checks run in headless Edge against a fresh Express server serving client/dist.
// Build the client first; the health endpoint tells Playwright when the server is ready.
export default defineConfig({
  testDir: "./client/test",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3001",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
  },
  webServer: {
    command: "node server/server.js",
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: "list",
});
