import { test, expect } from '@playwright/test';
import { setupGame, captureWebSocketMessages } from '../helpers/game-helpers.js';

test.describe('Input System', () => {
    test.beforeEach(async ({ page }) => {
        await setupGame(page);
    });
});

test.describe('Touch Input System', () => {
    test.use({
        hasTouch: true,
        viewport: { width: 390, height: 844 }
    });

    test.beforeEach(async ({ page }) => {
        await setupGame(page);
    });

    test('touch move joystick sends movement', async ({ page }) => {
        const moveCenterX = 100;
        const moveCenterY = 744;

        const messages = await captureWebSocketMessages(page, 'movement', async () => {
            const client = await page.context().newCDPSession(page);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchStart',
                touchPoints: [{ x: moveCenterX, y: moveCenterY, id: 1 }]
            });
            await page.waitForTimeout(50);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x: moveCenterX, y: moveCenterY - 60, id: 1 }]
            });
            await page.waitForTimeout(300);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchEnd',
                touchPoints: [{ x: moveCenterX, y: moveCenterY - 60, id: 1 }]
            });
        });

        expect(messages.length).toBeGreaterThan(0);
        console.log(`✅ Touch move sent ${messages.length} messages`);
    });

    test('simultaneous move and shoot', async ({ page }) => {
        const moveCenterX = 100;
        const moveCenterY = 744;
        const aimCenterX = 306;
        const aimCenterY = 760;

        const messages = await captureWebSocketMessages(page, 'all', async () => {
            const client = await page.context().newCDPSession(page);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchStart',
                touchPoints: [
                    { x: moveCenterX, y: moveCenterY, id: 1 },
                    { x: aimCenterX, y: aimCenterY, id: 2 }
                ]
            });
            await page.waitForTimeout(50);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [
                    { x: moveCenterX + 60, y: moveCenterY - 60, id: 1 },
                    { x: aimCenterX, y: aimCenterY - 55, id: 2 }
                ]
            });
            await page.waitForTimeout(500);

            await client.send('Input.dispatchTouchEvent', {
                type: 'touchEnd',
                touchPoints: [
                    { x: moveCenterX + 60, y: moveCenterY - 60, id: 1 },
                    { x: aimCenterX, y: aimCenterY - 55, id: 2 }
                ]
            });
        });

        const moveMessages = messages.filter(m => m.type === 'input' && (m.moveX !== 0 || m.moveY !== 0));
        const shootMessages = messages.filter(m => m.type === 'input' && m.shoot);

        console.log(`✅ Move: ${moveMessages.length}, Shoot: ${shootMessages.length}`);
        expect(moveMessages.length).toBeGreaterThan(0);
        expect(shootMessages.length).toBeGreaterThan(0);
    });
});
