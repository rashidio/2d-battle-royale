import * as PIXI from 'pixi.js';
import { normalizeAngle, trimMap, destroyAndClearCache } from '../utils.js';

const MAX_ENEMY_STATES = 50;
const MAX_GRAPHICS_CACHE = 50;

export class PlayerRenderer {
    constructor(playersContainer) {
        this.playersContainer = playersContainer;
        this.playerGraphicsCache = new Map();
        this.activePlayerIds = new Set();
        this.enemyPreviousStates = new Map();
        this.lastEnemyRenderPositions = new Map();
        this.lastPlayerAngles = new Map();
        this.lastPlayerHealth = new Map();
        this.playerHitAnimations = new Map();
        this.playerDisplayNames = new Map();
    }

    render(gameState, playerId, clientPrediction, viewport, deltaTime, renderStats) {
        if (!this.playersContainer) return;
        
        const renderNow = performance.now();
        const { viewLeft, viewRight, viewTop, viewBottom } = viewport;

        this.activePlayerIds.clear();

        let playersVisible = 0;
        let playersTotal = 0;

        if (!gameState || !gameState.players) return;

        for (const playerIdKey in gameState.players) {
            playersTotal++;
            const playerData = gameState.players[playerIdKey];
            if (!playerData || !playerData.alive) continue;

            const isMyPlayer = playerIdKey === playerId;

            const { renderX, renderY, renderAngle } = this.calculateRenderPosition(
                playerIdKey,
                playerData,
                isMyPlayer,
                clientPrediction,
                deltaTime
            );

            const isInViewport = renderX >= viewLeft && renderX <= viewRight && renderY >= viewTop && renderY <= viewBottom;
            if (!isInViewport && !isMyPlayer) {
                continue;
            }

            playersVisible++;
            this.activePlayerIds.add(playerIdKey);

            let playerContainer = this.playerGraphicsCache.get(playerIdKey);
            if (!playerContainer) {
                playerContainer = this.createPlayerGraphics(playerIdKey, isMyPlayer);
                this.playerGraphicsCache.set(playerIdKey, playerContainer);
                this.playersContainer.addChild(playerContainer);
            }

            playerContainer.visible = true;
            this.updatePlayerPosition(playerContainer, renderX, renderY, renderAngle, playerIdKey);
            this.updatePlayerHealth(playerContainer, playerData, playerIdKey, renderNow, isMyPlayer);
            this.updateHitAnimation(playerContainer, playerIdKey, renderNow);
        }

        this.updateVisibility();

        if (renderStats) {
            renderStats.playersVisible = playersVisible;
            renderStats.playersTotal = playersTotal;
        }
    }

    calculateRenderPosition(playerIdKey, playerData, isMyPlayer, clientPrediction, deltaTime) {
        let renderX = playerData.x;
        let renderY = playerData.y;
        let renderAngle = playerData.angle;

        if (isMyPlayer && clientPrediction.x !== null && clientPrediction.y !== null) {
            renderX = clientPrediction.x;
            renderY = clientPrediction.y;
            renderAngle = clientPrediction.angle !== undefined ? clientPrediction.angle : playerData.angle;
        } else if (!isMyPlayer) {
            const enemyState = this.enemyPreviousStates.get(playerIdKey);
            const lastPos = this.lastEnemyRenderPositions.get(playerIdKey);
            const frameDelta = Math.min(deltaTime || 0.016, 0.05);

            if (lastPos) {
                const dx = playerData.x - lastPos.x;
                const dy = playerData.y - lastPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const smoothingTime = 0.03;
                const smoothingFactor = Math.min(1.0, frameDelta / smoothingTime);

                if (distance > 0.01) {
                    renderX = lastPos.x + dx * smoothingFactor;
                    renderY = lastPos.y + dy * smoothingFactor;
                } else {
                    renderX = playerData.x;
                    renderY = playerData.y;
                }

                const angleDiff = normalizeAngle(playerData.angle - lastPos.angle);
                const angleSmoothingTime = 0.02;
                const angleSmoothingFactor = Math.min(1.0, frameDelta / angleSmoothingTime);
                renderAngle = lastPos.angle + angleDiff * angleSmoothingFactor;
            } else {
                renderX = playerData.x;
                renderY = playerData.y;
                renderAngle = playerData.angle;
            }

            let enemyPosObj = this.lastEnemyRenderPositions.get(playerIdKey);
            if (!enemyPosObj) {
                enemyPosObj = { x: 0, y: 0, angle: 0 };
                this.lastEnemyRenderPositions.set(playerIdKey, enemyPosObj);
            }
            enemyPosObj.x = renderX;
            enemyPosObj.y = renderY;
            enemyPosObj.angle = renderAngle;
        }

        return { renderX, renderY, renderAngle };
    }

