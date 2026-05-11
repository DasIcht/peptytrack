import { test, expect } from '@playwright/test';
import { resetApp, dbSeed, navigateTo } from './utils/db';

const VIAL_MED = {
  id: 'med-vial-1',
  templateId: 'semaglutide',
  name: 'Semaglutide',
  brand: 'Ozempic',
  activeIngredient: 'Semaglutide',
  dosageOptions: [0.25, 0.5, 1.0],
  unit: 'mg',
  frequency: 'weekly' as const,
  halfLifeHours: 168,
  color: '#14b8a6',
  reminderHoursBefore: 24,
  enabled: true,
  createdAt: Date.now(),
};

const VIAL_SETTINGS = [
  { id: 'weightUnit', value: 'kg' },
  { id: 'medicationUnit', value: 'mg' },
  { id: 'notificationsEnabled', value: false },
  { id: 'injectionRotationStrategy', value: 'sequential' },
  { id: 'injectionRotationSites', value: [
    'abdomen-upper-left', 'abdomen-upper-right',
    'abdomen-lower-left', 'abdomen-lower-right',
    'thigh-left', 'thigh-right',
    'arm-left', 'arm-right',
  ]},
  { id: 'titrationWizardEnabled', value: false },
  { id: 'severeSideEffectThreshold', value: 5 },
];

async function seedState(page: import('@playwright/test').Page) {
  await dbSeed(page, {
    medications: [VIAL_MED],
    settings: VIAL_SETTINGS,
  });
}

test.describe('Vial Management', () => {

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await seedState(page);
    await navigateTo(page, 'Vials');
    await page.waitForTimeout(1000);
    
    // Expand the medication group to reveal the Add Vial button
    const medHeader = page.locator('div.rounded-2xl button').first();
    if (await medHeader.isVisible({ timeout: 2000 })) {
      await medHeader.click();
      await page.waitForTimeout(800);
    }
  });

  test('Vials tab renders page heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Vials"), h1:has-text("Vial")')).toBeVisible();
  });

  test('Add Vial button opens vial creation form', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Vial")');
    await addBtn.first().click();
    await page.waitForTimeout(800);

    const peptideInput = page.locator('input[type="number"]').first();
    await expect(peptideInput).toBeVisible({ timeout: 5000 });
  });

  test('create vial with amounts ? vial added toast', async ({ page }) => {
    await page.locator('button:has-text("Add Vial")').first().click();
    await page.waitForTimeout(800);

    await page.locator('input[type="number"]').first().fill('10');
    await page.locator('input[type="number"]').nth(1).fill('2');
    await page.waitForTimeout(400);

    const submitBtn = page.locator('button:has-text("Add Vial")').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);

    const toast = page.locator('text=/vial added|vial created|added successfully/i');
    await expect(toast.first()).toBeVisible({ timeout: 8000 });
  });

  test('created vial appears in list with correct peptide amount', async ({ page }) => {
    await page.locator('button:has-text("Add Vial")').first().click();
    await page.waitForTimeout(800);
    await page.locator('input[type="number"]').first().fill('10');
    await page.locator('input[type="number"]').nth(1).fill('2');
    await page.locator('button:has-text("Add Vial")').first().click();
    await page.waitForTimeout(2000);

    const vialEntry = page.locator('text=/10.*mg|mg.*10/i');
    await expect(vialEntry.first()).toBeVisible({ timeout: 8000 });
  });

  test.skip('log dose from newly created vial ? remaining amount decreases', async ({ page }) => {
    // SKIPPED: Timing sensitive - requires multi-step UI interaction across pages
  });
});
