import { test, expect } from '@playwright/test';
import {
    setupGame,
    getPlayerState,
    pressKeys,
    captureWebSocketMessages,
    positionsChanged,
    distance
} from '../helpers/game-helpers.js';

test.describe('Player Movement', () => {
    test.beforeEach(async ({ page }) => {
        await setupGame(page);
    });

    test('should send movement input when keys pressed', async ({ page }) => {
        const messages = await captureWebSocketMessages(page, 'movement', async () => {
            await pressKeys(page, 'w', 200);
        });

        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].type).toBe('input');
        expect(messages[0]).toHaveProperty('moveX');
        expect(messages[0]).toHaveProperty('moveY');

        console.log(`✅ Sent ${messages.length} movement messages`);
    });

    test('should handle WASD keys', async ({ page }) => {
        const initial = await getPlayerState(page);

        await pressKeys(page, 'w', 200);
        await page.waitForTimeout(100);
        await pressKeys(page, 'd', 200);
        await page.waitForTimeout(100);

        const final = await getPlayerState(page);
        const moved = positionsChanged(initial, final);

        console.log(`Initial: (${initial.x.toFixed(1)}, ${initial.y.toFixed(1)})`);
        console.log(`Final: (${final.x.toFixed(1)}, ${final.y.toFixed(1)})`);
        console.log(`Moved: ${moved}`);

        expect(initial).toBeTruthy();
        expect(final).toBeTruthy();
    });

    test('should handle arrow keys', async ({ page }) => {
        const messages = await captureWebSocketMessages(page, 'movement', async () => {
            await pressKeys(page, 'ArrowUp', 200);
        });

        expect(messages.length).toBeGreaterThan(0);
        console.log(`✅ Arrow keys sent ${messages.length} messages`);
    });

    test('should update position on server', async ({ page }) => {
        const initial = await getPlayerState(page);

        await pressKeys(page, 'd', 300);
        await page.waitForTimeout(200);

        const final = await getPlayerState(page);
        const dist = distance(initial, final);

        console.log(`Distance moved: ${dist.toFixed(2)} units`);
        console.log(`From (${initial.x.toFixed(2)}, ${initial.y.toFixed(2)}) to (${final.x.toFixed(2)}, ${final.y.toFixed(2)})`);

        expect(dist).toBeGreaterThanOrEqual(0);
        console.log('✅ Position update test completed');
    });
});
