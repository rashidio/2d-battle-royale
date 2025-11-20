import * as PIXI from 'pixi.js';
import { trimMap, destroyAndClearCache } from '../utils.js';

const TICK_RATE = 20;
const ZOOM = 1.5;

const MAX_PREV_POSITIONS = 100;
const MAX_PREV_STATES = 200;
const MAX_GRAPHICS_CACHE = 200;

export class BulletRenderer {
    constructor(bulletsContainer) {
        this.bulletsContainer = bulletsContainer;
        this.bulletGraphicsCache = new Map();
        this.bulletColorCache = new Map();
        this.activeBulletIds = new Set();
        this.bulletPreviousStates = new Map();
        this.previousBulletPositions = new Map();
    }

    render(gameState, viewport, deltaTime, interpolationDelay, renderNow, onBulletDestroy) {
        const { viewLeft, viewRight, viewTop, viewBottom } = viewport;
        const viewPadding = 200 / ZOOM;
        const extendedViewLeft = viewLeft - viewPadding;
        const extendedViewRight = viewRight + viewPadding;
        const extendedViewTop = viewTop - viewPadding;
        const extendedViewBottom = viewBottom + viewPadding;

        this.activeBulletIds.clear();

        const bulletsToCheck = new Set();
        for (const bulletId of this.previousBulletPositions.keys()) {
            const bullet = gameState.bullets?.[bulletId];
            if (!bullet?.active) {
                bulletsToCheck.add(bulletId);
            }
        }

        for (const bulletId of bulletsToCheck) {
            const prevPos = this.previousBulletPositions.get(bulletId);
            if (prevPos && onBulletDestroy) {
                onBulletDestroy(prevPos.x, prevPos.y, bulletId);
            }
            this.previousBulletPositions.delete(bulletId);
        }

        for (const bulletId in gameState.bullets) {
            let bullet = gameState.bullets[bulletId];
            if (!bullet.active) {
                continue;
            }

            const { renderX, renderY, renderAngle } = this.calculateRenderPosition(
                bulletId,
                bullet,
                deltaTime,
                interpolationDelay,
                renderNow
            );

            if (renderX === null || renderY === null) {
                continue;
            }

            const bulletX = renderX;
            const bulletY = renderY;

            if (bulletX < extendedViewLeft || bulletX > extendedViewRight ||
                bulletY < extendedViewTop || bulletY > extendedViewBottom) {
                continue;
            }

            this.activeBulletIds.add(bulletId);

            this.updateBulletGraphics(bulletId, bullet, bulletX, bulletY, renderAngle);
        }

        this.updateVisibility();
    }

