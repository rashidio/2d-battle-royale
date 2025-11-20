import { roundAngle, roundCoord } from '../utils.js';
import { resolveStaticCollisions } from '../collision-system.js';
import { CameraSystem } from '../camera-system.js';
import { KeyboardHandler } from './keyboard.js';
import { MouseHandler } from './mouse.js';
import { TouchControls } from './touch-controls.js';

const PLAYER_RADIUS = 8;

export class InputManager {
    constructor(game) {
        this.game = game;
        this.keyboard = new KeyboardHandler(game);
        this.mouse = new MouseHandler(game);
        this.touchControls = new TouchControls(game);
    }

    setup(canvas) {
        this.keyboard.setup();
        this.mouse.setup(canvas);
        this.touchControls.setup();
    }

    process() {
        if (!this.game.playerId) {
            return;
        }

        const player = this.game.gameState.players[this.game.playerId];
        if (!player || !player.alive) {
            return;
        }

        const playerRadius = PLAYER_RADIUS;

        let dx = 0;
        let dy = 0;

        const isMovingUp = this.keyboard.isPressed('w') || this.keyboard.isPressed('arrowup');
        const isMovingDown = this.keyboard.isPressed('s') || this.keyboard.isPressed('arrowdown');
        const isMovingLeft = this.keyboard.isPressed('a') || this.keyboard.isPressed('arrowleft');
        const isMovingRight = this.keyboard.isPressed('d') || this.keyboard.isPressed('arrowright');

        let joystickMagnitude = 0;
        if (this.touchControls.moveActive || this.touchControls.locked) {
            const moveX = this.touchControls.moveCurrentX / this.touchControls.moveRadius;
            const moveY = this.touchControls.moveCurrentY / this.touchControls.moveRadius;
            joystickMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
            dx += moveX;
            dy += moveY;
        }

        if (isMovingUp) dy -= 1;
        if (isMovingDown) dy += 1;
        if (isMovingLeft) dx -= 1;
        if (isMovingRight) dx += 1;

        const viewWidth = this.game.app?.screen?.width || window.innerWidth;
        const viewHeight = this.game.app?.screen?.height || window.innerHeight;

        if (!this.game.camera) {
            this.game.camera = new CameraSystem();
        }
        this.game.camera.updatePosition(player.x, player.y, viewWidth, viewHeight);

        let angle;
        if (this.touchControls.aimActive || this.touchControls.aimLocked) {
            angle = this.touchControls.aimLocked ? this.touchControls.aimLockedAngle : this.touchControls.aimAngle;
        } else if (this.touchControls.locked) {
            angle = this.touchControls.lockedAngle;
        } else {
            angle = this.game.lastInput.angle || 0;
        }

        angle = roundAngle(angle);
        this.game.clientPrediction.angle = angle;
        this.game.lookAngle = angle;

        if (this.touchControls.aimLocked) {
            const now = Date.now();
            if (now - this.touchControls.lastAimShootTime >= this.touchControls.aimShootCooldown) {
                this.touchControls.lastAimShootTime = now;
                this.game.networkManager.sendShootWithAngle(this.touchControls.aimLockedAngle);
            }
        }

        if (this.keyboard.isPressed('space')) {
            this.game.sendShoot();
        }

        const currentTime = performance.now();
        this.game.deltaTime = (currentTime - this.game.lastFrameTime) / 1000;
        this.game.lastFrameTime = currentTime;

        if (this.game.clientPrediction.x === null || this.game.clientPrediction.y === null) {
            this.game.clientPrediction.x = player.x;
            this.game.clientPrediction.y = player.y;
        }

        if (dx !== 0 || dy !== 0) {
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
                const len = Math.sqrt(lenSq);
                dx /= len;
                dy /= len;
            }

            this.game.intendedMove.x = dx;
            this.game.intendedMove.y = dy;

            if (!this.touchControls.aimActive && !this.touchControls.aimLocked) {
                const movementAngle = Math.atan2(dy, dx);
                angle = roundAngle(movementAngle);
            }
            angle = roundAngle(angle);
            this.game.clientPrediction.angle = angle;

            const frameDelta = Math.min(this.game.deltaTime, 0.05);
            const isJoystickOnly = (this.touchControls.moveActive || this.touchControls.locked) &&
                !isMovingUp && !isMovingDown && !isMovingLeft && !isMovingRight;
            const speedMultiplier = isJoystickOnly ? joystickMagnitude : 1.0;
            const moveSpeed = player.velocity * frameDelta * speedMultiplier;

            if (dx !== 0 || dy !== 0) {
                let sendX = dx;
                let sendY = dy;
                const len = Math.sqrt(sendX * sendX + sendY * sendY);
                if (len > 1.0) {
                    sendX /= len;
                    sendY /= len;
                }
                sendX = roundCoord(sendX);
                sendY = roundCoord(sendY);

                const predictedX = this.game.clientPrediction.x + sendX * moveSpeed;
                const predictedY = this.game.clientPrediction.y + sendY * moveSpeed;

                const checkRadius = 400;
                const nearbyBuildings = this.game.gameState.buildings.filter(b =>
                    Math.abs(b.x - predictedX) < checkRadius &&
                    Math.abs(b.y - predictedY) < checkRadius
                );
                const nearbyTrees = this.game.gameState.trees.filter(t =>
                    Math.abs(t.x - predictedX) < checkRadius &&
                    Math.abs(t.y - predictedY) < checkRadius
                );

                const resolved = resolveStaticCollisions(
                    { x: predictedX, y: predictedY },
                    nearbyBuildings,
                    nearbyTrees,
                    8
                );

                this.game.clientPrediction.x = resolved.x;
                this.game.clientPrediction.y = resolved.y;

                const currentTime = performance.now();
                const timeSinceLastInput = currentTime - this.game.lastMovementInputTime;
                const shouldSendInput = timeSinceLastInput >= this.game.sendInterval || this.game.lastMovementInputTime === 0;

                if (shouldSendInput) {
                    this.game.lastInput.moveX = sendX;
                    this.game.lastInput.moveY = sendY;
                    this.game.lastMovementTime = currentTime;
                    this.game.lastMovementInputTime = currentTime;

                    const roundedAngle = roundAngle(angle);
                    const angleChanged = Math.abs(roundedAngle - this.game.lastInput.angle) > 0.001;
                    if (angleChanged) {
                        this.game.lastInput.angle = roundedAngle;
                    }
                    this.game.networkManager.sendInput(sendX, sendY, this.game.lastInput.angle);
                }
            } else {
                if (this.game.lastInput.moveX !== 0 || this.game.lastInput.moveY !== 0) {
                    this.game.lastInput.moveX = 0;
                    this.game.lastInput.moveY = 0;
                    this.game.lastMovementInputTime = performance.now();
                    this.game.networkManager.sendInput(0, 0, this.game.lastInput.angle);
                }
            }
        } else {
            this.game.intendedMove.x = 0;
            this.game.intendedMove.y = 0;

            const roundedAngle = roundAngle(angle);
            if (this.game.lastInput.moveX !== 0 || this.game.lastInput.moveY !== 0 || Math.abs(roundedAngle - this.game.lastInput.angle) > 0.001) {
                this.game.lastInput.moveX = 0;
                this.game.lastInput.moveY = 0;
                if (Math.abs(roundedAngle - this.game.lastInput.angle) > 0.001) {
                    this.game.lastInput.angle = roundedAngle;
                }
                this.game.networkManager.sendInput(0, 0, this.game.lastInput.angle);
            }
        }
    }
}
