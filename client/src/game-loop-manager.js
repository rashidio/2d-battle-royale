export class GameLoopManager {
    constructor(game) {
        this.game = game;
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.lastFrameTime = performance.now();
        this.lastActiveTime = performance.now();
    }

    start(updateCallback, renderCallback) {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.lastActiveTime = performance.now();

        const loop = () => {
            if (!this.isRunning) {
                return;
            }

            if (document.hidden) {
                this.isPaused = true;
                this.lastFrameTime = performance.now();
                this.animationFrameId = requestAnimationFrame(loop);
                return;
            }

            if (this.isPaused) {
                const timeSinceActive = performance.now() - this.lastActiveTime;
                if (timeSinceActive > 1000) {
                    this.lastFrameTime = performance.now();
                    console.log(`[TAB] Resuming after ${(timeSinceActive / 1000).toFixed(1)}s inactive`);
                }
                this.isPaused = false;
                this.lastActiveTime = performance.now();
            }

            const frameStart = performance.now();
            const maxDelta = 50;
            let frameDelta = frameStart - this.lastFrameTime;
            const realDelta = frameDelta;

            if (frameDelta > maxDelta) {
                frameDelta = maxDelta;
                this.lastFrameTime = frameStart - maxDelta;
            } else {
                this.lastFrameTime = frameStart;
            }

            if (updateCallback) {
                updateCallback(frameDelta);
            }

            if (renderCallback) {
                renderCallback();
            }

            const frameEnd = performance.now();
            const cpuTime = frameEnd - frameStart;
            if (this.game) {
                this.game.cpuTime = cpuTime;

                this.game.frameTimes.push(frameDelta);
                if (this.game.frameTimes.length > 60) {
                    this.game.frameTimes.shift();
                }

                const now = performance.now();
                if (now - this.game.lastFPSUpdate > 500) {
                    const avgFrameTime = this.game.frameTimes.reduce((a, b) => a + b, 0) / this.game.frameTimes.length;
                    this.game.fps = Math.round(1000 / avgFrameTime);
                    this.game.frameTime = avgFrameTime.toFixed(1);
                    this.game.lastFPSUpdate = now;
                }

                if (now - this.game.lastPingTime > 1000 && this.game.networkManager.isConnected() && this.game.networkManager.ws.bufferedAmount < 65536) {
                    this.game.lastPingTime = now;
                    this.game.networkManager.sendPing();
                }
            }

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    }

    pause() {
        this.isPaused = true;
        this.lastActiveTime = performance.now();
    }

    resume() {
        if (this.isPaused) {
            const timeSinceActive = performance.now() - this.lastActiveTime;
            if (timeSinceActive > 1000) {
                this.lastFrameTime = performance.now();
                console.log(`[TAB] Resuming after ${(timeSinceActive / 1000).toFixed(1)}s inactive`);
            }
            this.isPaused = false;
            this.lastActiveTime = performance.now();
        }
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

