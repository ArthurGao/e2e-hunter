/**
 * Playwright config template for full-stack projects.
 *
 * Supports:
 * - Single-app (just frontend + backend)
 * - Multi-app (multiple frontends sharing a backend)
 * - API-only layer tests (no browser)
 * - Separate authenticated / unauthenticated projects
 *
 * Adapt:
 * - Ports in `webServer` blocks
 * - Auth setup credentials
 * - Add/remove projects for additional apps
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test from the same directory as this config.
// Keeps the skill project-agnostic: each target project drops its own .env.test next to playwright.config.ts.
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth state setup (runs first)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Unauthenticated page tests
    {
      name: 'unauthenticated',
      testMatch: /pages\/.*\.spec\.ts/,
    },

    // Authenticated page tests
    {
      name: 'authenticated',
      testMatch: /pages\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },

    // API layer tests (no browser)
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'http://localhost:3001',
      },
    },

    // Cross-app tests (uncomment + configure for multi-app projects)
    // {
    //   name: 'cross-app',
    //   testMatch: /cross-app\/.*\.spec\.ts/,
    //   dependencies: ['setup'],
    // },
  ],

  webServer: [
    {
      command: 'cd apps/backend && npm run start:dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd apps/frontend && npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    // Uncomment for a second frontend app:
    // {
    //   command: 'cd apps/customer && npm run dev',
    //   url: 'http://localhost:3002',
    //   reuseExistingServer: !process.env.CI,
    // },
  ],
});
