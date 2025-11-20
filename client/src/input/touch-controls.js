export class TouchControls {
    constructor(game) {
        this.game = game;
        this.moveActive = false;
        this.moveStartX = 0;
        this.moveStartY = 0;
        this.moveCurrentX = 0;
        this.moveCurrentY = 0;
        this.moveRadius = 80;
        this.lastMoveAngle = 0;
        this.aimActive = false;
        this.aimStartX = 0;
        this.aimStartY = 0;
        this.aimCurrentX = 0;
        this.aimCurrentY = 0;
        this.aimRadius = 64;
        this.aimAngle = 0;
        this.aimTouchId = null;
        this.lastAimShootTime = 0;
        this.aimShootCooldown = 150;
        this.aimLocked = false;
        this.aimLockedAngle = 0;
        this.locked = false;
        this.lockedAngle = 0;
        this.lockThreshold = 0.8;
        this.unlockThreshold = 0.5;
        this.moveTouchId = null;
    }

    setup() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isTouchDevice) return;

        const touchControlsEl = document.getElementById('touchControls');
        if (touchControlsEl) touchControlsEl.classList.add('active');

        const moveJoystick = document.getElementById('moveJoystick');
        const moveJoystickCenter = document.getElementById('moveJoystickCenter');
        const moveJoystickLock = document.getElementById('moveJoystickLock');
        const aimJoystick = document.getElementById('aimJoystick');
        const aimJoystickCenter = document.getElementById('aimJoystickCenter');
        const aimJoystickLock = document.getElementById('aimJoystickLock');

        const getTouchPos = (e, touchId) => {
            let touch = null;
            if (touchId !== null) {
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === touchId) {
                        touch = e.touches[i];
                        break;
                    }
                }
                if (!touch && e.changedTouches) {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === touchId) {
                            touch = e.changedTouches[i];
                            break;
                        }
                    }
                }
            }
            if (!touch) touch = e.touches[0] || e.changedTouches[0];
            const rect = moveJoystick.getBoundingClientRect();
            return {
                x: touch.clientX - rect.left - rect.width / 2,
                y: touch.clientY - rect.top - rect.height / 2
            };
        };

        const getAimTouchPos = (e, touchId) => {
            let touch = null;
            if (touchId !== null) {
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === touchId) {
                        touch = e.touches[i];
                        break;
                    }
                }
                if (!touch && e.changedTouches) {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === touchId) {
                            touch = e.changedTouches[i];
                            break;
                        }
                    }
                }
            }
            if (!touch) touch = e.touches[0] || e.changedTouches[0];
            const rect = aimJoystick.getBoundingClientRect();
            return {
                x: touch.clientX - rect.left - rect.width / 2,
                y: touch.clientY - rect.top - rect.height / 2
            };
        };

        const isTouchOnAimJoystick = (touch) => {
            if (!aimJoystick || !touch) return false;
            const rect = aimJoystick.getBoundingClientRect();
            return touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom;
        };

        const constrainToCircle = (x, y, radius) => {
            const dist = Math.sqrt(x * x + y * y);
            const maxRadius = radius * 1.5;
            if (dist > maxRadius) {
                return { x: (x / dist) * maxRadius, y: (y / dist) * maxRadius };
            }
            if (dist > radius) {
                const factor = radius + (dist - radius) * 0.5;
                return { x: (x / dist) * factor, y: (y / dist) * factor };
            }
            return { x, y };
        };

        const updateMoveJoystick = (x, y) => {
            const dist = Math.sqrt(x * x + y * y);
            const normalizedDist = dist / this.moveRadius;

            if (this.locked) {
                if (normalizedDist < this.unlockThreshold) {
                    this.locked = false;
                    if (moveJoystickLock) moveJoystickLock.style.display = 'none';
                } else {
                    const newAngle = Math.atan2(y, x);
                    this.lockedAngle = newAngle;
                    const lockedX = Math.cos(newAngle) * this.moveRadius;
                    const lockedY = Math.sin(newAngle) * this.moveRadius;
                    this.moveCurrentX = lockedX;
                    this.moveCurrentY = lockedY;
                    moveJoystickCenter.style.transform = `translate(calc(-50% + ${lockedX}px), calc(-50% + ${lockedY}px))`;
                    this.lastMoveAngle = newAngle;
                    this.game.lookAngle = newAngle;
                    return;
                }
            }

            const constrained = constrainToCircle(x, y, this.moveRadius);
            this.moveCurrentX = constrained.x;
            this.moveCurrentY = constrained.y;

            moveJoystickCenter.style.transform = `translate(calc(-50% + ${constrained.x}px), calc(-50% + ${constrained.y}px))`;

            if (normalizedDist >= this.lockThreshold && !this.locked) {
                this.locked = true;
                this.lockedAngle = Math.atan2(constrained.y, constrained.x);
                this.moveCurrentX = constrained.x;
                this.moveCurrentY = constrained.y;
                if (moveJoystickLock) moveJoystickLock.style.display = 'block';
            }

            if (Math.abs(constrained.x) > 5 || Math.abs(constrained.y) > 5) {
                const moveAngle = Math.atan2(constrained.y, constrained.x);
                this.lastMoveAngle = moveAngle;
            }
        };

        const updateAimJoystick = (x, y) => {
            const dist = Math.sqrt(x * x + y * y);
            const normalizedDist = dist / this.aimRadius;

            if (this.aimLocked) {
                if (normalizedDist < this.unlockThreshold) {
                    this.aimLocked = false;
                    if (aimJoystickLock) aimJoystickLock.style.display = 'none';
                } else {
                    const newAngle = Math.atan2(y, x);
                    this.aimLockedAngle = newAngle;
                    const lockedX = Math.cos(newAngle) * this.aimRadius;
                    const lockedY = Math.sin(newAngle) * this.aimRadius;
                    this.aimCurrentX = lockedX;
                    this.aimCurrentY = lockedY;
                    aimJoystickCenter.style.transform = `translate(calc(-50% + ${lockedX}px), calc(-50% + ${lockedY}px))`;
                    this.aimAngle = newAngle;
                    this.game.lookAngle = newAngle;

                    const lockedDist = Math.sqrt(lockedX * lockedX + lockedY * lockedY);
                    const lockedNormalizedDist = lockedDist / this.aimRadius;
                    if (lockedNormalizedDist >= 0.9) {
                        const now = Date.now();
                        if (now - this.lastAimShootTime >= this.aimShootCooldown) {
                            this.lastAimShootTime = now;
                            this.game.sendShootWithAngle(newAngle);
                        }
                    }
                    return;
                }
            }

            const constrained = constrainToCircle(x, y, this.aimRadius);
            this.aimCurrentX = constrained.x;
            this.aimCurrentY = constrained.y;

            aimJoystickCenter.style.transform = `translate(calc(-50% + ${constrained.x}px), calc(-50% + ${constrained.y}px))`;

            const constrainedDist = Math.sqrt(constrained.x * constrained.x + constrained.y * constrained.y);
            const constrainedNormalizedDist = constrainedDist / this.aimRadius;
            const aimAngle = Math.atan2(constrained.y, constrained.x);
            this.aimAngle = aimAngle;
            this.game.lookAngle = aimAngle;

            if (constrainedNormalizedDist >= this.lockThreshold && !this.aimLocked) {
                this.aimLocked = true;
                this.aimLockedAngle = aimAngle;
                this.aimCurrentX = constrained.x;
                this.aimCurrentY = constrained.y;
                if (aimJoystickLock) aimJoystickLock.style.display = 'block';
            }

            if (constrainedNormalizedDist >= 0.9) {
                const now = Date.now();
                if (now - this.lastAimShootTime >= this.aimShootCooldown) {
                    this.lastAimShootTime = now;
                    this.game.sendShootWithAngle(aimAngle);
                }
            }
        };

        const handleDocumentAimTouchMove = (e) => {
            if (this.aimTouchId === null) return;
            if (!this.aimActive && !this.aimLocked) return;
            const touch = e.touches ? Array.prototype.find.call(e.touches, t => t.identifier === this.aimTouchId) : null;
            if (!touch) return;
            const pos = getAimTouchPos(e, this.aimTouchId);
            updateAimJoystick(pos.x, pos.y);
        };

        const handleDocumentAimTouchEnd = (e) => {
            if (this.aimTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.aimTouchId) : null;
            if (!touch) return;

            if (!this.aimLocked) {
                this.aimActive = false;
                this.aimCurrentX = 0;
                this.aimCurrentY = 0;
                aimJoystickCenter.style.transform = 'translate(-50%, -50%)';
                this.aimTouchId = null;
                document.removeEventListener('touchmove', handleDocumentAimTouchMove);
                document.removeEventListener('touchend', handleDocumentAimTouchEnd);
                document.removeEventListener('touchcancel', handleDocumentAimTouchEnd);
            } else {
                this.aimActive = true;
            }
        };

        const handleDocumentTouchMove = (e) => {
            if (this.moveTouchId === null) return;
            if (!this.moveActive && !this.locked) return;
            const touch = e.touches ? Array.prototype.find.call(e.touches, t => t.identifier === this.moveTouchId) : null;
            if (!touch) return;
            const pos = getTouchPos(e, this.moveTouchId);
            updateMoveJoystick(pos.x, pos.y);
        };

        const handleDocumentTouchEnd = (e) => {
            if (this.moveTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.moveTouchId) : null;
            if (!touch) return;

            if (!this.locked) {
                this.moveActive = false;
                this.moveCurrentX = 0;
                this.moveCurrentY = 0;
                moveJoystickCenter.style.transform = 'translate(-50%, -50%)';
            }
            this.moveTouchId = null;
            document.removeEventListener('touchmove', handleDocumentTouchMove);
            document.removeEventListener('touchend', handleDocumentTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd);
        };

        moveJoystick.addEventListener('touchstart', (e) => {
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (isTouchOnAimJoystick(touch)) continue;
                if (this.aimTouchId !== null && touch.identifier === this.aimTouchId) continue;

                this.moveTouchId = touch.identifier;
                this.moveActive = true;
                const pos = getTouchPos(e, this.moveTouchId);
                this.moveStartX = pos.x;
                this.moveStartY = pos.y;
                updateMoveJoystick(pos.x, pos.y);
                document.addEventListener('touchmove', handleDocumentTouchMove, { passive: true });
                document.addEventListener('touchend', handleDocumentTouchEnd, { passive: true });
                document.addEventListener('touchcancel', handleDocumentTouchEnd, { passive: true });
                break;
            }
        }, { passive: false });

        moveJoystick.addEventListener('touchmove', (e) => {
            if (this.moveTouchId === null) return;
            const touch = e.touches ? Array.prototype.find.call(e.touches, t => t.identifier === this.moveTouchId) : null;
            if (!touch) return;
            const pos = getTouchPos(e, this.moveTouchId);
            updateMoveJoystick(pos.x, pos.y);
            e.preventDefault();
        }, { passive: false });

        moveJoystick.addEventListener('touchend', (e) => {
            if (this.moveTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.moveTouchId) : null;
            if (!touch) return;

            if (!this.locked) {
                this.moveActive = false;
                this.moveCurrentX = 0;
                this.moveCurrentY = 0;
                moveJoystickCenter.style.transform = 'translate(-50%, -50%)';
            }
            this.moveTouchId = null;
            document.removeEventListener('touchmove', handleDocumentTouchMove);
            document.removeEventListener('touchend', handleDocumentTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd);
        }, { passive: false });

        moveJoystick.addEventListener('touchcancel', (e) => {
            if (this.moveTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.moveTouchId) : null;
            if (!touch) return;

            this.moveActive = false;
            this.locked = false;
            this.moveCurrentX = 0;
            this.moveCurrentY = 0;
            this.moveTouchId = null;
            moveJoystickCenter.style.transform = 'translate(-50%, -50%)';
            if (moveJoystickLock) moveJoystickLock.style.display = 'none';
            document.removeEventListener('touchmove', handleDocumentTouchMove);
            document.removeEventListener('touchend', handleDocumentTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd);
        }, { passive: false });

        aimJoystick.addEventListener('touchstart', (e) => {
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (this.moveTouchId !== null && touch.identifier === this.moveTouchId) continue;

                this.aimTouchId = touch.identifier;
                this.aimActive = true;
                const pos = getAimTouchPos(e, this.aimTouchId);
                this.aimStartX = pos.x;
                this.aimStartY = pos.y;
                updateAimJoystick(pos.x, pos.y);
                document.addEventListener('touchmove', handleDocumentAimTouchMove, { passive: true });
                document.addEventListener('touchend', handleDocumentAimTouchEnd, { passive: true });
                document.addEventListener('touchcancel', handleDocumentAimTouchEnd, { passive: true });
                e.preventDefault();
                break;
            }
        }, { passive: false });

        aimJoystick.addEventListener('touchmove', (e) => {
            if (this.aimTouchId === null) return;
            const touch = e.touches ? Array.prototype.find.call(e.touches, t => t.identifier === this.aimTouchId) : null;
            if (!touch) return;
            const pos = getAimTouchPos(e, this.aimTouchId);
            updateAimJoystick(pos.x, pos.y);
            e.preventDefault();
        }, { passive: false });

        aimJoystick.addEventListener('touchend', (e) => {
            if (this.aimTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.aimTouchId) : null;
            if (!touch) return;

            if (!this.aimLocked) {
                this.aimActive = false;
                this.aimCurrentX = 0;
                this.aimCurrentY = 0;
                aimJoystickCenter.style.transform = 'translate(-50%, -50%)';
                this.aimTouchId = null;
                document.removeEventListener('touchmove', handleDocumentAimTouchMove);
                document.removeEventListener('touchend', handleDocumentAimTouchEnd);
                document.removeEventListener('touchcancel', handleDocumentAimTouchEnd);
            } else {
                this.aimActive = true;
            }
            e.preventDefault();
        }, { passive: false });

        aimJoystick.addEventListener('touchcancel', (e) => {
            if (this.aimTouchId === null) return;
            const touch = e.changedTouches ? Array.prototype.find.call(e.changedTouches, t => t.identifier === this.aimTouchId) : null;
            if (!touch) return;

            this.aimLocked = false;
            this.aimActive = false;
            this.aimCurrentX = 0;
            this.aimCurrentY = 0;
            aimJoystickCenter.style.transform = 'translate(-50%, -50%)';
            if (aimJoystickLock) aimJoystickLock.style.display = 'none';
            this.aimTouchId = null;
            document.removeEventListener('touchmove', handleDocumentAimTouchMove);
            document.removeEventListener('touchend', handleDocumentAimTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentAimTouchEnd);
            e.preventDefault();
        }, { passive: false });
    }
}
