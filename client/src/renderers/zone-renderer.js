import * as PIXI from 'pixi.js';

const ZOOM = 1.5;

export class ZoneRenderer {
    constructor(worldContainer) {
        this.worldContainer = worldContainer;
        this.zoneGraphics = new PIXI.Graphics();
        this.zoneGraphics.cullable = false;
        this.zoneGraphics.zIndex = -1;
        this.worldContainer.addChild(this.zoneGraphics);

        this.zoneIndicatorGraphics = new PIXI.Graphics();
        this.zoneIndicatorGraphics.visible = true;
        this.zoneIndicatorGraphics.alpha = 1.0;
        this.zoneIndicatorGraphics.zIndex = 1000;
        this.worldContainer.addChild(this.zoneIndicatorGraphics);

        this.interpolatedZoneRadius = 0;
        this.interpolatedZoneCenter = 0;
        this.lastRenderedZoneRadius = 0;
        this.lastRenderedZoneCenter = 0;
        this.lastZoneRadius = 0;
        this.lastZoneCenter = 0;
        this.lastZoneArrowAngle = undefined;
        this.zoneIndicatorHasArrow = false;
    }

    render(zoneCenter, zoneRadius, playerPos, deltaTime) {
        if (zoneCenter === undefined || zoneRadius === undefined) {
            return;
        }

        const frameDelta = Math.min(deltaTime || 0.016, 0.05);

        if (this.interpolatedZoneRadius === 0) {
            this.interpolatedZoneRadius = zoneRadius;
        }
        if (this.interpolatedZoneCenter === 0) {
            this.interpolatedZoneCenter = zoneCenter;
        }

        const smoothingTime = 0.1;
        const smoothingFactor = Math.min(1.0, frameDelta / smoothingTime);

        const radiusDiff = zoneRadius - this.interpolatedZoneRadius;
        const centerDiff = zoneCenter - this.interpolatedZoneCenter;

        this.interpolatedZoneRadius += radiusDiff * smoothingFactor;
        this.interpolatedZoneCenter += centerDiff * smoothingFactor;

        const renderRadius = this.interpolatedZoneRadius;
        const renderCenter = this.interpolatedZoneCenter;

        this.renderZoneCircle(renderCenter, renderRadius);
        this.renderZoneIndicator(renderCenter, renderRadius, playerPos);

        if (zoneRadius !== this.lastZoneRadius || zoneCenter !== this.lastZoneCenter) {
            this.lastZoneCenter = zoneCenter;
            this.lastZoneRadius = zoneRadius;
        }
    }

    renderZoneCircle(renderCenter, renderRadius) {
        const needsRedraw = Math.abs(renderRadius - this.lastRenderedZoneRadius) > 0.1 ||
            Math.abs(renderCenter - this.lastRenderedZoneCenter) > 0.1;

        if (needsRedraw) {
            this.zoneGraphics.clear();

            const buffer = 10000;
            const worldSize = (renderRadius + buffer) * 2;
            const worldOffset = renderCenter - renderRadius - buffer;

            this.zoneGraphics.beginFill(0x90EE90, 1.0);
            this.zoneGraphics.drawRect(worldOffset, worldOffset, worldSize, worldSize);
            this.zoneGraphics.endFill();

            this.zoneGraphics.beginFill(0xFF0000, 0.4);
            this.zoneGraphics.drawRect(worldOffset, worldOffset, worldSize, worldSize);
            this.zoneGraphics.endFill();

            this.zoneGraphics.beginFill(0x90EE90, 1.0);
            this.zoneGraphics.drawCircle(renderCenter, renderCenter, renderRadius);
            this.zoneGraphics.endFill();

            this.zoneGraphics.lineStyle(2, 0x00FF00, 0.6);
            this.zoneGraphics.drawCircle(renderCenter, renderCenter, renderRadius);
            this.zoneGraphics.lineStyle(0);

            this.lastRenderedZoneCenter = renderCenter;
            this.lastRenderedZoneRadius = renderRadius;
        }
    }

    renderZoneIndicator(renderCenter, renderRadius, playerPos) {
        if (!this.zoneIndicatorGraphics) return;

        const renderX = playerPos.x;
        const renderY = playerPos.y;

        const dx = renderCenter - renderX;
        const dy = renderCenter - renderY;
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
        const distanceToZone = distanceToCenter - renderRadius;
        const minDistance = 40.0;

        if (distanceToZone > minDistance) {
            const angleToCenter = Math.atan2(dy, dx);

            const angleDiff = this.lastZoneArrowAngle !== undefined ?
                Math.abs(angleToCenter - this.lastZoneArrowAngle) : 1.0;

            if (angleDiff > 0.05) {
                this.zoneIndicatorGraphics.clear();
                this.zoneIndicatorHasArrow = false;

                const nearestZoneX = renderCenter + Math.cos(angleToCenter) * renderRadius;
                const nearestZoneY = renderCenter + Math.sin(angleToCenter) * renderRadius;

                const dirX = nearestZoneX - renderX;
                const dirY = nearestZoneY - renderY;
                const dirLengthSq = dirX * dirX + dirY * dirY;

                if (dirLengthSq > 0) {
                    const dirLength = Math.sqrt(dirLengthSq);
                    const normalizedDirX = dirX / dirLength;
                    const normalizedDirY = dirY / dirLength;
                    const arrowAngle = Math.atan2(normalizedDirY, normalizedDirX);

                    const arrowSize = 12.0;
                    const arrowOffset = 20.0;
                    const arrowX = renderX + normalizedDirX * arrowOffset;
                    const arrowY = renderY + normalizedDirY * arrowOffset;

                    const arrowTipX = arrowX + Math.cos(arrowAngle) * arrowSize;
                    const arrowTipY = arrowY + Math.sin(arrowAngle) * arrowSize;
                    const arrowLeftX = arrowX + Math.cos(arrowAngle + Math.PI * 0.75) * arrowSize * 0.5;
                    const arrowLeftY = arrowY + Math.sin(arrowAngle + Math.PI * 0.75) * arrowSize * 0.5;
                    const arrowRightX = arrowX + Math.cos(arrowAngle - Math.PI * 0.75) * arrowSize * 0.5;
                    const arrowRightY = arrowY + Math.sin(arrowAngle - Math.PI * 0.75) * arrowSize * 0.5;

                    this.zoneIndicatorGraphics.beginFill(0x00FF00, 0.9);
                    this.zoneIndicatorGraphics.moveTo(arrowTipX, arrowTipY);
                    this.zoneIndicatorGraphics.lineTo(arrowLeftX, arrowLeftY);
                    this.zoneIndicatorGraphics.lineTo(arrowX, arrowY);
                    this.zoneIndicatorGraphics.lineTo(arrowRightX, arrowRightY);
                    this.zoneIndicatorGraphics.lineTo(arrowTipX, arrowTipY);
                    this.zoneIndicatorGraphics.endFill();

                    this.lastZoneArrowAngle = angleToCenter;
                    this.zoneIndicatorHasArrow = true;
                }
            }
        } else {
            if (this.zoneIndicatorHasArrow) {
                this.zoneIndicatorGraphics.clear();
                this.zoneIndicatorHasArrow = false;
            }
            this.lastZoneArrowAngle = undefined;
        }
    }

    cleanup() {
        if (this.zoneGraphics) {
            this.zoneGraphics.destroy();
        }
        if (this.zoneIndicatorGraphics) {
            this.zoneIndicatorGraphics.destroy();
        }
    }
}

