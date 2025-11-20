import * as PIXI from 'pixi.js';
import { destroyAndClearCache, getBuildingKey, getTreeKey } from '../utils.js';

const ZOOM = 1.5;
const MAX_CACHE_SIZE = 200;

export class WorldRenderer {
    constructor(buildingsContainer, treesContainer) {
        this.buildingsContainer = buildingsContainer;
        this.treesContainer = treesContainer;
        this.buildingGraphicsCache = new Map();
        this.treeGraphicsCache = new Map();
        this.buildingDataCache = new Map();
        this.treeDataCache = new Map();
    }

    render(gameState, playerPos, viewport) {
        if (!gameState) return;
        
        const playerX = playerPos.x || 0;
        const playerY = playerPos.y || 0;
        const viewWidth = viewport.width || window.innerWidth;
        const viewHeight = viewport.height || window.innerHeight;
        const viewportWorldWidth = viewWidth / ZOOM;
        const viewportWorldHeight = viewHeight / ZOOM;
        const maxViewportDimension = Math.max(viewportWorldWidth, viewportWorldHeight);
        const bufferDistance = 400;
        const maxDistance = maxViewportDimension / 2 + bufferDistance;
        const maxDistanceSq = maxDistance * maxDistance;

        const buildings = gameState.buildings ?? [];
        const trees = gameState.trees ?? [];
        
        this.renderBuildings(buildings, playerX, playerY, maxDistanceSq);
        this.renderTrees(trees, playerX, playerY, maxDistanceSq);
    }

    renderBuildings(buildings, playerX, playerY, maxDistanceSq) {
        if (!buildings || buildings.length === 0) return;

        const buildingKeys = new Set();
        const buildingsToCreate = [];

        for (const building of buildings) {
            const key = getBuildingKey(building);
            buildingKeys.add(key);

            if (!this.buildingGraphicsCache.has(key)) {
                buildingsToCreate.push({ building, key });
            } else {
                const existingGraphics = this.buildingGraphicsCache.get(key);
                if (existingGraphics && !existingGraphics.parent) {
                    this.buildingsContainer.addChild(existingGraphics);
                }
            }
        }

        this.createBuildings(buildingsToCreate);
        this.cleanupBuildings(buildingKeys, playerX, playerY, maxDistanceSq);
    }

    createBuildings(buildingsToCreate) {
        const buildingColors = [0x707070, 0x808080, 0x909090, 0xA0A0A0];
        const buildingLineColors = [0x505050, 0x606060, 0x707070, 0x808080];

        for (const { building, key } of buildingsToCreate) {
            const buildingGraphics = new PIXI.Graphics();
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash) + key.charCodeAt(i);
                hash = hash & hash;
            }
            const colorIndex = Math.abs(hash) % buildingColors.length;
            const buildingColor = buildingColors[colorIndex];
            const buildingLineColor = buildingLineColors[colorIndex];

            buildingGraphics.beginFill(buildingColor);
            buildingGraphics.drawRect(building.x, building.y, building.width, building.height);
            buildingGraphics.endFill();
            buildingGraphics.lineStyle(2, buildingLineColor);
            buildingGraphics.drawRect(building.x, building.y, building.width, building.height);
            buildingGraphics.lineStyle(0);

