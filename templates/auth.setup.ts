/**
 * Auth setup — runs once before the `authenticated` project.
 *
 * Logs in test users and saves cookies/localStorage to disk so all
 * authenticated tests reuse the same session (no repeated login per test).
 *
 * Two modes, driven by .env.test:
 *
 * 1. Single-app (no APPS var set):
 *      TEST_EMAIL, TEST_PASSWORD       → saves .auth/user.json
 *
 * 2. Multi-app (APPS="admin,candidate,..."):
 *      APP_<NAME>_URL                  — base URL (required)
 *      APP_<NAME>_EMAIL                — login email (required)
 *      APP_<NAME>_PASSWORD             — login password (required)
 *      APP_<NAME>_AUTH=true            — enables the setup for this app
 *      APP_<NAME>_LOGIN_PATH           — optional, defaults to /login
 *      APP_<NAME>_SUCCESS_URL_REGEX    — optional, regex source; defaults to "/"
 *    Saves one storage file per app: .auth/<name>-user.json
 *
 * Adapt the login form selectors if your app differs.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

const appsRaw = (process.env.APPS ?? '').trim();

if (!appsRaw) {
  // ── Single-app mode ────────────────────────────────────────────────────
  setup('authenticate default user', async ({ page }) => {
    const authFile = path.join(authDir, 'user.json');

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_PASSWORD || 'password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for successful login (adapt this expectation to your app)
    await page.waitForURL(/.*\/dashboard|.*\/home|.*\//);

    await page.context().storageState({ path: authFile });
  });
} else {
  // ── Multi-app mode — one setup per name in APPS ────────────────────────
  const names = appsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  for (const name of names) {
    const key = name.toUpperCase();
    if (process.env[`APP_${key}_AUTH`] !== 'true') continue;

    setup(`authenticate ${name} user`, async ({ browser }) => {
      const baseURL = process.env[`APP_${key}_URL`];
      const email = process.env[`APP_${key}_EMAIL`];
      const password = process.env[`APP_${key}_PASSWORD`];
      if (!baseURL || !email || !password) {
        throw new Error(
          `Missing APP_${key}_URL / APP_${key}_EMAIL / APP_${key}_PASSWORD in .env.test`,
        );
      }

      const loginPath = process.env[`APP_${key}_LOGIN_PATH`] || '/login';
      const successRegex = new RegExp(
        process.env[`APP_${key}_SUCCESS_URL_REGEX`] || '.*\\/',
      );

      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto(loginPath);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(successRegex);

      await context.storageState({ path: path.join(authDir, `${name}-user.json`) });
      await context.close();
    });
  }
}