    createPlayerGraphics(playerIdKey, isMyPlayer) {
        const playerContainer = new PIXI.Container();
        playerContainer.visible = true;
        const bodyColor = isMyPlayer ? 0x00FF00 : 0x4169E1;
        const headColor = isMyPlayer ? 0x00CC00 : 0x1E90FF;

        const silhouette = new PIXI.Graphics();
        silhouette.lineStyle(4, 0xFFFFFF, 1.0);
        silhouette.drawRect(-9, -7, 18, 14);
        silhouette.drawCircle(0, -10, 7);
        silhouette.lineStyle(0);
        playerContainer.addChild(silhouette);

        const body = new PIXI.Graphics();
        body.beginFill(bodyColor);
        body.drawRect(-8, -6, 16, 12);
        body.endFill();
        body.lineStyle(2, 0xFFFFFF);
        body.drawRect(-8, -6, 16, 12);
        body.lineStyle(0);
        playerContainer.addChild(body);

        const head = new PIXI.Graphics();
        head.beginFill(headColor);
        head.drawCircle(0, -10, 6);
        head.endFill();
        head.lineStyle(2, 0xFFFFFF);
        head.drawCircle(0, -10, 6);
        head.lineStyle(0);
        playerContainer.addChild(head);

        const gun = new PIXI.Graphics();
        gun.lineStyle(3, 0x654321);
        gun.moveTo(0, 0);
        gun.lineTo(18, 0);
        playerContainer.addChild(gun);

        const healthBarBg = new PIXI.Graphics();
        healthBarBg.beginFill(0x000000);
        healthBarBg.drawRect(-15, -22, 30, 4);
        healthBarBg.endFill();
        playerContainer.addChild(healthBarBg);

        const healthBar = new PIXI.Graphics();
        playerContainer.addChild(healthBar);

        if (!isMyPlayer) {
            let displayName = this.playerDisplayNames.get(playerIdKey);
            if (!displayName) {
                if (playerIdKey.startsWith('enemy_')) {
                    displayName = `Bot${playerIdKey.substring(6)}`;
                } else {
                    displayName = `P${playerIdKey.slice(-3)}`;
                }
                this.playerDisplayNames.set(playerIdKey, displayName);
            }

            const nameText = new PIXI.Text(displayName, {
                fontSize: 9,
                fill: 0xFFFFFF,
                stroke: 0x000000,
                strokeThickness: 2
            });
            nameText.anchor.set(0.5);
            nameText.y = -28;
            playerContainer.addChild(nameText);
        }

        return playerContainer;
    }

    updatePlayerPosition(playerContainer, renderX, renderY, renderAngle, playerIdKey) {
        playerContainer.x = renderX;
        playerContainer.y = renderY;

        const lastAngle = this.lastPlayerAngles.get(playerIdKey);
        if (lastAngle !== renderAngle) {
            const gun = playerContainer.children[3];
            gun.rotation = renderAngle;
            this.lastPlayerAngles.set(playerIdKey, renderAngle);
        }
    }

