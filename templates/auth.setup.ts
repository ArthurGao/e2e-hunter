/**
 * Auth setup — runs once before the `authenticated` project.
 *
 * Logs in a test user and saves cookies/localStorage to disk so all
 * authenticated tests reuse the same session (no repeated login per test).
 *
 * For multi-app projects, save a separate storage file per app.
 *
 * Required env vars:
 *   TEST_EMAIL, TEST_PASSWORD
 * Or for multi-app:
 *   APP_A_EMAIL, APP_A_PASSWORD, APP_B_EMAIL, APP_B_PASSWORD
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// ── Single-app auth ──────────────────────────────────────────────────────
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

// ── Multi-app auth (uncomment + adapt for multi-app projects) ────────────
// setup('authenticate App A user', async ({ browser }) => {
//   const context = await browser.newContext({
//     baseURL: process.env.APP_A_URL || 'http://localhost:3000',
//   });
//   const page = await context.newPage();
//   await page.goto('/login');
//   await page.getByLabel(/email/i).fill(process.env.APP_A_EMAIL!);
//   await page.getByLabel(/password/i).fill(process.env.APP_A_PASSWORD!);
//   await page.getByRole('button', { name: /sign in/i }).click();
//   await page.waitForURL(/.*\/dashboard/);
//   await context.storageState({ path: path.join(authDir, 'app-a-user.json') });
//   await context.close();
// });

// setup('authenticate App B user', async ({ browser }) => {
//   const context = await browser.newContext({
//     baseURL: process.env.APP_B_URL || 'http://localhost:3001',
//   });
//   const page = await context.newPage();
//   await page.goto('/login');
//   await page.getByLabel(/email/i).fill(process.env.APP_B_EMAIL!);
//   await page.getByLabel(/password/i).fill(process.env.APP_B_PASSWORD!);
//   await page.getByRole('button', { name: /sign in/i }).click();
//   await page.waitForURL(/.*\//);
//   await context.storageState({ path: path.join(authDir, 'app-b-user.json') });
//   await context.close();
// });
