// @ts-check
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Folder that contains the spec files (relative to this config).
  testDir: './tests',

  // Run test files in parallel (faster locally).
  fullyParallel: true,

  // Fail the build on CI if a test.only() was left in the source.
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI only (flaky network / timing).
  retries: process.env.CI ? 2 : 0,

  // On CI, run tests sequentially in one worker for more stable results.
  workers: process.env.CI ? 1 : undefined,

  // HTML report: npx playwright show-report
  reporter: 'html',

  /* Shared options for every test. See https://playwright.dev/docs/api/class-testoptions */
  use: {
    // Prefix for page.goto('/') — Vite dev server.
    baseURL: 'http://localhost:5173',

    // Record a trace when a test is retried (open with the HTML report).
    trace: 'on-first-retry',

    // Screenshot only when a test fails (keeps the report smaller).
    screenshot: 'only-on-failure',

    // Keep the video only when a test fails.
    video: 'retain-on-failure',
  },

  /* Browser projects to run. Add firefox / webkit here if you need them. */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  /**
   * Start backend + frontend before tests, then wait until they respond.
   * Locally, reuse servers you already started (npm run dev / runserver).
   * On CI, always start fresh processes.
   */
  webServer: [
    {
      // Django API (from the backend folder, not from e2e/).
      command: 'python manage.py runserver',
      cwd: '../backend',
      // Playwright waits until this URL returns a successful response.
      url: 'http://localhost:8000/api/',
      reuseExistingServer: !process.env.CI,
      // Give Django time to boot (migrations, DB, etc.).
      timeout: 120 * 1000,
      env: {
        // Python package path: backend/config/settings.py
        DJANGO_SETTINGS_MODULE: 'config.settings',
      },
    },
    {
      // Vite frontend (proxies /api and /media to Django).
      command: 'npm run dev',
      cwd: '../frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
})