    updatePlayerHealth(playerContainer, playerData, playerIdKey, renderNow, isMyPlayer) {
        const lastHealth = this.lastPlayerHealth.get(playerIdKey);
        if (lastHealth !== playerData.health) {
            if (lastHealth !== undefined && lastHealth > playerData.health) {
                this.playerHitAnimations.set(playerIdKey, renderNow);
                if (isMyPlayer && navigator.vibrate) {
                    navigator.vibrate([50, 30, 50]);
                }
            }

            const healthBar = playerContainer.children[5];
            const playerHealth = playerData.health;
            const maxHealth = 1000;

            const healthPercent = Math.min(playerHealth / maxHealth, 1.0);
            const healthColor = healthPercent > 0.5 ? 0x00FF00 : healthPercent > 0.25 ? 0xFFFF00 : 0xFF0000;

            healthBar.clear();
            healthBar.beginFill(healthColor);
            healthBar.drawRect(-15, -22, 30 * healthPercent, 4);
            healthBar.endFill();

            this.lastPlayerHealth.set(playerIdKey, playerData.health);
        }
    }

    updateHitAnimation(playerContainer, playerIdKey, renderNow) {
        const hitStartTime = this.playerHitAnimations.get(playerIdKey);
        if (hitStartTime) {
            const hitDuration = 250;
            const elapsed = renderNow - hitStartTime;
            if (elapsed < hitDuration) {
                const flashCycle = 50;
                const cycle = Math.floor(elapsed / flashCycle) % 4;
                const isRed = cycle === 0 || cycle === 2;

                const body = playerContainer.children[1];
                const head = playerContainer.children[2];

                body.tint = isRed ? 0xFF0000 : 0xFFFFFF;
                head.tint = isRed ? 0xFF0000 : 0xFFFFFF;
            } else {
                this.playerHitAnimations.delete(playerIdKey);

                const body = playerContainer.children[1];
                const head = playerContainer.children[2];

                body.tint = 0xFFFFFF;
                head.tint = 0xFFFFFF;
            }
        }
    }

    updateVisibility() {
        for (const [playerId, container] of this.playerGraphicsCache) {
            container.visible = this.activePlayerIds.has(playerId);
        }
    }

    removePlayer(playerId) {
        const graphics = this.playerGraphicsCache.get(playerId);
        if (graphics && graphics.parent) {
            graphics.parent.removeChild(graphics);
        }
        this.playerGraphicsCache.delete(playerId);
        this.lastPlayerAngles.delete(playerId);
        this.lastPlayerHealth.delete(playerId);
        this.playerDisplayNames.delete(playerId);
        this.enemyPreviousStates.delete(playerId);
        this.lastEnemyRenderPositions.delete(playerId);
        this.activePlayerIds.delete(playerId);
    }

    updateEnemyState(playerId, state) {
        this.enemyPreviousStates.set(playerId, state);
    }

    trimCache() {
        trimMap(this.enemyPreviousStates, MAX_ENEMY_STATES);
        trimMap(this.lastEnemyRenderPositions, MAX_ENEMY_STATES);

        if (this.playerGraphicsCache.size > MAX_GRAPHICS_CACHE) {
            const inactivePlayers = [];
            for (const [playerId] of this.playerGraphicsCache) {
                if (!this.activePlayerIds.has(playerId)) {
                    inactivePlayers.push(playerId);
                }
            }
            for (const playerId of inactivePlayers.slice(0, Math.floor(MAX_GRAPHICS_CACHE * 0.5))) {
                this.removePlayer(playerId);
            }
        }
    }

    cleanup() {
        destroyAndClearCache(this.playerGraphicsCache);
        this.enemyPreviousStates.clear();
        this.lastEnemyRenderPositions.clear();
        this.lastPlayerAngles.clear();
        this.lastPlayerHealth.clear();
        this.playerHitAnimations.clear();
        this.playerDisplayNames.clear();
        this.activePlayerIds.clear();
    }
}

