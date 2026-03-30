import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command:
      'DATA_DIR=.playwright-data NEXTAUTH_URL=${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000} NEXTAUTH_SECRET=playwright-nextauth-secret DEV_AUTH=1 DEV_AUTH_SECRET=playwright-secret ENABLE_EMAIL_PASSWORD_AUTH=1 NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH=1 AI_MODE=${PLAYWRIGHT_AI_MODE:-${AI_MODE:-mock}} npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
