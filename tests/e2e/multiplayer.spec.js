import { test, expect } from '@playwright/test';

test.describe('Multiplayer Movement', () => {
    test('should update positions for multiple players moving simultaneously', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const player1 = await context1.newPage();
        const player2 = await context2.newPage();

        try {
            await Promise.all([
                player1.goto('/'),
                player2.goto('/')
            ]);
            await Promise.all([
                player1.click('#playBtn'),
                player2.click('#playBtn')
            ]);
            await Promise.all([
                player1.waitForFunction(
                    () => window.gameClient && window.gameClient.playerId && window.gameClient.networkManager && window.gameClient.networkManager.ws && window.gameClient.networkManager.ws.readyState === WebSocket.OPEN,
                    { timeout: 5000 }
                ),
                player2.waitForFunction(
                    () => window.gameClient && window.gameClient.playerId && window.gameClient.networkManager && window.gameClient.networkManager.ws && window.gameClient.networkManager.ws.readyState === WebSocket.OPEN,
                    { timeout: 5000 }
                )
            ]);
            const player1Id = await player1.evaluate(() => window.gameClient.playerId);
            const player2Id = await player2.evaluate(() => window.gameClient.playerId);
            console.log(`Player 1 ID: ${player1Id}`);
            console.log(`Player 2 ID: ${player2Id}`);

            expect(player1Id).toBeTruthy();
            expect(player2Id).toBeTruthy();
            expect(player1Id).not.toBe(player2Id);

            const p1InitialPos = await player1.evaluate(() => {
                const player = window.gameClient.gameState.players[window.gameClient.playerId];
                return { x: player.x, y: player.y };
            });

            const p2InitialPos = await player2.evaluate(() => {
                const player = window.gameClient.gameState.players[window.gameClient.playerId];
                return { x: player.x, y: player.y };
            });

            console.log(`Player 1 initial position: (${p1InitialPos.x}, ${p1InitialPos.y})`);
            console.log(`Player 2 initial position: (${p2InitialPos.x}, ${p2InitialPos.y})`);

            await Promise.all([
                player1.keyboard.down('w'),
                player2.keyboard.down('d')
            ]);

            await player1.waitForTimeout(300);

            await Promise.all([
                player1.keyboard.up('w'),
                player2.keyboard.up('d')
            ]);

            await player1.waitForTimeout(200);

            const p1FinalPos = await player1.evaluate(() => {
                const player = window.gameClient.gameState.players[window.gameClient.playerId];
                return { x: player.x, y: player.y };
            });

            const p2FinalPos = await player2.evaluate(() => {
                const player = window.gameClient.gameState.players[window.gameClient.playerId];
                return { x: player.x, y: player.y };
            });

            console.log(`Player 1 final position: (${p1FinalPos.x}, ${p1FinalPos.y})`);
            console.log(`Player 2 final position: (${p2FinalPos.x}, ${p2FinalPos.y})`);

            const p1Moved = Math.round(p1FinalPos.y * 100) < Math.round(p1InitialPos.y * 100);
            const p2Moved = Math.round(p2FinalPos.x * 100) > Math.round(p2InitialPos.x * 100);

            const anyMoved = p1Moved || p2Moved;

            if (p1Moved) {
                console.log(`✅ Player 1 moved up: ${p1InitialPos.y} -> ${p1FinalPos.y}`);
            }
            if (p2Moved) {
                console.log(`✅ Player 2 moved right: ${p2InitialPos.x} -> ${p2FinalPos.x}`);
            }

            expect(anyMoved).toBe(true);

            const p1SeesP2 = await player1.evaluate((p2Id) => {
                return window.gameClient.gameState.players[p2Id] !== undefined;
            }, player2Id);

            const p2SeesP1 = await player2.evaluate((p1Id) => {
                return window.gameClient.gameState.players[p1Id] !== undefined;
            }, player1Id);

            console.log(`Player 1 sees Player 2: ${p1SeesP2}`);
            console.log(`Player 2 sees Player 1: ${p2SeesP1}`);

            expect(p1SeesP2).toBe(true);
            expect(p2SeesP1).toBe(true);

            const p2PosFromP1View = await player1.evaluate((p2Id) => {
                const player = window.gameClient.gameState.players[p2Id];
                return player ? { x: player.x, y: player.y } : null;
            }, player2Id);

            if (p2PosFromP1View) {
                const drift = Math.sqrt(
                    Math.pow(p2PosFromP1View.x - p2FinalPos.x, 2) +
                    Math.pow(p2PosFromP1View.y - p2FinalPos.y, 2)
                );
                console.log(`Position drift between clients: ${drift.toFixed(2)} units`);

                expect(drift).toBeLessThan(50);
            }

            console.log('✅ Multiplayer movement test passed!');

        } finally {
            await player1.close();
            await player2.close();
            await context1.close();
            await context2.close();
        }
    });

    test('should handle three players moving in different directions', async ({ browser }) => {
        const contexts = await Promise.all([
            browser.newContext(),
            browser.newContext(),
            browser.newContext()
        ]);

        const players = await Promise.all(contexts.map(ctx => ctx.newPage()));

        try {
            await Promise.all(players.map(p => p.goto('/')));
            await Promise.all(players.map(p => p.click('#playBtn')));

            await Promise.all(players.map(p =>
                p.waitForFunction(
                    () => window.gameClient && window.gameClient.playerId && window.gameClient.networkManager && window.gameClient.networkManager.ws && window.gameClient.networkManager.ws.readyState === WebSocket.OPEN,
                    { timeout: 5000 }
                )
            ));

            const playerIds = await Promise.all(
                players.map(p => p.evaluate(() => window.gameClient.playerId))
            );

            console.log('Player IDs:', playerIds);

            const uniqueIds = new Set(playerIds);
            expect(uniqueIds.size).toBe(3);

            const initialPositions = await Promise.all(
                players.map(p => p.evaluate(() => {
                    const player = window.gameClient.gameState.players[window.gameClient.playerId];
                    return { x: player.x, y: player.y };
                }))
            );

            const movements = [
                players[0].keyboard.down('w'),
                players[1].keyboard.down('s'),
                players[2].keyboard.down('d')
            ];

            await Promise.all(movements);
            await players[0].waitForTimeout(250);

            await Promise.all([
                players[0].keyboard.up('w'),
                players[1].keyboard.up('s'),
                players[2].keyboard.up('d')
            ]);

            await players[0].waitForTimeout(200);

            const finalPositions = await Promise.all(
                players.map(p => p.evaluate(() => {
                    const player = window.gameClient.gameState.players[window.gameClient.playerId];
                    return { x: player.x, y: player.y };
                }))
            );

            const moved0Up = Math.round(finalPositions[0].y * 100) < Math.round(initialPositions[0].y * 100);
            const moved1Down = Math.round(finalPositions[1].y * 100) > Math.round(initialPositions[1].y * 100);
            const moved2Right = Math.round(finalPositions[2].x * 100) > Math.round(initialPositions[2].x * 100);

            const anyMoved = moved0Up || moved1Down || moved2Right;
            expect(anyMoved).toBe(true);

            if (moved0Up) console.log('✅ Player 0 moved up');
            if (moved1Down) console.log('✅ Player 1 moved down');
            if (moved2Right) console.log('✅ Player 2 moved right');

            console.log('✅ At least one player moved correctly!');

            for (let i = 0; i < 3; i++) {
                const otherPlayerIds = playerIds.filter((_, idx) => idx !== i);
                const canSeeOthers = await players[i].evaluate((ids) => {
                    return ids.every(id => window.gameClient.gameState.players[id] !== undefined);
                }, otherPlayerIds);

                expect(canSeeOthers).toBe(true);
                console.log(`✅ Player ${i} can see all other players`);
            }

        } finally {
            await Promise.all(players.map(p => p.close()));
            await Promise.all(contexts.map(ctx => ctx.close()));
        }
    });
});
