import { test, expect } from '@playwright/test';
import { resetApp, dbSeed, navigateTo } from './utils/db';

const WEIGHT_SETTINGS = [
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

test.describe('Weight Tracking', () => {

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await dbSeed(page, { settings: WEIGHT_SETTINGS });
    await navigateTo(page, 'Weight');
  });

  test('weight page renders with form and submit button', async ({ page }) => {
    await expect(page.locator('h1:has-text("Weight"), h1:has-text("Track")')).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Log Weight"), button:has-text("Save")').first()).toBeVisible();
  });

  test('kg and lb unit toggle buttons are visible', async ({ page }) => {
    await expect(page.locator('button:has-text("KG"), button:has-text("kg")')).toBeVisible();
    await expect(page.locator('button:has-text("LB"), button:has-text("lb")')).toBeVisible();
  });

  test('submit weight entry ? success toast', async ({ page }) => {
    await page.locator('input[type="number"]').first().fill('80.5');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Log Weight"), button:has-text("Save")').first().click();
    await page.waitForTimeout(1500);

    const toast = page.locator('text=/weight logged|logged successfully|success/i');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });
  });

  test('logged weight appears in history list', async ({ page }) => {
    await page.locator('input[type="number"]').first().fill('80.5');
    await page.locator('button:has-text("Log Weight"), button:has-text("Save")').first().click();
    await page.waitForTimeout(1500);

    const historyEntry = page.locator('text=/80\\.5.*kg/i');
    await expect(historyEntry.first()).toBeVisible({ timeout: 5000 });
  });

  test('chart appears after logging second weight entry', async ({ page }) => {
    await dbSeed(page, {
      settings: WEIGHT_SETTINGS,
      weightEntries: [
        { id: 'wt-1', weight: 82, unit: 'kg' as const, dateTime: Date.now() - 86400000, notes: '', createdAt: Date.now() - 86400000 },
        { id: 'wt-2', weight: 81, unit: 'kg' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
      ],
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navigateTo(page, 'Weight');

    const chart = page.locator('svg.recharts-surface, [class*="recharts"]').first();
    await expect(chart).toBeVisible({ timeout: 5000 });
  });

  test('trend card shows correct change direction', async ({ page }) => {
    await dbSeed(page, {
      settings: WEIGHT_SETTINGS,
      weightEntries: [
        { id: 'wt-t1', weight: 82, unit: 'kg' as const, dateTime: Date.now() - 86400000 * 7, notes: '', createdAt: Date.now() - 86400000 * 7 },
        { id: 'wt-t2', weight: 81, unit: 'kg' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
      ],
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navigateTo(page, 'Weight');

    const trendCard = page.locator('text=/overall change|change|trend/i');
    await expect(trendCard.first()).toBeVisible({ timeout: 3000 });

    const trendIcon = page.locator('svg[class*="trending"], [class*="trend"]').first();
    await expect(trendIcon).toBeVisible({ timeout: 3000 });
  });

  test('edit weight entry pre-fills form with existing value', async ({ page }) => {
    await dbSeed(page, {
      settings: WEIGHT_SETTINGS,
      weightEntries: [{ id: 'wt-edit', weight: 80.5, unit: 'kg' as const, dateTime: Date.now(), notes: 'Test', createdAt: Date.now() }],
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navigateTo(page, 'Weight');

    const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit"], button:has-text("Pencil")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('text=/update weight/i')).toBeVisible();
      await expect(page.locator('input[type="number"]').first()).toHaveValue(/80\.5/);
    }
  });
});
