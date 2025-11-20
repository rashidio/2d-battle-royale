export class MessageQueueProcessor {
    constructor(game) {
        this.game = game;
        this.pendingMessages = [];
        this.messageProcessingTimeout = null;
    }

    enqueue(message) {
        this.pendingMessages.push(message);
        this.scheduleProcessing();
    }

    scheduleProcessing() {
        if (document.hidden) return;
        if (this.messageProcessingTimeout) return;

        this.messageProcessingTimeout = setTimeout(() => {
            this.messageProcessingTimeout = null;
            if (!document.hidden) {
                this.processBatch();
            }
        }, 0);
    }

    processBatch() {
        const maxMessagesPerFrame = 20;
        const messages = this.pendingMessages.splice(0, maxMessagesPerFrame);
        if (messages.length === 0) return;

        if (this.pendingMessages.length > 0) {
            this.scheduleProcessing();
        }

        for (const data of messages) {
            if (data.type === 'init' && data.playerId) {
                console.log('Received init, playerId:', data.playerId);
                if (data.sessionId) {
                    this.game.sessionManager.setSessionId(data.sessionId);
                    console.log('Session ID:', this.game.sessionId);
                }
                this.game.playerId = data.playerId;
                this.game.hitAnimationSystem.playerId = data.playerId;
                if (data.state) {
                    this.game.applyStateDiff(data.state);
                }
                if (this.game.gameState.buildings?.length) {
                    this.game.scheduleGenerateWorld();
                }
            } else if (data.type === 'worldChunks') {
                this.game.handleWorldChunks(data.chunks);
            } else if (data.type === 'stateDiff') {
                this.game.applyStateDiff(data);

                if (this.game.playerId && data.players && data.players[this.game.playerId]) {
                    const player = data.players[this.game.playerId];
                    if (player.alive && !this.game.wasAlive) {
                        this.game.clientPrediction.x = player.x;
                        this.game.clientPrediction.y = player.y;
                        this.game.clientPrediction.angle = player.angle;
                        this.game.wasAlive = true;
                        this.game.correctionCount = 0;
                        this.game.snapCorrectionCount = 0;
                        this.game.smoothCorrectionCount = 0;
                        this.game.minorCorrectionCount = 0;
                        this.game.skippedCorrectionCount = 0;
                        this.game.maxCorrectionError = 0;
                        this.game.minCorrectionError = Infinity;
                        this.game.totalCorrectionError = 0;
                        this.game.correctionErrorSamples = 0;
                        this.game.pendingInputs = [];
                        this.game.lastAcknowledgedInputId = -1;
                        this.game.inputSequence = 0;
                    }
                }
            }
        }
    }

    cleanup() {
        this.pendingMessages = [];
        if (this.messageProcessingTimeout) {
            clearTimeout(this.messageProcessingTimeout);
            this.messageProcessingTimeout = null;
        }
    }
}