    calculateRenderPosition(bulletId, bullet, deltaTime, interpolationDelay, renderNow) {
        const bulletSpeedPerTick = bullet.speed || bullet.Speed || 18.0;
        const bulletSpeedPerSecond = bulletSpeedPerTick * TICK_RATE;
        const frameDelta = Math.min(deltaTime || 0.016, 0.05);

        const prevPos = this.previousBulletPositions.get(bulletId);
        const bulletState = this.bulletPreviousStates.get(bulletId);

        let renderBulletX, renderBulletY, renderBulletAngle;

        if (prevPos &&
            !isNaN(prevPos.x) && !isNaN(prevPos.y) &&
            Math.abs(prevPos.x) < 100000 && Math.abs(prevPos.y) < 100000) {
            renderBulletX = prevPos.x;
            renderBulletY = prevPos.y;
            renderBulletAngle = prevPos.angle !== undefined ? prevPos.angle : bullet.angle;
        } else if (bulletState && bulletState.time && bulletState.nextTime && bulletState.nextTime > bulletState.time) {
            const renderTime = renderNow - interpolationDelay || 0;
            const timeDiff = bulletState.nextTime - bulletState.time;

            if (timeDiff > 0 && renderTime >= bulletState.time && renderTime <= bulletState.nextTime) {
                const t = Math.max(0, Math.min(1, (renderTime - bulletState.time) / timeDiff));
                renderBulletX = bulletState.x + (bulletState.nextX - bulletState.x) * t;
                renderBulletY = bulletState.y + (bulletState.nextY - bulletState.y) * t;
                const angleDiff = bulletState.nextAngle - bulletState.angle;
                const normalizedAngleDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
                renderBulletAngle = bulletState.angle + normalizedAngleDiff * t;
            } else if (renderTime > bulletState.nextTime) {
                const timeSinceUpdate = (renderTime - bulletState.nextTime) / 1000;
                if (timeSinceUpdate > 0 && timeSinceUpdate < 1.0) {
                    renderBulletX = bulletState.nextX + Math.cos(bulletState.nextAngle) * bulletSpeedPerSecond * timeSinceUpdate;
                    renderBulletY = bulletState.nextY + Math.sin(bulletState.nextAngle) * bulletSpeedPerSecond * timeSinceUpdate;
                    renderBulletAngle = bulletState.nextAngle;
                } else {
                    if (bullet.x !== undefined && bullet.y !== undefined &&
                        !isNaN(bullet.x) && !isNaN(bullet.y) &&
                        Math.abs(bullet.x) < 100000 && Math.abs(bullet.y) < 100000) {
                        renderBulletX = bullet.x;
                        renderBulletY = bullet.y;
                        renderBulletAngle = bullet.angle;
                    } else {
                        return { renderX: null, renderY: null, renderAngle: null };
                    }
                }
            } else {
                if (bullet.x !== undefined && bullet.y !== undefined &&
                    !isNaN(bullet.x) && !isNaN(bullet.y) &&
                    Math.abs(bullet.x) < 100000 && Math.abs(bullet.y) < 100000) {
                    renderBulletX = bullet.x;
                    renderBulletY = bullet.y;
                    renderBulletAngle = bullet.angle;
                } else {
                    return { renderX: null, renderY: null, renderAngle: null };
                }
            }
        } else if (bullet.x !== undefined && bullet.y !== undefined &&
            !isNaN(bullet.x) && !isNaN(bullet.y) &&
            Math.abs(bullet.x) < 100000 && Math.abs(bullet.y) < 100000) {
            renderBulletX = bullet.x;
            renderBulletY = bullet.y;
            renderBulletAngle = bullet.angle;
        } else {
            return { renderX: null, renderY: null, renderAngle: null };
        }

        if (isNaN(renderBulletX) || isNaN(renderBulletY) ||
            Math.abs(renderBulletX) > 100000 || Math.abs(renderBulletY) > 100000) {
            console.warn('[BULLETS] Invalid bullet position, resetting:', bulletId, renderBulletX, renderBulletY);
            this.previousBulletPositions.delete(bulletId);
            return { renderX: null, renderY: null, renderAngle: null };
        }

        const prevRenderX = renderBulletX;
        const prevRenderY = renderBulletY;

        renderBulletX += Math.cos(renderBulletAngle) * bulletSpeedPerSecond * frameDelta;
        renderBulletY += Math.sin(renderBulletAngle) * bulletSpeedPerSecond * frameDelta;

        let posObj = this.previousBulletPositions.get(bulletId);
        if (!posObj) {
            posObj = { x: 0, y: 0, angle: 0 };
            this.previousBulletPositions.set(bulletId, posObj);
        }
        posObj.x = renderBulletX;
        posObj.y = renderBulletY;
        posObj.angle = renderBulletAngle;

        return { renderX: renderBulletX, renderY: renderBulletY, renderAngle: renderBulletAngle };
    }

