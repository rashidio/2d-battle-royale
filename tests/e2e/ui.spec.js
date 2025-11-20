import { test, expect } from '@playwright/test';

test.describe('UI Elements', () => {
    test('should show debug toolbar when checkbox is checked', async ({ page }) => {
        await page.goto('/');
        const debugInitial = await page.locator('#debug');
        await expect(debugInitial).not.toBeVisible();

        console.log('✅ Debug toolbar hidden initially');
        const checkbox = page.locator('#debugCheckbox');
        await checkbox.check();
        await page.waitForTimeout(100);
        await page.click('#playBtn');
        await page.waitForTimeout(500);
        const debugAfter = page.locator('#debug');
        await expect(debugAfter).toBeVisible();

        console.log('✅ Debug toolbar visible after checking checkbox');
        const hasClass = await debugAfter.evaluate(el => el.classList.contains('debug-enabled'));
        expect(hasClass).toBe(true);

        console.log('✅ Debug toolbar has debug-enabled class');
    });

    test('should hide debug toolbar when checkbox is unchecked', async ({ page }) => {
        await page.goto('/');
        const checkbox = page.locator('#debugCheckbox');
        await checkbox.check();
        await page.waitForTimeout(50);
        await checkbox.uncheck();
        await page.waitForTimeout(50);
        await page.click('#playBtn');
        await page.waitForTimeout(500);
        const debug = page.locator('#debug');
        await expect(debug).not.toBeVisible();

        console.log('✅ Debug toolbar hidden when unchecked');
    });

    test('should persist debug setting in localStorage', async ({ page }) => {
        await page.goto('/');
        await page.locator('#debugCheckbox').check();
        await page.waitForTimeout(100);
        const stored = await page.evaluate(() => localStorage.getItem('debugEnabled'));
        expect(stored).toBe('true');

        console.log('✅ Debug setting saved to localStorage');
        await page.reload();
        await page.waitForTimeout(200);
        const checkbox = page.locator('#debugCheckbox');
        await expect(checkbox).toBeChecked();

        console.log('✅ Debug setting persisted after reload');
    });

    test('should show play button on menu screen', async ({ page }) => {
        await page.goto('/');

        const playBtn = page.locator('#playBtn');
        await expect(playBtn).toBeVisible();
        await expect(playBtn).toHaveText('Play');

        console.log('✅ Play button visible and has correct text');
    });

    test('should show player stats after starting game', async ({ page }) => {
        await page.goto('/');
        const stats = page.locator('#playerStats');
        await expect(stats).not.toBeVisible();
        await page.click('#playBtn');
        await page.waitForTimeout(1000);
        await expect(stats).toBeVisible();
        const health = page.locator('#health');
        const ammo = page.locator('#ammo');

        await expect(health).toBeVisible();
        await expect(ammo).toBeVisible();

        console.log('✅ Player stats visible after game start');
    });
});
