export class GameStatsDisplay {
    update(gameState) {
        const stats = this.calculateStats(gameState);
        this.updatePlayersOnline(stats.playersOnline);
        this.updatePlayersAlive(stats.playersAlive);
        this.updateBotsAlive(stats.botsAlive);
        this.updateTimer(gameState.zoneRadius);
    }

    calculateStats(gameState) {
        const allPlayers = Object.entries(gameState.players || {});
        const realPlayers = [];
        const bots = [];
        const alivePlayers = [];
        const aliveBots = [];

        for (const [playerId, p] of allPlayers) {
            if (playerId.startsWith('enemy_')) {
                bots.push([playerId, p]);
                if (p.alive) aliveBots.push([playerId, p]);
            } else {
                realPlayers.push([playerId, p]);
                if (p.alive) alivePlayers.push([playerId, p]);
            }
        }

        return {
            playersOnline: realPlayers.length,
            playersAlive: alivePlayers.length,
            botsAlive: aliveBots.length
        };
    }

    updatePlayersOnline(count) {
        const playersOnlineEl = document.getElementById('playersOnline');
        if (playersOnlineEl) {
            playersOnlineEl.textContent = count;
        }
    }

    updatePlayersAlive(count) {
        const playersAliveEl = document.getElementById('playersAlive');
        if (playersAliveEl) {
            playersAliveEl.textContent = count;
        }
    }

    updateBotsAlive(count) {
        const botsAliveEl = document.getElementById('botsAlive');
        if (botsAliveEl) {
            botsAliveEl.textContent = count;
        }
    }

    updateTimer(zoneRadius) {
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            const radius = Math.max(0, Math.round(zoneRadius || 0));
            timerEl.textContent = `${radius}m`;
        }
    }
}

