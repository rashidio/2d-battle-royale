export class StateManager {
    constructor(game) {
        this.game = game;
    }

    getBulletHitPosition(bulletId, bullet, currentBullet) {
        const prevPos = this.game.bulletRenderer.previousBulletPositions.get(bulletId);
        const prevState = this.game.bulletRenderer.bulletPreviousStates.get(bulletId);

        let hitX = null;
        let hitY = null;

        if (bullet && bullet.x !== undefined && bullet.y !== undefined) {
            hitX = bullet.x;
            hitY = bullet.y;
        } else if (currentBullet && currentBullet.x !== undefined && currentBullet.y !== undefined) {
            hitX = currentBullet.x;
            hitY = currentBullet.y;
        } else if (prevPos && prevPos.x !== undefined && prevPos.y !== undefined) {
            hitX = prevPos.x;
            hitY = prevPos.y;
        } else if (prevState) {
            hitX = prevState.nextX || prevState.x;
            hitY = prevState.nextY || prevState.y;
        }

        if (hitX !== null && hitY !== null && !isNaN(hitX) && !isNaN(hitY)) {
            return { x: hitX, y: hitY };
        }
        return null;
    }

    createInterpolationState(current, previous, now) {
        const TELEPORT_THRESHOLD_SQ = 200 * 200;

        if (previous && previous.nextTime) {
            const dx = current.x - previous.nextX;
            const dy = current.y - previous.nextY;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq > TELEPORT_THRESHOLD_SQ) {
                return {
                    x: current.x,
                    y: current.y,
                    angle: current.angle,
                    time: now,
                    nextX: current.x,
                    nextY: current.y,
                    nextAngle: current.angle,
                    nextTime: now
                };
            } else {
                return {
                    x: previous.nextX,
                    y: previous.nextY,
                    angle: previous.nextAngle,
                    time: previous.nextTime,
                    nextX: current.x,
                    nextY: current.y,
                    nextAngle: current.angle,
                    nextTime: now
                };
            }
        } else {
            return {
                x: current.x,
                y: current.y,
                angle: current.angle,
                time: now,
                nextX: current.x,
                nextY: current.y,
                nextAngle: current.angle,
                nextTime: now
            };
        }
    }

    ensureStateStructure(state) {
        state.players = state.players || {};
        state.bullets = state.bullets || {};
        state.ammoPickups = state.ammoPickups || {};
        state.weaponPickups = state.weaponPickups || {};
        state.healthPickups = state.healthPickups || {};
        return state;
    }

    applyStateDiff(diff) {
        if (!diff) return;

        this.ensureStateStructure(this.game.gameState);

        if (diff.players) {
            for (const [id, player] of Object.entries(diff.players)) {
                this.game.gameState.players[id] = player;
            }
        }

        if (diff.removedPlayers) {
            for (const id of diff.removedPlayers) {
                delete this.game.gameState.players[id];
                this.game.playerRenderer.removePlayer(id);
            }
        }

        if (diff.bullets) {
            for (const [id, bullet] of Object.entries(diff.bullets)) {
                const isActive = bullet.active;
                if (!isActive) {
                    const currentBullet = this.game.gameState.bullets[id];
                    const hitPos = this.getBulletHitPosition(id, bullet, currentBullet);
                    if (hitPos) {
                        this.game.checkBulletHitOnDestroy(hitPos.x, hitPos.y, id);
                    }

                    delete this.game.gameState.bullets[id];
                    this.game.bulletRenderer.removeBullet(id);
                } else {
                    this.game.gameState.bullets[id] = bullet;
                }
            }
        }

        if (diff.removedBullets) {
            for (const id of diff.removedBullets) {
                const currentBullet = this.game.gameState.bullets[id];
                const hitPos = this.getBulletHitPosition(id, null, currentBullet);
                if (hitPos) {
                    this.game.checkBulletHitOnDestroy(hitPos.x, hitPos.y, id);
                }

                delete this.game.gameState.bullets[id];
                this.game.bulletRenderer.removeBullet(id);
            }
        }

        if (diff.ammoPickups) {
            for (const [id, ammo] of Object.entries(diff.ammoPickups)) {
                this.game.gameState.ammoPickups[id] = ammo;
            }
        }

        if (diff.removedAmmo) {
            for (const id of diff.removedAmmo) {
                delete this.game.gameState.ammoPickups[id];
            }
        }

        if (diff.weaponPickups) {
            for (const [id, weapon] of Object.entries(diff.weaponPickups)) {
                this.game.gameState.weaponPickups[id] = weapon;
            }
        }

        if (diff.removedWeapons) {
            for (const id of diff.removedWeapons) {
                delete this.game.gameState.weaponPickups[id];
            }
        }

        if (diff.healthPickups) {
            for (const [id, health] of Object.entries(diff.healthPickups)) {
                this.game.gameState.healthPickups[id] = health;
            }
        }

        if (diff.removedHealth) {
            for (const id of diff.removedHealth) {
                delete this.game.gameState.healthPickups[id];
            }
        }

        if (diff.zoneCenter !== undefined) {
            this.game.gameState.zoneCenter = diff.zoneCenter;
        }
        if (diff.zoneRadius !== undefined) {
            this.game.gameState.zoneRadius = diff.zoneRadius;
        }
        if (diff.gameTime !== undefined) {
            this.game.gameState.gameTime = diff.gameTime;
        }
        if (diff.phase !== undefined) {
            this.game.gameState.phase = diff.phase;
        }
        if (diff.winner !== undefined) {
            this.game.gameState.winner = diff.winner;
        }

        this.updateGameState(this.game.gameState);
    }

    updateGameState(state) {
        if (!state) {
            console.error('[updateGameState] Received null/undefined state');
            return;
        }

        const HARD_SNAP_THRESHOLD_SQ = 30.0 * 30.0;
        const SMOOTH_CORRECTION_THRESHOLD_SQ = 20.0 * 20.0;

        const updateStart = performance.now();
        const now = Date.now();

        if (this.game.lastServerTime > 0) {
            this.game.serverStates.set(now, state);

            const maxAge = 200;
            for (const [time] of this.game.serverStates) {
                if (now - time > maxAge) {
                    this.game.serverStates.delete(time);
                }
            }
        }
        this.game.lastServerTime = now;

        this.ensureStateStructure(state);

        const existingBuildings = this.game.gameState.buildings ?? [];
        const existingTrees = this.game.gameState.trees ?? [];
        const incomingBuildings = state.buildings ?? [];
        const incomingTrees = state.trees ?? [];
        
        const stateBuildings = incomingBuildings.length > 0 ? incomingBuildings : existingBuildings;
        const stateTrees = incomingTrees.length > 0 ? incomingTrees : existingTrees;

        const wasFirstTime = !this.game.gameState.buildings?.length;
        const oldBuildingsCount = this.game.gameState.buildings?.length ?? 0;
        const oldTreesCount = this.game.gameState.trees?.length ?? 0;
        const oldPhase = this.game.gameState.phase;

        if (this.game.playerId && state.players[this.game.playerId]) {
            const serverPlayer = state.players[this.game.playerId];

            if (this.game.clientPrediction.x === null || this.game.clientPrediction.y === null) {
                this.game.clientPrediction.x = serverPlayer.x;
                this.game.clientPrediction.y = serverPlayer.y;
                this.game.clientPrediction.angle = serverPlayer.angle;
                this.game.pendingInputs = [];
                this.game.lastAcknowledgedInputId = -1;
            } else {
                if (serverPlayer.angle !== undefined && serverPlayer.angle !== null) {
                    this.game.clientPrediction.angle = serverPlayer.angle;
                }

                const dx = this.game.clientPrediction.x - serverPlayer.x;
                const dy = this.game.clientPrediction.y - serverPlayer.y;
                const errorSq = dx * dx + dy * dy;

                if (errorSq > HARD_SNAP_THRESHOLD_SQ) {
                    this.game.clientPrediction.x = serverPlayer.x;
                    this.game.clientPrediction.y = serverPlayer.y;
                    this.game.pendingInputs = [];
                    this.game.lastAcknowledgedInputId = -1;
                } else if (errorSq > SMOOTH_CORRECTION_THRESHOLD_SQ) {
                    const correction = 0.2;
                    this.game.clientPrediction.x += (serverPlayer.x - this.game.clientPrediction.x) * correction;
                    this.game.clientPrediction.y += (serverPlayer.y - this.game.clientPrediction.y) * correction;
                }
            }

            this.game.lastServerPos.x = serverPlayer.x;
            this.game.lastServerPos.y = serverPlayer.y;
        }

        for (const playerId in state.players) {
            if (playerId === this.game.playerId) continue;

            const currentPlayer = state.players[playerId];
            if (!currentPlayer || !currentPlayer.alive) {
                continue;
            }

            const previousState = this.game.playerRenderer.enemyPreviousStates.get(playerId);
            const newState = this.createInterpolationState(currentPlayer, previousState, now);
            this.game.playerRenderer.updateEnemyState(playerId, newState);
        }

        for (const playerId of this.game.playerRenderer.enemyPreviousStates.keys()) {
            if (!state.players[playerId] || !state.players[playerId].alive) {
                this.game.playerRenderer.enemyPreviousStates.delete(playerId);
                this.game.playerRenderer.lastEnemyRenderPositions.delete(playerId);
            }
        }

        for (const bulletId in state.bullets) {
            const currentBullet = state.bullets[bulletId];
            if (!currentBullet || !currentBullet.active) {
                this.game.bulletRenderer.bulletPreviousStates.delete(bulletId);
                continue;
            }

            const previousState = this.game.bulletRenderer.bulletPreviousStates.get(bulletId);
            const newState = this.createInterpolationState(currentBullet, previousState, now);
            this.game.bulletRenderer.updateBulletState(bulletId, newState);
        }

        for (const bulletId of this.game.bulletRenderer.bulletPreviousStates.keys()) {
            if (!state.bullets[bulletId] || !state.bullets[bulletId].active) {
                const prevState = this.game.bulletRenderer.bulletPreviousStates.get(bulletId);
                if (prevState) {
                    const hitX = prevState.nextX || prevState.x;
                    const hitY = prevState.nextY || prevState.y;
                    this.game.checkBulletHitOnDestroy(hitX, hitY);
                }
                this.game.bulletRenderer.bulletPreviousStates.delete(bulletId);
            }
        }

        const newBuildingsCount = stateBuildings.length;
        const newTreesCount = stateTrees.length;
        const buildingsChanged = newBuildingsCount !== oldBuildingsCount;
        const treesChanged = newTreesCount !== oldTreesCount;

        this.game.gameState = state;

        this.game.gameState.buildings = stateBuildings;
        this.game.gameState.trees = stateTrees;

        if ((wasFirstTime || buildingsChanged || treesChanged) && stateBuildings.length > 0) {
            this.game.scheduleGenerateWorld();
        }

        if (this.game.gameState.phase === 'finished' && oldPhase !== 'finished') {
            this.game.showVictoryScreen();
        }

        if (this.game.playerId) {
            const player = this.game.gameState.players[this.game.playerId];
            if (player && !player.alive && this.game.wasAlive) {
                this.game.showDeathScreen();
            }
            this.game.wasAlive = player?.alive ?? false;
        }

        this.game.updateUI();

        const updateEnd = performance.now();
        this.game.updateTime = updateEnd - updateStart;
    }
}

