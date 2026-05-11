import { test as base, Page, Locator, expect } from '@playwright/test';

/**
 * Shared page-object helpers for the PeptyTrack E2E suite.
 * Centralizes navigation, toast assertions, and IndexedDB reset.
 */
export class PeptyTrackApp {
  readonly page: Page;

  // --- Navigation ---
  readonly navHome: Locator;
  readonly navLog: Locator;
  readonly navChart: Locator;
  readonly navWeight: Locator;
  readonly navMeds: Locator;
  readonly navVials: Locator;
  readonly navSettings: Locator;

  // --- Shared UI ---
  readonly pageHeading: Locator;
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navHome     = page.locator('button:has-text("Home")');
    this.navLog      = page.locator('button:has-text("Log")');
    this.navChart    = page.locator('button:has-text("Chart")');
    this.navWeight   = page.locator('button:has-text("Weight")');
    this.navMeds     = page.locator('button:has-text("Meds")');
    this.navVials    = page.locator('button:has-text("Vials")');
    this.navSettings = page.locator('button:has-text("Settings")');
    this.pageHeading = page.locator('h1').first();
    this.toastContainer = page.locator('[aria-live="polite"], .toast-container');
  }

  // --- Navigation helpers ---
  async goToDashboard() { await this.navHome.click(); await this.page.waitForTimeout(300); }
  async goToLog()       { await this.navLog.click();      await this.page.waitForTimeout(300); }
  async goToChart()     { await this.navChart.click();     await this.page.waitForTimeout(300); }
  async goToWeight()    { await this.navWeight.click();    await this.page.waitForTimeout(300); }
  async goToMeds()     { await this.navMeds.click();      await this.page.waitForTimeout(300); }
  async goToVials()    { await this.navVials.click();     await this.page.waitForTimeout(300); }
  async goToSettings() { await this.navSettings.click(); await this.page.waitForTimeout(300); }

  // --- Toast helpers ---
  async expectToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    await expect(this.page.getByText(message)).toBeVisible({ timeout: 5000 });
  }

  // --- IndexedDB reset ---
  async clearIndexedDB() {
    await this.page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });
    await this.page.reload();
    await this.page.waitForTimeout(1500);
  }

  /**
   * NOTE: State seeding should be done via `dbSeed()` from `e2e/utils/db.ts`
   * followed by `page.reload()` so Zustand rehydrates from IndexedDB.
   * Direct Zustand mutation via `page.evaluate()` is intentionally NOT provided
   * because state is lost on reload.
   */
}

export const test = base.extend<{ app: PeptyTrackApp }>({
  app: ({ page }, use) => use(new PeptyTrackApp(page)),
});