    updateBulletGraphics(bulletId, bullet, bulletX, bulletY, renderBulletAngle) {
        let bulletGraphics = this.bulletGraphicsCache.get(bulletId);
        const weapon = bullet.weapon || 'pistol';

        let bulletColor;
        if (weapon === 'pistol') {
            bulletColor = 0xFFFF00;
        } else if (weapon === 'rifle') {
            bulletColor = 0xFF6600;
        } else if (weapon === 'machinegun') {
            bulletColor = 0xFF0000;
        } else {
            bulletColor = 0xFFFFFF;
        }

        if (!bulletGraphics) {
            bulletGraphics = new PIXI.Graphics();
            bulletGraphics.beginFill(bulletColor);
            bulletGraphics.drawRect(-6, -1, 12, 2);
            bulletGraphics.endFill();
            this.bulletGraphicsCache.set(bulletId, bulletGraphics);
            this.bulletsContainer.addChild(bulletGraphics);
            this.bulletColorCache.set(bulletId, bulletColor);
        } else {
            const lastColor = this.bulletColorCache.get(bulletId);
            if (lastColor !== bulletColor) {
                bulletGraphics.clear();
                bulletGraphics.beginFill(bulletColor);
                bulletGraphics.drawRect(-6, -1, 12, 2);
                bulletGraphics.endFill();
                this.bulletColorCache.set(bulletId, bulletColor);
            }
        }

        bulletGraphics.x = bulletX;
        bulletGraphics.y = bulletY;
        bulletGraphics.rotation = renderBulletAngle;
        bulletGraphics.visible = true;

        if (!bulletGraphics.parent) {
            this.bulletsContainer.addChild(bulletGraphics);
        }
    }

    updateVisibility() {
        for (const [bulletId, graphics] of this.bulletGraphicsCache) {
            graphics.visible = this.activeBulletIds.has(bulletId);
        }
    }

    removeBullet(bulletId) {
        const graphics = this.bulletGraphicsCache.get(bulletId);
        if (graphics && graphics.parent) {
            graphics.parent.removeChild(graphics);
        }
        this.bulletGraphicsCache.delete(bulletId);
        this.bulletColorCache.delete(bulletId);
        this.bulletPreviousStates.delete(bulletId);
        this.previousBulletPositions.delete(bulletId);
    }

    updateBulletState(bulletId, state) {
        this.bulletPreviousStates.set(bulletId, state);
    }

    trimCache() {
        if (this.previousBulletPositions.size > MAX_PREV_POSITIONS) {
            const trimCount = Math.floor(MAX_PREV_POSITIONS * TRIM_BATCH);
            const toDelete = Array.from(this.previousBulletPositions.keys()).slice(0, trimCount);
            for (const key of toDelete) {
                this.previousBulletPositions.delete(key);
            }
        }

        if (this.bulletPreviousStates.size > MAX_PREV_STATES) {
            const trimCount = Math.floor(MAX_PREV_STATES * TRIM_BATCH);
            const toDelete = Array.from(this.bulletPreviousStates.keys()).slice(0, trimCount);
            for (const key of toDelete) {
                this.bulletPreviousStates.delete(key);
            }
        }

        if (this.bulletGraphicsCache.size > MAX_GRAPHICS_CACHE) {
            const inactiveBullets = [];
            for (const [bulletId] of this.bulletGraphicsCache) {
                if (!this.activeBulletIds.has(bulletId)) {
                    inactiveBullets.push(bulletId);
                }
            }
            const trimCount = Math.floor(MAX_GRAPHICS_CACHE * TRIM_BATCH);
            for (const bulletId of inactiveBullets.slice(0, trimCount)) {
                this.removeBullet(bulletId);
            }
        }
    }

    cleanup() {
        for (const [bulletId, graphics] of this.bulletGraphicsCache) {
            if (graphics) {
                graphics.destroy();
            }
        }
        this.bulletGraphicsCache.clear();
        this.bulletColorCache.clear();
        this.bulletPreviousStates.clear();
        this.previousBulletPositions.clear();
        this.activeBulletIds.clear();
    }
}

