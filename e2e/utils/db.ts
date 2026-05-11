import { Page } from '@playwright/test';

/**
 * E2E Test Utilities
 *
 * Provides reliable state seeding via direct IndexedDB (Dexie) manipulation,
 * bypassing the UI for fast, deterministic test setup.
 */

/** Navigate to a BottomNav tab by label. */
export async function navigateTo(page: Page, tabLabel: string) {
  await page.locator(`nav button span:text-is("${tabLabel}")`).click();
  // Wait for network to settle AND component state to hydrate
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.waitForTimeout(600);
}

/** Clear all PeptyTrack IndexedDB data. */
async function dbClear(page: Page) {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db } = await import('../src/db/database') as any;
    await Promise.all([
      db.medications.clear(),
      db.doses.clear(),
      db.vials.clear(),
      db.weightEntries.clear(),
      db.settings.clear(),
      db.customSideEffects.clear(),
      db.protocols.clear(),
      db.symptomLogs.clear(),
    ]);
  });
}

/** Directly seed test data into the PeptyTrack Dexie database. */
export async function dbSeed(page: Page, data: {
  medications?: unknown[];
  doses?: unknown[];
  vials?: unknown[];
  weightEntries?: unknown[];
  settings?: { id: string; value: unknown }[];
}) {
  await page.evaluate(async (d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db } = await import('../src/db/database') as any;
    const promises = [];
    if (d.medications?.length) promises.push(db.medications.bulkPut(d.medications));
    if (d.doses?.length)       promises.push(db.doses.bulkPut(d.doses));
    if (d.vials?.length)       promises.push(db.vials.bulkPut(d.vials));
    if (d.weightEntries?.length) promises.push(db.weightEntries.bulkPut(d.weightEntries));
    if (d.settings?.length)    promises.push(db.settings.bulkPut(d.settings));
    await Promise.all(promises);
    // Wait for Dexie to fully flush to disk
    await new Promise(r => setTimeout(r, 200));
  }, data);
  
  // Additional wait for IndexedDB to flush
  await page.waitForTimeout(500);
  
  // Reload so Zustand stores reinitialize from the seeded IndexedDB
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 10000 });
}

/** Set a localStorage key before app load. */
export async function setLocalStorage(page: Page, key: string, value: unknown) {
  await page.evaluate(([k, v]) => {
    localStorage.setItem(k, JSON.stringify(v));
  }, [key, value]);
}

/**
 * Standard app reset: navigate to app, wait for load, clear all storage, reload.
 * This is the ONLY safe pattern for clearing localStorage in Playwright.
 */
export async function resetApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await dbClear(page);
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 10000 });
}
