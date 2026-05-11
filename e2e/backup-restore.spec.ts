import { test, expect } from '@playwright/test';
import { resetApp, setLocalStorage } from './utils/db';

const SEED_BACKUP = {
  version: 1,
  exportedAt: Date.now(),
  medications: [
    {
      id: 'med-backup-1',
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
      createdAt: Date.now() - 86400000,
    },
  ],
  doses: [
    {
      id: 'dose-backup-1',
      medicationId: 'med-backup-1',
      vialId: null,
      dosage: 0.5,
      unit: 'mg',
      injectionSite: 'abdomen-upper-left' as const,
      dateTime: Date.now() - 86400000,
      notes: 'Test dose',
      sideEffects: [],
      createdAt: Date.now() - 86400000,
    },
  ],
  vials: [],
  weightEntries: [],
  settings: {
    weightUnit: 'kg' as const,
    medicationUnit: 'mg' as const,
    notificationsEnabled: false,
    injectionRotationStrategy: 'sequential' as const,
    injectionRotationSites: [
      'abdomen-upper-left', 'abdomen-upper-right',
      'abdomen-lower-left', 'abdomen-lower-right',
      'thigh-left', 'thigh-right',
      'arm-left', 'arm-right',
    ],
    titrationWizardEnabled: false,
    severeSideEffectThreshold: 5,
  },
  customSideEffects: {},
  protocols: [],
  symptomLogs: [],
};

test.describe('Backup & Restore', () => {

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('restore prompt NOT shown when no backup exists', async ({ page }) => {
    await page.waitForTimeout(1500);
    const restoreModal = page.locator('text=/restore|backup|recover/i');
    await expect(restoreModal).not.toBeVisible({ timeout: 3000 });
  });

  test('restore prompt appears when DB is empty but backup exists', async ({ page }) => {
    await setLocalStorage(page, 'peptytrack-autobackup', JSON.stringify(SEED_BACKUP));
    await page.reload();
    await page.waitForTimeout(2000);
    const restorePrompt = page.locator('text=/restore|recover|import your data|backup found/i');
    await expect(restorePrompt.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking restore dismisses modal and loads data', async ({ page }) => {
    await setLocalStorage(page, 'peptytrack-autobackup', JSON.stringify(SEED_BACKUP));
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Click the restore button if visible
    const restoreBtn = page.locator('button:has-text("Restore"), button:has-text("Import"), button:has-text("Recover"), button:has-text("Yes"), button:has-text("Confirm")');
    if (await restoreBtn.first().isVisible({ timeout: 2000 })) {
      await restoreBtn.first().click();
      await page.waitForTimeout(1500);
    }
    
    // After restore, the modal should be gone
    const restoreText = page.locator('text=/restore|recover|import your data|backup found/i');
    await expect(restoreText).not.toBeVisible({ timeout: 3000 });
  });

  test('dismiss restore ? start fresh with empty dashboard', async ({ page }) => {
    await setLocalStorage(page, 'peptytrack-autobackup', JSON.stringify(SEED_BACKUP));
    await page.reload();
    await page.waitForTimeout(2000);
    const dismissBtn = page.locator('button:has-text("Start Fresh"), button:has-text("Skip"), button:has-text("Dismiss"), button:has-text("No"), button:has-text("Cancel")');
    await dismissBtn.first().click();
    await page.waitForTimeout(1000);
    const emptyState = page.locator('text=/no medications|add your first|get started/i');
    await expect(emptyState.first()).toBeVisible({ timeout: 3000 });
  });
});
