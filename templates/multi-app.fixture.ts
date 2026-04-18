/**
 * Multi-app Playwright fixture — supports ANY number of apps.
 *
 * Driven entirely by `.env.test`: list app names in `APPS=`, then define
 * per-app config using `APP_<NAME>_URL`, `APP_<NAME>_AUTH`, etc.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/multi-app.fixture';
 *
 *   test('cross-app flow', async ({ apps }) => {
 *     await apps.admin.page.goto('/create');
 *     await expect(apps.candidate.page.getByText('...')).toBeVisible();
 *   });
 *
 * Required env vars (see .env.test):
 *   APPS                              — comma-separated app names, e.g. "admin,candidate"
 *   APP_<NAME>_URL                    — base URL per app (required)
 *   APP_<NAME>_AUTH                   — "true" to load saved storage state (optional)
 *
 * Access: `apps[name].page`, `apps[name].context`, `apps[name].baseURL`.
 * Names are lowercase strings from the `APPS` list. Env keys are uppercased.
 */

import { test as base, BrowserContext, Page } from '@playwright/test';
import path from 'path';

export type AppContext = {
  context: BrowserContext;
  page: Page;
  baseURL: string;
};

export type Apps = Record<string, AppContext>;

type MultiAppFixtures = {
  apps: Apps;
};

const AUTH_DIR = path.join(__dirname, '..', '.auth');

function parseAppNames(): string[] {
  const raw = process.env.APPS ?? '';
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) {
    throw new Error(
      'APPS env var is empty. Set it in .env.test, e.g. APPS=admin,candidate',
    );
  }
  return names;
}

export const test = base.extend<MultiAppFixtures>({
  apps: async ({ browser }, use) => {
    const names = parseAppNames();
    const apps: Apps = {};

    for (const name of names) {
      const key = name.toUpperCase();
      const baseURL = process.env[`APP_${key}_URL`];
      if (!baseURL) {
        throw new Error(
          `Missing APP_${key}_URL for app "${name}". Add it to .env.test.`,
        );
      }

      const authEnabled = process.env[`APP_${key}_AUTH`] === 'true';
      const context = await browser.newContext({
        baseURL,
        storageState: authEnabled
          ? path.join(AUTH_DIR, `${name}-user.json`)
          : undefined,
      });
      const page = await context.newPage();
      apps[name] = { context, page, baseURL };
    }

    await use(apps);

    for (const { context } of Object.values(apps)) {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
