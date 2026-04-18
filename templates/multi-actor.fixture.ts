/**
 * Multi-actor Playwright fixture — supports N parallel sessions of the SAME
 * role (unlike multi-app.fixture which spans different apps).
 *
 * Use when:
 *   - An endpoint accepts `recipientIds[]` / `userIds[]` / `candidateIds[]`
 *   - Testing broadcast fanout (one action → N subscribers)
 *   - Concurrent-edit scenarios (two admins edit same entity)
 *   - Race-on-unique scenarios (N clients create same unique resource)
 *
 * Usage:
 *   import { test, expect } from '../fixtures/multi-actor.fixture';
 *
 *   test('broadcast fanout', async ({ admin, candidates }) => {
 *     await admin.page.goto('/broadcast');
 *     // ... admin sends
 *     for (const c of candidates) {
 *       await expect(c.page.getByText('Broadcast')).toBeVisible();
 *     }
 *   });
 *
 * Required env (.env.test):
 *   APP_ADMIN_URL, APP_ADMIN_EMAIL, APP_ADMIN_PASSWORD           — 1 admin (optional)
 *   APP_CANDIDATE_URL                                            — candidate app base URL
 *   CANDIDATE_1_EMAIL, CANDIDATE_1_PASSWORD                      — 1st candidate actor
 *   CANDIDATE_2_EMAIL, CANDIDATE_2_PASSWORD                      — 2nd candidate actor
 *   CANDIDATE_3_EMAIL, CANDIDATE_3_PASSWORD                      — Nth candidate actor
 *   (Numbering is continuous from 1; fixture stops at the first missing number.)
 */

import { test as base, BrowserContext, Page } from '@playwright/test';

export type ActorContext = {
  context: BrowserContext;
  page: Page;
  email: string;
  baseURL: string;
};

type Fixtures = {
  admin: ActorContext | null;
  candidates: ActorContext[];
};

export const test = base.extend<Fixtures>({
  admin: async ({ browser }, use) => {
    const url = process.env.APP_ADMIN_URL;
    const email = process.env.APP_ADMIN_EMAIL;
    if (!url || !email) {
      await use(null);
      return;
    }
    const context = await browser.newContext({
      baseURL: url,
      storageState: 'e2e/.auth/admin-user.json',
    });
    const page = await context.newPage();
    await use({ context, page, email, baseURL: url });
    await context.close();
  },

  candidates: async ({ browser }, use) => {
    const url = process.env.APP_CANDIDATE_URL;
    if (!url) {
      await use([]);
      return;
    }
    const actors: ActorContext[] = [];
    for (let i = 1; i <= 20; i++) {
      const email = process.env[`CANDIDATE_${i}_EMAIL`];
      if (!email) break; // stop at first missing actor
      const context = await browser.newContext({
        baseURL: url,
        storageState: `e2e/.auth/candidate-${i}.json`,
      });
      const page = await context.newPage();
      actors.push({ context, page, email, baseURL: url });
    }
    await use(actors);
    for (const a of actors) await a.context.close();
  },
});

export { expect } from '@playwright/test';
