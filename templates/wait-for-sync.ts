/**
 * Cross-app data sync polling helper.
 *
 * Use this when an action in App A should eventually appear in App B,
 * but the exact timing is unknown (EVENTUAL sync type).
 *
 * Avoids flaky `waitForTimeout` calls.
 *
 * Usage:
 *   await waitForSync(appB.page, {
 *     url: '/orders',
 *     assertion: async (page) => {
 *       await expect(page.getByText('Test Order')).toBeVisible();
 *     },
 *   });
 */

import { Page, expect } from '@playwright/test';

export type WaitForSyncOptions = {
  /** URL in the receiving app to navigate to (or re-check). */
  url: string;
  /** Assertion that should eventually succeed. */
  assertion: (page: Page) => Promise<void>;
  /** Max total wait time in ms. Default 10000. */
  timeout?: number;
  /** Delay between polling attempts in ms. Default 500. */
  interval?: number;
  /** Whether to reload the page on each attempt. Default true. */
  reload?: boolean;
};

export async function waitForSync(
  page: Page,
  options: WaitForSyncOptions,
): Promise<void> {
  const {
    url,
    assertion,
    timeout = 10000,
    interval = 500,
    reload = true,
  } = options;

  const deadline = Date.now() + timeout;
  let lastError: Error | undefined;

  // First navigation
  await page.goto(url);

  while (Date.now() < deadline) {
    try {
      await assertion(page);
      return; // success
    } catch (err) {
      lastError = err as Error;
      await page.waitForTimeout(interval);
      if (reload) {
        await page.reload();
      }
    }
  }

  throw new Error(
    `waitForSync timed out after ${timeout}ms on ${url}\n` +
      `Last assertion error: ${lastError?.message ?? 'unknown'}`,
  );
}

/**
 * Variant: poll an API endpoint until it returns expected data.
 * Useful when the receiving app reads from an API on load.
 */
export async function waitForApiSync(
  page: Page,
  options: {
    apiUrl: string;
    predicate: (body: unknown) => boolean;
    timeout?: number;
    interval?: number;
  },
): Promise<void> {
  const { apiUrl, predicate, timeout = 10000, interval = 500 } = options;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const response = await page.request.get(apiUrl);
    if (response.ok()) {
      const body = await response.json();
      if (predicate(body)) {
        return;
      }
    }
    await page.waitForTimeout(interval);
  }

  throw new Error(`waitForApiSync timed out after ${timeout}ms on ${apiUrl}`);
}