            this.buildingGraphicsCache.set(key, buildingGraphics);
            this.buildingDataCache.set(key, {
                x: building.x,
                y: building.y,
                width: building.width,
                height: building.height,
                color: buildingColor,
                lineColor: buildingLineColor
            });
            this.buildingsContainer.addChild(buildingGraphics);
        }
    }

    cleanupBuildings(buildingKeys, playerX, playerY, maxDistanceSq) {
        const buildingsToRemove = [];

        for (const [key, graphics] of this.buildingGraphicsCache) {
            if (!buildingKeys.has(key)) {
                buildingsToRemove.push(key);
            } else {
                const data = this.buildingDataCache.get(key);
                if (data) {
                    const centerX = data.x + data.width / 2;
                    const centerY = data.y + data.height / 2;
                    const dx = centerX - playerX;
                    const dy = centerY - playerY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > maxDistanceSq) {
                        buildingsToRemove.push(key);
                    }
                }
            }
        }

        for (const key of buildingsToRemove) {
            const graphics = this.buildingGraphicsCache.get(key);
            if (graphics) {
                graphics.destroy();
            }
            this.buildingGraphicsCache.delete(key);
            this.buildingDataCache.delete(key);
        }

        if (this.buildingGraphicsCache.size > MAX_CACHE_SIZE) {
            this.evictDistantBuildings(playerX, playerY);
        }
    }

    evictDistantBuildings(playerX, playerY) {
        const sorted = Array.from(this.buildingGraphicsCache.entries()).map(([key, graphics]) => {
            const data = this.buildingDataCache.get(key);
            if (data) {
                const centerX = data.x + data.width / 2;
                const centerY = data.y + data.height / 2;
                const dx = centerX - playerX;
                const dy = centerY - playerY;
                return { key, distSq: dx * dx + dy * dy };
            }
            return { key, distSq: Infinity };
        }).sort((a, b) => b.distSq - a.distSq);

        for (let i = MAX_CACHE_SIZE; i < sorted.length; i++) {
            const key = sorted[i].key;
            const graphics = this.buildingGraphicsCache.get(key);
            if (graphics) {
                graphics.destroy();
            }
            this.buildingGraphicsCache.delete(key);
            this.buildingDataCache.delete(key);
        }
    }

    renderTrees(trees, playerX, playerY, maxDistanceSq) {
        if (!trees || trees.length === 0) return;

        const treeKeys = new Set();
        const treesToCreate = [];

        for (const tree of trees) {
            const key = getTreeKey(tree);
            treeKeys.add(key);

            if (!this.treeGraphicsCache.has(key)) {
                treesToCreate.push({ tree, key });
            } else {
                const existingGraphics = this.treeGraphicsCache.get(key);
                if (existingGraphics && !existingGraphics.parent) {
                    this.treesContainer.addChild(existingGraphics);
                }
            }
        }

        this.createTrees(treesToCreate);
        this.cleanupTrees(treeKeys, playerX, playerY, maxDistanceSq);
    }

    createTrees(treesToCreate) {
        const treeColors = [0x228B22, 0x2E8B57, 0x3CB371];

        for (const { tree, key } of treesToCreate) {
            const treeGraphics = new PIXI.Graphics();
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash) + key.charCodeAt(i);
                hash = hash & hash;
            }
            const colorIndex = Math.abs(hash) % treeColors.length;
            const treeColor = treeColors[colorIndex];

            treeGraphics.beginFill(treeColor);
            treeGraphics.drawCircle(tree.x, tree.y, tree.size);
            treeGraphics.endFill();

            treeGraphics.beginFill(0x8B4513);
            treeGraphics.drawRect(tree.x - 3, tree.y + tree.size, 6, tree.size * 0.8);
            treeGraphics.endFill();

            this.treeGraphicsCache.set(key, treeGraphics);
            this.treeDataCache.set(key, {
                x: tree.x,
                y: tree.y,
                size: tree.size,
                color: treeColor
            });
            this.treesContainer.addChild(treeGraphics);
        }
    }

    cleanupTrees(treeKeys, playerX, playerY, maxDistanceSq) {
        const treesToRemove = [];

        for (const [key, graphics] of this.treeGraphicsCache) {
            if (!treeKeys.has(key)) {
                treesToRemove.push(key);
            } else {
                const data = this.treeDataCache.get(key);
                if (data) {
                    const dx = data.x - playerX;
                    const dy = data.y - playerY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > maxDistanceSq) {
                        treesToRemove.push(key);
                    }
                }
            }
        }

        for (const key of treesToRemove) {
            const graphics = this.treeGraphicsCache.get(key);
            if (graphics) {
                graphics.destroy();
            }
            this.treeGraphicsCache.delete(key);
            this.treeDataCache.delete(key);
        }

        if (this.treeGraphicsCache.size > MAX_CACHE_SIZE) {
            this.evictDistantTrees(playerX, playerY);
        }
    }

    evictDistantTrees(playerX, playerY) {
        const sorted = Array.from(this.treeGraphicsCache.entries()).map(([key, graphics]) => {
            const data = this.treeDataCache.get(key);
            if (data) {
                const dx = data.x - playerX;
                const dy = data.y - playerY;
                return { key, distSq: dx * dx + dy * dy };
            }
            return { key, distSq: Infinity };
        }).sort((a, b) => b.distSq - a.distSq);

        for (let i = MAX_CACHE_SIZE; i < sorted.length; i++) {
            const key = sorted[i].key;
            const graphics = this.treeGraphicsCache.get(key);
            if (graphics) {
                graphics.destroy();
            }
            this.treeGraphicsCache.delete(key);
            this.treeDataCache.delete(key);
        }
    }

    cleanup() {
        destroyAndClearCache(this.buildingGraphicsCache);
        destroyAndClearCache(this.treeGraphicsCache);
        this.buildingDataCache.clear();
        this.treeDataCache.clear();
    }
}

