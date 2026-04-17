/**
 * Multi-app Playwright fixture.
 *
 * Enables cross-app E2E testing: each test gets isolated BrowserContext
 * per app, each with its own storage state (auth cookies).
 *
 * Usage:
 *   import { test, expect } from '../fixtures/multi-app.fixture';
 *
 *   test('cross-app flow', async ({ appA, appB }) => {
 *     await appA.page.goto('/create');
 *     // ...
 *     await expect(appB.page.getByText('...')).toBeVisible();
 *   });
 *
 * Required env vars (see .env.test):
 *   APP_A_URL, APP_B_URL            — base URLs
 *   APP_A_AUTH, APP_B_AUTH          — "true" to load auth state
 *
 * To add a third app: copy the appA fixture block, rename, add env vars.
 */

import { test as base, BrowserContext, Page } from '@playwright/test';
import path from 'path';

export type AppContext = {
  context: BrowserContext;
  page: Page;
  baseURL: string;
};

type MultiAppFixtures = {
  appA: AppContext;
  appB: AppContext;
};

const AUTH_DIR = path.join(__dirname, '..', '.auth');

export const test = base.extend<MultiAppFixtures>({
  appA: async ({ browser }, use) => {
    const baseURL = process.env.APP_A_URL || 'http://localhost:3000';
    const context = await browser.newContext({
      baseURL,
      storageState:
        process.env.APP_A_AUTH === 'true'
          ? path.join(AUTH_DIR, 'app-a-user.json')
          : undefined,
    });
    const page = await context.newPage();
    await use({ context, page, baseURL });
    await context.close();
  },

  appB: async ({ browser }, use) => {
    const baseURL = process.env.APP_B_URL || 'http://localhost:3001';
    const context = await browser.newContext({
      baseURL,
      storageState:
        process.env.APP_B_AUTH === 'true'
          ? path.join(AUTH_DIR, 'app-b-user.json')
          : undefined,
    });
    const page = await context.newPage();
    await use({ context, page, baseURL });
    await context.close();
  },
});

export { expect } from '@playwright/test';
