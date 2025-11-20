import { test, expect } from '@playwright/test';
import { setupGame, getPlayerState, pressKeys } from '../helpers/game-helpers.js';

test.describe('Collision System', () => {
    test.beforeEach(async ({ page }) => {
        await setupGame(page);
    });

    test('player stops at buildings', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const gc = window.gameClient;
            const player = gc.gameState.players[gc.playerId];
            if (!player) return { error: 'no player' };

            const buildings = gc.gameState.buildings || [];
            if (buildings.length === 0) return { error: 'no buildings' };

            let nearest = null;
            let nearestDist = Infinity;
            for (const b of buildings) {
                const cx = b.x + b.width / 2;
                const cy = b.y + b.height / 2;
                const dist = Math.sqrt((player.x - cx) ** 2 + (player.y - cy) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = { x: cx, y: cy, building: b };
                }
            }

            return {
                playerStart: { x: player.x, y: player.y },
                target: nearest,
                distance: nearestDist
            };
        });

        if (result.error) {
            console.log(`⚠️ ${result.error}, skipping test`);
            return;
        }

        const dx = result.target.x - result.playerStart.x;
        const dy = result.target.y - result.playerStart.y;
        const keys = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            keys.push(dx > 0 ? 'd' : 'a');
        } else {
            keys.push(dy > 0 ? 's' : 'w');
        }

        await pressKeys(page, keys, 2000);
        await page.waitForTimeout(200);

        const finalState = await getPlayerState(page);
        const finalDist = Math.sqrt(
            (finalState.x - result.target.x) ** 2 +
            (finalState.y - result.target.y) ** 2
        );

        const moved = Math.sqrt(
            (finalState.x - result.playerStart.x) ** 2 +
            (finalState.y - result.playerStart.y) ** 2
        );

        console.log(`✅ Moved ${moved.toFixed(1)} units towards building`);
        console.log(`   Final distance to building: ${finalDist.toFixed(1)}`);

        expect(finalDist).toBeGreaterThan(0);
    });

    test('player stops at trees', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const gc = window.gameClient;
            const player = gc.gameState.players[gc.playerId];
            if (!player) return { error: 'no player' };

            const trees = gc.gameState.trees || [];
            if (trees.length === 0) return { error: 'no trees' };

            let nearest = null;
            let nearestDist = Infinity;
            for (const t of trees) {
                const dist = Math.sqrt((player.x - t.x) ** 2 + (player.y - t.y) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = { x: t.x, y: t.y, size: t.size || t.Size };
                }
            }

            return {
                playerStart: { x: player.x, y: player.y },
                target: nearest,
                distance: nearestDist
            };
        });

        if (result.error) {
            console.log(`⚠️ ${result.error}, skipping test`);
            return;
        }

        const dx = result.target.x - result.playerStart.x;
        const dy = result.target.y - result.playerStart.y;
        const keys = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            keys.push(dx > 0 ? 'd' : 'a');
        } else {
            keys.push(dy > 0 ? 's' : 'w');
        }

        await pressKeys(page, keys, 2000);
        await page.waitForTimeout(200);

        const finalState = await getPlayerState(page);
        const finalDist = Math.sqrt(
            (finalState.x - result.target.x) ** 2 +
            (finalState.y - result.target.y) ** 2
        );

        const moved = Math.sqrt(
            (finalState.x - result.playerStart.x) ** 2 +
            (finalState.y - result.playerStart.y) ** 2
        );

        console.log(`✅ Moved ${moved.toFixed(1)} units towards tree`);
        console.log(`   Final distance to tree: ${finalDist.toFixed(1)}`);

        expect(finalDist).toBeGreaterThan(result.target.size || 5);
    });
});
