const MOVEMENT_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'];

export class KeyboardHandler {
    constructor(game) {
        this.game = game;
        this.keys = new Set();
    }

    setup() {
        const normalizeKey = (e) => {
            if (e.code) {
                const code = e.code.toLowerCase();
                if (code.startsWith('key')) return code.slice(3);
                if (code.startsWith('arrow')) return 'arrow' + code.slice(5);
                if (code === 'space') return 'space';
            }
            if (e.key) {
                const key = e.key.toLowerCase();
                if (key.startsWith('arrow')) return 'arrow' + key.slice(5);
                if (key === ' ') return 'space';
                return key;
            }
            return null;
        };

        const handleKeyDown = (e) => {
            const key = normalizeKey(e);
            if (!key) return;
            if (!this.keys.has(key)) this.keys.add(key);
            if (MOVEMENT_KEYS.includes(key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const handleKeyUp = (e) => {
            const key = normalizeKey(e);
            if (!key) return;
            this.keys.delete(key);
            if (MOVEMENT_KEYS.includes(key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keyup', handleKeyUp, true);

        window.addEventListener('blur', () => {
            this.keys.clear();
        });

        window.addEventListener('visibilitychange', () => {
            this.keys.clear();
            const wasVisible = this.game.isTabVisible;
            this.game.isTabVisible = !document.hidden;

            if (!wasVisible && this.game.isTabVisible) {
                this.game.lastActiveTime = performance.now();
                const oldCount = this.game.messageQueueProcessor.pendingMessages.length;
                if (this.game.messageQueueProcessor.pendingMessages.length > 20) {
                    this.game.messageQueueProcessor.pendingMessages = this.game.messageQueueProcessor.pendingMessages.slice(-10);
                    console.log(`[TAB] Tab visible, cleared ${oldCount - this.game.messageQueueProcessor.pendingMessages.length} msgs (kept ${this.game.messageQueueProcessor.pendingMessages.length})`);
                }
            } else if (wasVisible && !this.game.isTabVisible) {
                this.game.messageQueueProcessor.pendingMessages = [];
                if (this.game.messageQueueProcessor.messageProcessingTimeout) {
                    clearTimeout(this.game.messageQueueProcessor.messageProcessingTimeout);
                    this.game.messageQueueProcessor.messageProcessingTimeout = null;
                }
                this.game.worldScheduler.cancel();
                console.log('[TAB] Tab hidden, cleared message queue');
            } else if (!wasVisible && this.game.isTabVisible) {
                if (!this.game.ws || this.game.ws.readyState !== WebSocket.OPEN) {
                    this.game.connect();
                }
            }
        });
    }

    isPressed(key) {
        return this.keys.has(key);
    }

    clear() {
        this.keys.clear();
    }
}
