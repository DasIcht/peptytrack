import { test, expect } from '@playwright/test';
import { resetApp, setLocalStorage } from './utils/db';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_DATA_PATH = path.join(process.cwd(), 'sample data/peptytrack-backup-2026-05-30.json');
const rawData = fs.readFileSync(SAMPLE_DATA_PATH, 'utf-8');
const SEED_BACKUP = JSON.parse(rawData);

// Utility to attach console listeners and fail on error
function attachConsoleErrorListener(page) {
  const errors: string[] = [];
  page.on('pageerror', (exception) => {
    errors.push(`Uncaught exception: "${exception}"`);
  });
  page.on('console', (msg) => {
    // Ignore benign warnings, we only care about real errors
    if (msg.type() === 'error') {
      errors.push(`Console error: "${msg.text()}"`);
    }
  });
  return () => {
    if (errors.length > 0) {
      throw new Error(`Browser errors detected:\n${errors.join('\n')}`);
    }
  };
}

test.describe('Comprehensive GUI Verification', () => {

  test('Phase 1: Virgin State Verification', async ({ page }) => {
    const checkErrors = attachConsoleErrorListener(page);
    await resetApp(page);
    
    // Let the dashboard settle
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `playwright-report/screenshots/virgin-dashboard.png`, fullPage: true });
    
    const pages = ['Log', 'Chart', 'Weight', 'Meds', 'Vials', 'Settings'];
    
    for (const p of pages) {
      await page.locator(`nav button span:text-is("${p}")`).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `playwright-report/screenshots/virgin-${p.toLowerCase()}.png`, fullPage: true });
    }
    
    checkErrors();
  });

  test('Phase 2: Full Data Restoration & Navigation', async ({ page }) => {
    const checkErrors = attachConsoleErrorListener(page);
    
    await resetApp(page);

    // The setLocalStorage in utils/db.ts stringifies the value
    await setLocalStorage(page, 'peptytrack-autobackup', SEED_BACKUP);
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Trigger Restore
    const restoreBtn = page.locator('button:has-text("Restore"), button:has-text("Import"), button:has-text("Recover"), button:has-text("Yes"), button:has-text("Confirm")');
    if (await restoreBtn.first().isVisible({ timeout: 5000 })) {
      await restoreBtn.first().click();
      await page.waitForTimeout(2000); // Wait for restore to complete
    }
    
    // We should be on Dashboard after restore
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `playwright-report/screenshots/restored-dashboard.png`, fullPage: true });

    const pages = ['Log', 'Chart', 'Weight', 'Meds', 'Vials', 'Settings'];
    
    for (const p of pages) {
      await page.locator(`nav button span:text-is("${p}")`).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `playwright-report/screenshots/restored-${p.toLowerCase()}.png`, fullPage: true });
    }
    
    checkErrors();
  });
});
