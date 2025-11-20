export class MemoryManager {
    constructor(game) {
        this.game = game;
    }

    cleanupBulletCache() {
        if (this.game.bulletRenderer.previousBulletPositions.size > 100) {
            const toDelete = Array.from(this.game.bulletRenderer.previousBulletPositions.keys()).slice(0, 50);
            for (const key of toDelete) {
                this.game.bulletRenderer.previousBulletPositions.delete(key);
            }
        }

        if (this.game.bulletRenderer.bulletPreviousStates.size > 200) {
            const toDelete = Array.from(this.game.bulletRenderer.bulletPreviousStates.keys()).slice(0, 100);
            for (const key of toDelete) {
                this.game.bulletRenderer.bulletPreviousStates.delete(key);
            }
        }

        if (this.game.bulletRenderer.bulletGraphicsCache.size > 200) {
            const inactiveBullets = [];
            for (const [bulletId, graphics] of this.game.bulletRenderer.bulletGraphicsCache) {
                if (!this.game.bulletRenderer.activeBulletIds.has(bulletId)) {
                    inactiveBullets.push(bulletId);
                }
            }
            for (const bulletId of inactiveBullets.slice(0, 100)) {
                this.game.bulletRenderer.removeBullet(bulletId);
            }
        }
    }

    cleanupPlayerCache() {
        if (this.game.playerRenderer.enemyPreviousStates.size > 50) {
            const toDelete = Array.from(this.game.playerRenderer.enemyPreviousStates.keys()).slice(0, 25);
            for (const key of toDelete) {
                this.game.playerRenderer.enemyPreviousStates.delete(key);
                this.game.playerRenderer.lastEnemyRenderPositions.delete(key);
            }
        }

        if (this.game.playerRenderer.playerGraphicsCache.size > 50) {
            const inactivePlayers = [];
            for (const [playerId, graphics] of this.game.playerRenderer.playerGraphicsCache) {
                if (!this.game.playerRenderer.activePlayerIds.has(playerId)) {
                    inactivePlayers.push(playerId);
                }
            }
            for (const playerId of inactivePlayers.slice(0, 25)) {
                this.game.playerRenderer.removePlayer(playerId);
            }
        }
    }

    cleanupPickupCache() {
        if (this.game.pickupRenderer.pickupGraphicsCache.size > 300) {
            const inactivePickups = [];
            const activeIds = this.game.pickupRenderer.getActiveIds();
            for (const [pickupId, graphics] of this.game.pickupRenderer.pickupGraphicsCache) {
                const isActive = activeIds.ammo.has(pickupId) ||
                    activeIds.weapon.has(pickupId) ||
                    activeIds.health.has(pickupId);
                if (!isActive) {
                    inactivePickups.push(pickupId);
                }
            }
            for (const pickupId of inactivePickups.slice(0, 150)) {
                const graphics = this.game.pickupRenderer.pickupGraphicsCache.get(pickupId);
                if (graphics && graphics.parent) {
                    graphics.parent.removeChild(graphics);
                }
                this.game.pickupRenderer.pickupGraphicsCache.delete(pickupId);
            }
        }
    }

    cleanupChunkCache() {
        if (this.game.cachedChunks.size > 100) {
            let count = 0;
            for (const key of this.game.cachedChunks.keys()) {
                if (count++ >= 50) break;
                this.game.cachedChunks.delete(key);
            }
        }
    }

    cleanupHighlightState() {
        if (this.game.buildingHighlightState.size > 500) {
            let count = 0;
            for (const key of this.game.buildingHighlightState.keys()) {
                if (count++ >= 250) break;
                this.game.buildingHighlightState.delete(key);
            }
        }

        if (this.game.treeHighlightState.size > 500) {
            let count = 0;
            for (const key of this.game.treeHighlightState.keys()) {
                if (count++ >= 250) break;
                this.game.treeHighlightState.delete(key);
            }
        }
    }

    cleanupInputHistory() {
        if (this.game.pendingInputs.length > 30) {
            this.game.pendingInputs = this.game.pendingInputs.slice(-20);
        }
    }

    cleanupAll() {
        this.cleanupBulletCache();
        this.cleanupPlayerCache();
        this.cleanupPickupCache();
        this.cleanupChunkCache();
        this.cleanupHighlightState();
        this.cleanupInputHistory();
    }
}

