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

  test('Phase 3: Interactive Guidance Verification', async ({ page }) => {
    const checkErrors = attachConsoleErrorListener(page);
    await resetApp(page);
    await setLocalStorage(page, 'peptytrack-autobackup', SEED_BACKUP);
    await page.reload();
    await page.waitForTimeout(2000);

    // Trigger Restore
    const restoreBtn = page.locator('button:has-text("Restore"), button:has-text("Import"), button:has-text("Recover"), button:has-text("Yes"), button:has-text("Confirm")');
    if (await restoreBtn.first().isVisible({ timeout: 5000 })) {
      await restoreBtn.first().click();
      await page.waitForTimeout(2000); // Wait for restore
    }

    // --- Step 1: Virgin State Test / Settings ---
    // Assert "Target Mode" toggle section no longer exists
    await page.locator(`nav button span:text-is("Settings")`).click();
    await page.waitForTimeout(800);
    await expect(page.locator('text="Target Mode"')).toHaveCount(0);

    // --- Step 2 & 3: Log Dose Guidance Test & Help Box ---
    await page.locator(`nav button span:text-is("Log")`).click();
    await page.waitForTimeout(800);
    
    // Switch to Full Log to make sure dosage and vial UI is fully visible
    const fullLogBtn = page.locator('button:has-text("Full Log"), button:has-text("Full")').first();
    if (await fullLogBtn.isVisible()) {
      await fullLogBtn.click();
      await page.waitForTimeout(300);
    }

    // Select a vial
    const vialSelect = page.locator('select').nth(1); // Second select is vial (first is med)
    if (await vialSelect.isVisible()) {
      // Find a vial option with value != ""
      const options = await vialSelect.locator('option').all();
      if (options.length > 1) {
        const val = await options[1].getAttribute('value');
        await vialSelect.selectOption(val!);
      }
    }
    
    // Set dosage to trigger calculator
    const customBtn = page.locator('button:text-is("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
      await page.waitForTimeout(300);
    }
    const dosageInput = page.locator('input[type="number"]').first();
    if (await dosageInput.isVisible()) {
      await dosageInput.fill('2.5');
      await page.waitForTimeout(300);
    }

    // Verify syringe unit calculator ("units (U-100)") and its help button
    const syringeCalcText = page.locator('text=/units \\(U-100\\)/');
    await expect(syringeCalcText).toBeVisible({ timeout: 5000 });


    // Select Help Buttons by a more stable method
    const logDoseHelpBtns = page.locator('button[aria-expanded]');
    if (await logDoseHelpBtns.nth(0).isVisible()) {
      await logDoseHelpBtns.nth(0).click();
      await expect(logDoseHelpBtns.nth(0)).toHaveAttribute('aria-expanded', 'true');
      await page.waitForTimeout(300);
    }

    // --- Step 3: Help Box Interaction Tests on Dashboard, Vials, Charts ---
    await page.locator(`nav button span:text-is("Home")`).click();
    await page.waitForTimeout(800);
    const dashboardHelpBtns = page.locator('button[aria-expanded]');
    if (await dashboardHelpBtns.nth(0).isVisible()) {
      await dashboardHelpBtns.nth(0).click();
      await expect(dashboardHelpBtns.nth(0)).toHaveAttribute('aria-expanded', 'true');
    }

    await page.locator(`nav button span:text-is("Vials")`).click();
    await page.waitForTimeout(800);
    const vialsHelpBtns = page.locator('button[aria-expanded]');
    if (await vialsHelpBtns.nth(0).isVisible()) {
      await vialsHelpBtns.nth(0).click();
      await expect(vialsHelpBtns.nth(0)).toHaveAttribute('aria-expanded', 'true');
    }

    await page.locator(`nav button span:text-is("Chart")`).click();
    await page.waitForTimeout(800);
    const chartHelpBtns = page.locator('button[aria-expanded]');
    if (await chartHelpBtns.nth(0).isVisible()) {
      await chartHelpBtns.nth(0).click();
      await expect(chartHelpBtns.nth(0)).toHaveAttribute('aria-expanded', 'true');
    }

    checkErrors();
  });
});
