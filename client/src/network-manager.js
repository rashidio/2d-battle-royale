import { roundCoord, roundAngle } from './utils.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.isConnecting = false;
        this.wsPacketsSent = 0;
        this.wsPacketsReceived = 0;
    }

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const sessionParam = this.game.sessionId ? `?session=${encodeURIComponent(this.game.sessionId)}` : '';
        const wsUrl = `${protocol}//${window.location.host}/ws${sessionParam}`;

        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.isConnecting = false;
        };

        this.ws.onmessage = (event) => {
            this.wsPacketsReceived++;
            if (document.hidden) {
                return;
            }
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong' && data.time) {
                    const pingEnd = performance.now();
                    this.game.ping = Math.round(pingEnd - data.time);
                } else {
                    if (this.game.messageQueueProcessor.pendingMessages.length > 50) {
                        this.game.messageQueueProcessor.pendingMessages = this.game.messageQueueProcessor.pendingMessages.slice(-20);
                    }
                    this.game.enqueueMessage(data);
                }
            } catch (error) {
                console.error('Error parsing game state:', error, event.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnecting = false;
        };

        this.ws.onclose = (event) => {
            console.log('Disconnected from server', event.code);
            this.isConnecting = false;
            if (event.code !== 1000 && event.code !== 1001 && !this.isConnecting && !document.hidden) {
                setTimeout(() => {
                    if (!document.hidden && !this.isConnecting && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
                        this.connect();
                    }
                }, 2000);
            }
        };
    }

    cleanup() {
        this.isConnecting = false;

        if (this.ws) {
            try {
                this.ws.onmessage = null;
                this.ws.onerror = null;
                this.ws.onclose = null;
                if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close(1000, 'Page unloading');
                }
            } catch (e) {
            }
            this.ws = null;
        }
    }

    sendInput(moveX, moveY, angle) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        if (this.ws.bufferedAmount > 65536) {
            return false;
        }

        const now = Date.now();
        if (now - this.game.lastSendTime < this.game.sendInterval) {
            return false;
        }
        this.game.lastSendTime = now;

        try {
            this.game.inputSequence++;
            const inputId = this.game.inputSequence;

            this.game.pendingInputs.push({
                id: inputId,
                moveX: moveX,
                moveY: moveY,
                angle: angle,
                timestamp: now
            });

            if (this.game.pendingInputs.length > 20) {
                this.game.pendingInputs.shift();
            }

            const clientX = this.game.clientPrediction.x !== null ? roundCoord(this.game.clientPrediction.x) : 0;
            const clientY = this.game.clientPrediction.y !== null ? roundCoord(this.game.clientPrediction.y) : 0;

            const message = {
                type: 'input',
                moveX: moveX,
                moveY: moveY,
                angle: angle,
                inputId: inputId,
                clientX: clientX,
                clientY: clientY
            };

            this.wsPacketsSent++;
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error sending input:', error);
            if (this.ws.readyState !== WebSocket.OPEN) {
                this.ws = null;
            }
            return false;
        }
    }

    sendShoot() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const player = this.game.gameState.players[this.game.playerId];
        if (!player || player.ammo <= 0) {
            return;
        }
        let angle;
        if (this.game.inputManager.touchControls.aimActive || this.game.inputManager.touchControls.aimLocked) {
            angle = this.game.inputManager.touchControls.aimLocked ? this.game.inputManager.touchControls.aimLockedAngle : this.game.inputManager.touchControls.aimAngle;
        } else if (this.game.inputManager.touchControls.locked) {
            angle = this.game.inputManager.touchControls.lockedAngle;
        } else {
            angle = this.game.lastInput.angle || 0;
        }
        this.sendShootWithAngle(angle);
    }

    sendShootWithAngle(angle) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.ws.bufferedAmount > 65536) {
            return;
        }
        const player = this.game.gameState.players[this.game.playerId];
        if (!player || player.ammo <= 0) {
            return;
        }
        const now = Date.now();
        if (now - this.game.lastShootTime < this.game.shootCooldown) {
            return;
        }
        this.game.lastShootTime = now;

        if (navigator.vibrate) {
            navigator.vibrate(10);
        }

        const ammoEl = document.getElementById('ammo');
        if (ammoEl) {
            ammoEl.style.color = '#FF6B6B';
            if (this.game.ammoFlashTimeout) clearTimeout(this.game.ammoFlashTimeout);
            this.game.ammoFlashTimeout = setTimeout(() => {
                if (ammoEl) ammoEl.style.color = '';
            }, 200);
        }

        try {
            this.wsPacketsSent++;
            this.ws.send(JSON.stringify({
                type: 'input',
                moveX: 0,
                moveY: 0,
                angle: roundAngle(angle),
                shoot: true
            }));
        } catch (error) {
            console.error('Error sending shoot:', error);
            if (this.ws.readyState !== WebSocket.OPEN) {
                this.ws = null;
            }
        }
    }

    sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'ping',
                    time: performance.now()
                }));
            } catch (e) {
            }
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
