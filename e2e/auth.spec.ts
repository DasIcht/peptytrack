import { test, expect } from '@playwright/test';

/**
 * Auth tests — app initialization checks.
 * Uses robust selectors based on actual BottomNav.tsx implementation.
 */
test.describe('Auth — App Initialization', () => {

  test('loads without crash — no blank screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('shows bottom navigation with all 7 tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // BottomNav renders icon+label buttons (see BottomNav.tsx NAV_ITEMS)
    await expect(page.locator('nav button span:text-is("Home")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Log")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Chart")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Weight")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Meds")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Vials")')).toBeVisible();
    await expect(page.locator('nav button span:text-is("Settings")')).toBeVisible();
  });

  test('defaults to dashboard page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('navigating to each tab renders a page heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Get all nav buttons by their span text labels
    const tabLabels = ['Home', 'Log', 'Chart', 'Weight', 'Meds', 'Vials', 'Settings'];
    for (const label of tabLabels) {
      await page.locator(`nav button span:text-is("${label}")`).click();
      await page.waitForTimeout(400);
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });

  test('empty state — no medications shows onboarding prompt', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('nav button span:text-is("Meds")').click();
    await page.waitForTimeout(600);
    // Match actual UI text: "Add a medication" button
    const onboardingPrompt = page.locator('button:has-text("Add a medication"), button:has-text("Add medication")');
    await expect(onboardingPrompt.first()).toBeVisible({ timeout: 5000 });
  });
});
