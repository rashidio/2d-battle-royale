export class ScreenManager {
    constructor(game) {
        this.game = game;
    }

    showDeathScreen() {
        const player = this.game.gameState.players[this.game.playerId];
        if (!player) return;

        const deathScreen = document.getElementById('deathScreen');
        const scoreValue = document.getElementById('deathScoreValue');
        const killsValue = document.getElementById('deathKills');

        if (deathScreen && scoreValue && killsValue) {
            scoreValue.textContent = player.score;
            killsValue.textContent = player.kills;
            deathScreen.classList.add('visible');
        }
    }

    hideDeathScreen() {
        const deathScreen = document.getElementById('deathScreen');
        if (deathScreen) {
            deathScreen.classList.remove('visible');
        }
    }

    respawn() {
        if (!this.game.networkManager.ws || this.game.networkManager.ws.readyState !== WebSocket.OPEN || this.game.networkManager.ws.bufferedAmount > 65536) {
            return;
        }
        try {
            this.game.networkManager.wsPacketsSent++;
            const msg = JSON.stringify({ type: 'respawn' });
            this.game.wsBytesSent += new Blob([msg]).size;
            this.game.networkManager.ws.send(msg);
            this.hideDeathScreen();
        } catch (error) {
            console.error('Error sending respawn:', error);
            if (this.game.networkManager.ws.readyState !== WebSocket.OPEN) {
                this.game.networkManager.ws = null;
            }
        }
    }

    showVictoryScreen() {
        const player = this.game.gameState.players[this.game.playerId];
        if (!player) return;

        const victoryScreen = document.getElementById('victoryScreen');
        const scoreValue = document.getElementById('victoryScoreValue');
        const killsValue = document.getElementById('victoryKills');
        const highScoreEl = document.getElementById('highScore');

        const isWinner = this.game.gameState.winner === this.game.playerId;

        if (isWinner) {
            document.getElementById('victoryCup').textContent = '🏆';
            document.querySelector('#victoryScreen h2').textContent = 'Victory!';

            let highScore = parseInt(localStorage.getItem('highScore') || '0');
            if (player.score > highScore) {
                highScore = player.score;
                localStorage.setItem('highScore', highScore.toString());
            }

            scoreValue.textContent = player.score;
            killsValue.textContent = player.kills;
            highScoreEl.textContent = highScore;

            victoryScreen.classList.add('visible');
        }
    }

    startGame() {
        const menuScreen = document.getElementById('menuScreen');
        if (menuScreen) {
            menuScreen.classList.add('hidden');
        }

        const gameUIElements = document.querySelectorAll('.game-ui-hidden');
        gameUIElements.forEach(el => {
            if (el.id !== 'debug' && el.id !== 'ui') {
                el.classList.remove('game-ui-hidden');
            }
        });

        const debugEnabled = localStorage.getItem('debugEnabled') === 'true';
        this.game.updateDebugVisibility(debugEnabled);

        this.game.networkManager.connect();
    }

    newGame() {
        const victoryScreen = document.getElementById('victoryScreen');
        if (victoryScreen) {
            victoryScreen.classList.remove('visible');
        }

        localStorage.removeItem('gameSessionId');
        this.game.sessionId = null;
        this.game.playerId = null;
        this.game.loadSession();

        if (this.game.networkManager.ws) {
            this.game.networkManager.ws.close();
        }

        const menuScreen = document.getElementById('menuScreen');
        if (menuScreen) {
            menuScreen.classList.remove('hidden');
        }

        const gameUIElements = document.querySelectorAll('#ui, #zoneTimer, #playerStats, #debug, #touchControls');
        gameUIElements.forEach(el => {
            if (el && !el.classList.contains('game-ui-hidden')) {
                el.classList.add('game-ui-hidden');
            }
        });

        this.game.gameState = {
            players: {},
            bullets: {},
            buildings: [],
            trees: [],
            ammoPickups: {},
            weaponPickups: {},
            healthPickups: {},
            zoneCenter: 0,
            zoneRadius: 3200,
            gameTime: 0,
            phase: 'lobby'
        };

        this.game.clientPrediction = { x: null, y: null, angle: 0 };
        this.game.lastMovementDir = { x: 0, y: 0 };
        this.game.lastServerUpdateTime = 0;
        this.game.serverStates.clear();
        this.game.lastServerTime = 0;
        this.game.correctionCount = 0;
        this.game.snapCorrectionCount = 0;
        this.game.smoothCorrectionCount = 0;
        this.game.minorCorrectionCount = 0;
        this.game.skippedCorrectionCount = 0;
        this.game.maxCorrectionError = 0;
        this.game.minCorrectionError = Infinity;
        this.game.totalCorrectionError = 0;
        this.game.correctionErrorSamples = 0;
    }
}

