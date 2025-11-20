export class WorldScheduler {
    constructor(game) {
        this.game = game;
        this.generateWorldPending = false;
        this.generateWorldTimeout = null;
    }

    scheduleGenerate(callback) {
        if (this.generateWorldPending) return;

        this.generateWorldPending = true;
        if (this.generateWorldTimeout) {
            clearTimeout(this.generateWorldTimeout);
        }

        this.generateWorldTimeout = setTimeout(() => {
            this.generateWorldPending = false;
            callback();
        }, 0);
    }

    cancel() {
        if (this.generateWorldTimeout) {
            clearTimeout(this.generateWorldTimeout);
            this.generateWorldTimeout = null;
        }
        this.generateWorldPending = false;
    }

    cleanup() {
        this.cancel();
    }
}

