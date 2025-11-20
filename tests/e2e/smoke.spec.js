import { test, expect } from '@playwright/test';

test.describe('Smoke Test - Basic Game Load', () => {
    test('should load game without errors and play button works', async ({ page }) => {
        const consoleErrors = [];
        const consoleWarnings = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
            if (msg.type() === 'warning') {
                consoleWarnings.push(msg.text());
            }
        });
        const pageErrors = [];
        page.on('pageerror', error => {
            pageErrors.push(error.message);
        });
        await page.goto('/');
        await page.waitForTimeout(500);
        const playButton = page.locator('#playBtn');
        await expect(playButton).toBeVisible();
        expect(pageErrors.length, `Page errors found: ${pageErrors.join(', ')}`).toBe(0);
        await playButton.click();
        await page.waitForTimeout(1000);
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
        const gameExists = await page.evaluate(() => {
            return typeof window.gameClient !== 'undefined' && window.gameClient !== null;
        });
        expect(gameExists).toBe(true);
        const wsConnected = await page.waitForFunction(
            () => window.gameClient && window.gameClient.networkManager && window.gameClient.networkManager.ws && window.gameClient.networkManager.ws.readyState === WebSocket.OPEN,
            { timeout: 5000 }
        ).catch(() => false);

        expect(wsConnected, 'WebSocket should connect').toBeTruthy();
        expect(pageErrors.length, `Page errors: ${pageErrors.join(', ')}`).toBe(0);
        if (consoleErrors.length > 0) {
            console.log('⚠️  Console errors detected:', consoleErrors);
        }
        console.log('✅ Game loaded successfully, play button works, no errors!');
    });
});
