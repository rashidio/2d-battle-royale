const ZOOM = 1.5;

export class CameraSystem {
    constructor() {
        this.x = 0;
        this.y = 0;
    }

    updatePosition(playerX, playerY, viewWidth, viewHeight) {
        this.x = playerX - viewWidth / (2 * ZOOM);
        this.y = playerY - viewHeight / (2 * ZOOM);
    }

    getViewport(viewWidth, viewHeight, margin = 100) {
        const viewLeft = this.x - margin / ZOOM;
        const viewRight = this.x + viewWidth / ZOOM + margin / ZOOM;
        const viewTop = this.y - margin / ZOOM;
        const viewBottom = this.y + viewHeight / ZOOM + margin / ZOOM;
        return { viewLeft, viewRight, viewTop, viewBottom };
    }

    getWorldPosition(screenX, screenY, viewWidth, viewHeight) {
        const worldX = (screenX / ZOOM) + this.x;
        const worldY = (screenY / ZOOM) + this.y;
        return { x: worldX, y: worldY };
    }

    applyToContainer(worldContainer) {
        worldContainer.x = -this.x * ZOOM;
        worldContainer.y = -this.y * ZOOM;
    }
}

