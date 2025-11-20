export class SessionManager {
    constructor() {
        this.sessionId = null;
    }

    loadSession() {
        this.sessionId = localStorage.getItem('gameSessionId');
        if (!this.sessionId) {
            this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gameSessionId', this.sessionId);
        }
        return this.sessionId;
    }

    saveSession() {
        if (this.sessionId) {
            localStorage.setItem('gameSessionId', this.sessionId);
        }
    }

    clearSession() {
        localStorage.removeItem('gameSessionId');
        this.sessionId = null;
    }

    getSessionId() {
        return this.sessionId;
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
        this.saveSession();
    }
}

