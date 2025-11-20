export async function waitForGameInit(page, timeout = 3000) {
    await page.waitForFunction(
        () => window.gameClient && window.gameClient.playerId && window.gameClient.networkManager && window.gameClient.networkManager.ws && window.gameClient.networkManager.ws.readyState === WebSocket.OPEN,
        { timeout }
    );
}

export async function getPlayerState(page) {
    return await page.evaluate(() => {
        const player = window.gameClient.gameState.players[window.gameClient.playerId];
        return player ? {
            id: player.id,
            x: player.x,
            y: player.y,
            angle: player.angle,
            health: player.health,
            alive: player.alive,
            ammo: player.ammo,
            weapon: player.weapon
        } : null;
    });
}

export async function startGame(page) {
    await page.click('#playBtn');
    await page.waitForTimeout(100);
}

export async function pressKeys(page, keys, durationMs = 200) {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    for (const key of keyArray) {
        await page.keyboard.down(key);
    }

    await page.waitForTimeout(durationMs);

    for (const key of keyArray) {
        await page.keyboard.up(key);
    }
}

export async function captureWebSocketMessages(page, messageType, action) {
    const varName = `_captured_${messageType}_${Date.now()}`;

    await page.evaluate(({ varName, messageType }) => {
        window[varName] = [];
        const originalSend = window.gameClient.networkManager.ws.send;

        window.gameClient.networkManager.ws.send = function (data) {
            try {
                const parsed = JSON.parse(data);

                if (messageType === 'all') {
                    window[varName].push(parsed);
                } else if (messageType === 'movement' && parsed.type === 'input' && (parsed.moveX !== 0 || parsed.moveY !== 0)) {
                    window[varName].push(parsed);
                } else if (messageType === 'shoot' && parsed.type === 'input' && parsed.shoot) {
                    window[varName].push(parsed);
                }
            } catch (e) { }

            return originalSend.apply(this, arguments);
        };
    }, { varName, messageType });

    await action();

    const messages = await page.evaluate(({ varName }) => {
        const msgs = window[varName] || [];
        delete window[varName];
        return msgs;
    }, { varName });

    return messages;
}

export function positionsChanged(pos1, pos2, precision = 1) {
    const factor = Math.pow(10, precision);
    const x1 = Math.round(pos1.x * factor) / factor;
    const y1 = Math.round(pos1.y * factor) / factor;
    const x2 = Math.round(pos2.x * factor) / factor;
    const y2 = Math.round(pos2.y * factor) / factor;

    return x1 !== x2 || y1 !== y2;
}

export function distance(pos1, pos2) {
    return Math.sqrt(
        Math.pow(pos2.x - pos1.x, 2) +
        Math.pow(pos2.y - pos1.y, 2)
    );
}

export async function setupGame(page) {
    await page.goto('/');
    await startGame(page);
    await waitForGameInit(page);
}

export async function getBullets(page) {
    return await page.evaluate(() => {
        return Object.values(window.gameClient.gameState.bullets).map(b => ({
            id: b.id,
            x: b.x,
            y: b.y,
            angle: b.angle,
            playerId: b.playerId,
            active: b.active
        }));
    });
}

export async function getPlayerBullets(page) {
    return await page.evaluate(() => {
        const bullets = Object.values(window.gameClient.gameState.bullets);
        return bullets.filter(b => b.playerId === window.gameClient.playerId);
    });
}
