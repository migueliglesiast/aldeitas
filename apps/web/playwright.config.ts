import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

// Dedicated SQLite database so E2E runs never touch the development data.
const databaseUrl = process.env.E2E_DATABASE_URL || "file:./e2e.db";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    // The site defaults to Spanish; the specs assert the English copy.
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: "aldeitas-locale", value: "en" }] }],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npm run e2e:setup && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_SITE_URL: baseURL,
      // Dummy token: /api/book creates a PENDING booking and returns the local pay page.
      MERCADOPAGO_ACCESS_TOKEN: "TEST-e2e",
      MERCADOPAGO_SANDBOX: "true",
      // WebKit drops Secure cookies over plain http, so relax the session cookie for e2e.
      AUTH_INSECURE_COOKIE: "1",
    },
  },
});
