import * as PIXI from 'pixi.js';
import { InputManager } from './input/input-manager.js';
import { NetworkManager } from './network-manager.js';
import { checkBulletCollisionClient, checkBulletHitOnDestroy, getBuildingHitPoint, getTreeHitPoint } from './bullet-collision-system.js';
import { getBuildingKey, getTreeKey } from './utils.js';
import { PlayerStatsDisplay } from './player-stats-display.js';
import { GameStatsDisplay } from './game-stats-display.js';
import { DebugOverlay } from './debug-overlay.js';
import { WorldRenderer } from './renderers/world-renderer.js';
import { ZoneRenderer } from './renderers/zone-renderer.js';
import { PlayerRenderer } from './renderers/player-renderer.js';
import { BulletRenderer } from './renderers/bullet-renderer.js';
import { PickupRenderer } from './renderers/pickup-renderer.js';
import { HitAnimationSystem } from './hit-animation-system.js';
import { StateManager } from './state-manager.js';
import { ScreenManager } from './screen-manager.js';
import { CameraSystem } from './camera-system.js';
import { SessionManager } from './session-manager.js';
import { GameLoopManager } from './game-loop-manager.js';
import { ViewportManager } from './viewport-manager.js';
import { MessageQueueProcessor } from './message-queue-processor.js';
import { WorldScheduler } from './world-scheduler.js';
import './profiling-helper.js';

const TICK_RATE = 20;
const ZOOM = 1.5;
const INITIAL_ZONE_RADIUS = 3200;
const INTERPOLATION_DELAY_MS = 100;

const MAX_CACHED_CHUNKS = 100;
const MAX_HIGHLIGHT_STATE = 500;
const MAX_PENDING_INPUTS = 30;
const TRIM_BATCH = 0.5;
const CLEANUP_INTERVAL = 60;

class GameClient {
    constructor() {
        this.playerId = null;
        this.gameState = {
            players: {},
            bullets: {},
            buildings: [],
            trees: [],
            ammoPickups: {},
            weaponPickups: {},
            healthPickups: {},
            zoneCenter: 0,
            zoneRadius: INITIAL_ZONE_RADIUS,
            gameTime: 0,
            phase: 'lobby'
        };

        this.inputManager = new InputManager(this);
        this.networkManager = new NetworkManager(this);
        this.stateManager = new StateManager(this);
        this.screenManager = new ScreenManager(this);
        this.sessionManager = new SessionManager();
        this.gameLoopManager = new GameLoopManager(this);
        this.viewportManager = new ViewportManager();
        this.playerStatsDisplay = new PlayerStatsDisplay();
        this.gameStatsDisplay = new GameStatsDisplay();
        this.debugOverlay = new DebugOverlay();
        this.mousePos = { x: 0, y: 0 };
        this.lastInput = { moveX: 0, moveY: 0, angle: 0 };
        this.lastShootTime = 0;
        this.shootCooldown = 200;
        this.lastSendTime = 0;
        this.sendInterval = 1000 / TICK_RATE;
        this.lastFrameTime = performance.now();
        this.deltaTime = 0;

        this.serverStates = new Map();
        this.lastServerTime = 0;
        this.clientPrediction = { x: null, y: null, angle: 0 };
        this.lastMovementDir = { x: 0, y: 0 };
        this.lastServerUpdateTime = 0;
        this.lookAngle = null;
        this.lastServerPos = { x: null, y: null };
        this.inputSequence = 0;
        this.pendingInputs = [];
        this.lastAcknowledgedInputId = -1;
        this.lastMovementInputTime = 0;
        this.intendedMove = { x: 0, y: 0 };
        this.interpolationDelay = INTERPOLATION_DELAY_MS;
        this.wasAlive = true;
        this.frameTimes = [];
        this.lastFPSUpdate = 0;
        this.fps = 0;
        this.frameTime = 0;
        this.cpuTime = 0;
        this.lastPingTime = 0;
        this.ping = 0;
        this.updateTime = 0;
        this.lastMovementTime = 0;
        this.hitBuildingKeys = new Map();
        this.hitTreeKeys = new Map();
        this.buildingHighlightState = new Map();
        this.treeHighlightState = new Map();
        this.correctionCount = 0;
        this.snapCorrectionCount = 0;
        this.smoothCorrectionCount = 0;
        this.minorCorrectionCount = 0;
        this.skippedCorrectionCount = 0;
        this.lastCorrectionError = 0;
        this.maxCorrectionError = 0;
        this.minCorrectionError = Infinity;
        this.totalCorrectionError = 0;
        this.correctionErrorSamples = 0;
        this.expensiveOpsCount = 0;
        this.wsBytesSent = 0;
        this.cachedChunks = new Map();
        this.messageQueueProcessor = new MessageQueueProcessor(this);
        this.worldScheduler = new WorldScheduler(this);
        this.isTabVisible = !document.hidden;

        this.sessionManager.loadSession();
        this.init();
    }

    get sessionId() {
        return this.sessionManager.getSessionId();
    }

    set sessionId(value) {
        this.sessionManager.setSessionId(value);
    }

    async init() {
        const updateCanvasSize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            return { width, height };
        };

        const { width, height } = updateCanvasSize();

        this.app = new PIXI.Application();
        await this.app.init({
            width,
            height,
            backgroundColor: 0x87CEEB,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            resizeTo: window
        });

        document.getElementById('gameContainer').appendChild(this.app.canvas);

        window.addEventListener('resize', () => {
            const { width, height } = updateCanvasSize();
            this.app.renderer.resize(width, height);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const { width, height } = updateCanvasSize();
                this.app.renderer.resize(width, height);
            }, 100);
        });

        this.setupScene();
        this.inputManager.setup(this.app.view);
        this.gameLoopManager.start(
            () => this.handleInput(),
            () => {
                this.render();
                this.updateUI();
            }
        );

        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.screenManager.startGame());
        }

        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.screenManager.newGame());
        }

        const respawnBtn = document.getElementById('respawnBtn');
        if (respawnBtn) {
            respawnBtn.addEventListener('click', () => this.screenManager.respawn());
        }

        const debugCheckbox = document.getElementById('debugCheckbox');
        if (debugCheckbox) {
            const debugEnabled = localStorage.getItem('debugEnabled') === 'true';
            debugCheckbox.checked = debugEnabled;
            this.updateDebugVisibility(debugEnabled);

            debugCheckbox.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('debugEnabled', enabled.toString());
                this.updateDebugVisibility(enabled);
            });
        }
    }

    updateDebugVisibility(enabled) {
        this.debugOverlay.setVisible(enabled);
    }

    setupScene() {
        this.worldContainer = new PIXI.Container();
        this.worldContainer.scale.set(ZOOM);
        this.app.stage.addChild(this.worldContainer);

        this.camera = new CameraSystem();

        this.background = new PIXI.Graphics();
        this.background.visible = false;
        this.worldContainer.addChild(this.background);

        this.zoneRenderer = new ZoneRenderer(this.worldContainer);

        this.buildingsContainer = new PIXI.Container();
        this.buildingsContainer.cullable = true;
        this.buildingsContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.buildingsContainer);

        this.treesContainer = new PIXI.Container();
        this.treesContainer.cullable = true;
        this.treesContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.treesContainer);

        this.worldRenderer = new WorldRenderer(this.buildingsContainer, this.treesContainer);

        this.playersContainer = new PIXI.Container();
        this.playersContainer.cullable = true;
        this.playersContainer.interactiveChildren = false;
        this.playersContainer.visible = true;
        this.worldContainer.addChild(this.playersContainer);

        this.playerRenderer = new PlayerRenderer(this.playersContainer);

        this.bulletsContainer = new PIXI.Container();
        this.bulletsContainer.cullable = false;
        this.bulletsContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.bulletsContainer);

        this.bulletRenderer = new BulletRenderer(this.bulletsContainer);

        this.ammoContainer = new PIXI.Container();
        this.ammoContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.ammoContainer);

        this.weaponContainer = new PIXI.Container();
        this.weaponContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.weaponContainer);

        this.healthContainer = new PIXI.Container();
        this.healthContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.healthContainer);

        this.pickupRenderer = new PickupRenderer(this.ammoContainer, this.weaponContainer, this.healthContainer);

        this.hitAnimationSystem = new HitAnimationSystem(
            this.worldContainer,
            this.camera,
            this.app,
            this.gameState,
            this.playerId
        );
    }

    scheduleGenerateWorld() {
        this.worldScheduler.scheduleGenerate(() => this.generateWorld());
    }

    scheduleMessageProcessing() {
        this.messageQueueProcessor.scheduleProcessing();
    }

    enqueueMessage(message) {
        this.messageQueueProcessor.enqueue(message);
    }


    generateWorld() {
        const player = this.gameState.players[this.playerId];
        const playerPos = player ? { x: player.x, y: player.y } : { x: 0, y: 0 };
        const viewport = {
            width: this.app?.screen?.width || window.innerWidth,
            height: this.app?.screen?.height || window.innerHeight
        };
        this.worldRenderer.render(this.gameState, playerPos, viewport);
    }



    sendShoot() {
        this.networkManager.sendShoot();
    }

    sendShootWithAngle(angle) {
        this.networkManager.sendShootWithAngle(angle);
    }

    cleanup() {
        this.gameLoopManager.stop();

        this.messageQueueProcessor.cleanup();
        this.worldScheduler.cleanup();
        this.networkManager.cleanup();
        this.playerStatsDisplay.cleanup();

        if (this.worldRenderer) this.worldRenderer.cleanup();
        if (this.zoneRenderer) this.zoneRenderer.cleanup();
        if (this.playerRenderer) this.playerRenderer.cleanup();
        if (this.bulletRenderer) this.bulletRenderer.cleanup();
        if (this.pickupRenderer) this.pickupRenderer.cleanup();

        if (this.app) {
            try {
                this.app.destroy(true, { children: true, texture: true, baseTexture: true });
                this.app = null;
            } catch (e) {
                console.error('Error destroying PIXI app:', e);
            }
        }
    }

    handleWorldChunks(chunks) {
        if (!chunks || !Array.isArray(chunks)) return;

        const isInitialLoad = (!this.gameState.buildings || this.gameState.buildings.length === 0) &&
            (!this.gameState.trees || this.gameState.trees.length === 0);

        if (!this.gameState.buildings) {
            this.gameState.buildings = [];
        }
        if (!this.gameState.trees) {
            this.gameState.trees = [];
        }

        if (!this.loadedBuildingKeys) {
            this.loadedBuildingKeys = new Set();
            for (let i = 0; i < this.gameState.buildings.length; i++) {
                const b = this.gameState.buildings[i];
                const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
                this.loadedBuildingKeys.add(key);
            }
        }

        if (!this.loadedTreeKeys) {
            this.loadedTreeKeys = new Set();
            for (let i = 0; i < this.gameState.trees.length; i++) {
                const t = this.gameState.trees[i];
                const key = `${Math.round(t.x)},${Math.round(t.y)},${Math.round(t.size)}`;
                this.loadedTreeKeys.add(key);
            }
        }

        let chunkIndex = 0;

        const processChunkBatch = () => {
            const batchSize = 10;
            const endIndex = Math.min(chunkIndex + batchSize, chunks.length);

            for (let i = chunkIndex; i < endIndex; i++) {
                const chunk = chunks[i];
                const chunkKey = `${chunk.chunkX},${chunk.chunkY}`;
                this.cachedChunks.set(chunkKey, chunk);

                const buildings = chunk.buildings;
                if (buildings) {
                    for (let j = 0; j < buildings.length; j++) {
                        const building = buildings[j];
                        const key = getBuildingKey(building);

                        if (!this.loadedBuildingKeys.has(key) && !this.worldRenderer.buildingDataCache.has(key)) {
                            this.loadedBuildingKeys.add(key);
                            this.gameState.buildings.push(building);
                        }
                    }
                }

                const trees = chunk.trees;
                if (trees) {
                    for (let j = 0; j < trees.length; j++) {
                        const tree = trees[j];
                        const key = getTreeKey(tree);

                        if (!this.loadedTreeKeys.has(key) && !this.worldRenderer.treeDataCache.has(key)) {
                            this.loadedTreeKeys.add(key);
                            this.gameState.trees.push(tree);
                        }
                    }
                }
            }

            chunkIndex = endIndex;

            if (isInitialLoad || chunkIndex >= chunks.length) {
                this.generateWorld();
            } else {
                this.scheduleGenerateWorld();
            }

            if (chunkIndex < chunks.length) {
                setTimeout(processChunkBatch, 0);
            }
        };

        processChunkBatch();
    }


    applyStateDiff(diff) {
        this.stateManager.applyStateDiff(diff);
    }

    updateGameState(state) {
        this.stateManager.updateGameState(state);
    }

    showDeathScreen() {
        this.screenManager.showDeathScreen();
    }

    hideDeathScreen() {
        this.screenManager.hideDeathScreen();
    }

    respawn() {
        this.screenManager.respawn();
    }

    showVictoryScreen() {
        this.screenManager.showVictoryScreen();
    }

    startGame() {
        this.screenManager.startGame();
    }

    newGame() {
        this.screenManager.newGame();
    }

    updateUI() {
        const player = this.gameState.players[this.playerId];
        if (player) {
            this.playerStatsDisplay.update(player);
        }

        this.gameStatsDisplay.update(this.gameState);
        this.debugOverlay.update(this);
    }

    handleInput() {
        this.inputManager.process();
    }


    render() {
        if (window.profilingHelper) {
            window.profilingHelper.collectMetrics();
        }

        if (!this.playerId) {
            if (this.gameState.buildings?.length) {
                const viewWidth = this.app.screen.width;
                const viewHeight = this.app.screen.height;
                this.worldRenderer.render(this.gameState, { x: 0, y: 0 }, { width: viewWidth, height: viewHeight });
            }
            return;
        }

        const player = this.gameState.players[this.playerId];
        if (!player) {
            console.warn('No player found in gameState for:', this.playerId);
            return;
        }

        if (!this.worldContainer || !this.playersContainer || !this.bulletsContainer) {
            console.warn('Containers not initialized');
            return;
        }

        const viewWidth = this.app.screen.width;
        const viewHeight = this.app.screen.height;

        const renderX = (this.clientPrediction.x !== null) ? this.clientPrediction.x : player.x;
        const renderY = (this.clientPrediction.y !== null) ? this.clientPrediction.y : player.y;

        this.camera.updatePosition(renderX, renderY, viewWidth, viewHeight);
        this.camera.applyToContainer(this.worldContainer);

        this.zoneRenderer.render(
            this.gameState.zoneCenter,
            this.gameState.zoneRadius,
            { x: renderX, y: renderY },
            this.deltaTime
        );


        const { viewLeft, viewRight, viewTop, viewBottom } = this.camera.getViewport(viewWidth, viewHeight);

        if (!this.viewportInfo) {
            this.viewportInfo = {};
        }
        this.viewportInfo.width = viewWidth;
        this.viewportInfo.height = viewHeight;
        this.viewportInfo.worldWidth = viewRight - viewLeft;
        this.viewportInfo.worldHeight = viewBottom - viewTop;
        this.viewportInfo.left = viewLeft;
        this.viewportInfo.right = viewRight;
        this.viewportInfo.top = viewTop;
        this.viewportInfo.bottom = viewBottom;

        const viewport = { viewLeft, viewRight, viewTop, viewBottom };
        
        this.worldRenderer.render(
            this.gameState,
            { x: renderX, y: renderY },
            { width: viewWidth, height: viewHeight }
        );
        
        const buildingStats = this.viewportManager.cullBuildings(
            this.worldRenderer.buildingGraphicsCache,
            this.worldRenderer.buildingDataCache,
            viewport,
            this.hitBuildingKeys,
            this.buildingHighlightState
        );
        const treeStats = this.viewportManager.cullTrees(
            this.worldRenderer.treeGraphicsCache,
            this.worldRenderer.treeDataCache,
            viewport,
            this.hitTreeKeys,
            this.treeHighlightState
        );

        if (!this.renderStats) {
            this.renderStats = {};
        }

        this.playerRenderer.render(
            this.gameState,
            this.playerId,
            this.clientPrediction,
            { viewLeft, viewRight, viewTop, viewBottom },
            this.deltaTime,
            this.renderStats
        );

        this.bulletRenderer.render(
            this.gameState,
            { viewLeft, viewRight, viewTop, viewBottom },
            this.deltaTime,
            this.interpolationDelay,
            performance.now(),
            (x, y, bulletId) => this.checkBulletHitOnDestroy(x, y, bulletId)
        );

        this.hitAnimationSystem.updateHitAnimations(performance.now());
        this.hitAnimationSystem.cleanupHitKeys(this.hitBuildingKeys, this.hitTreeKeys, performance.now());

        this.pickupRenderer.render(this.gameState, { viewLeft, viewRight, viewTop, viewBottom });

        if (!this.cacheCleanupCounter) this.cacheCleanupCounter = 0;
        if (++this.cacheCleanupCounter >= CLEANUP_INTERVAL) {
            this.cacheCleanupCounter = 0;

            this.bulletRenderer.trimCache();
            this.playerRenderer.trimCache();
            this.pickupRenderer.trimCache();

            if (this.cachedChunks.size > MAX_CACHED_CHUNKS) {
                const trimCount = Math.floor(MAX_CACHED_CHUNKS * TRIM_BATCH);
                let count = 0;
                for (const key of this.cachedChunks.keys()) {
                    if (count++ >= trimCount) break;
                    this.cachedChunks.delete(key);
                }
            }

            if (this.buildingHighlightState.size > MAX_HIGHLIGHT_STATE) {
                const trimCount = Math.floor(MAX_HIGHLIGHT_STATE * TRIM_BATCH);
                let count = 0;
                for (const key of this.buildingHighlightState.keys()) {
                    if (count++ >= trimCount) break;
                    this.buildingHighlightState.delete(key);
                }
            }

            if (this.treeHighlightState.size > MAX_HIGHLIGHT_STATE) {
                const trimCount = Math.floor(MAX_HIGHLIGHT_STATE * TRIM_BATCH);
                let count = 0;
                for (const key of this.treeHighlightState.keys()) {
                    if (count++ >= trimCount) break;
                    this.treeHighlightState.delete(key);
                }
            }

            if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
                const keepCount = Math.floor(MAX_PENDING_INPUTS * (1 - TRIM_BATCH));
                this.pendingInputs = this.pendingInputs.slice(-keepCount);
            }
        }

        this.renderStats.buildingsVisible = buildingStats.buildingsVisible;
        this.renderStats.buildingsTotal = buildingStats.buildingsTotal;
        this.renderStats.treesVisible = treeStats.treesVisible;
        this.renderStats.treesTotal = treeStats.treesTotal;
    }

    checkBulletCollisionClient(prevX, prevY, currentX, currentY, bulletId) {
        return checkBulletCollisionClient(
            prevX, prevY, currentX, currentY, bulletId,
            this.gameState,
            this.hitAnimationSystem,
            this.hitBuildingKeys,
            this.hitTreeKeys
        );
    }

    checkBulletHitOnDestroy(x, y, bulletId) {
        return checkBulletHitOnDestroy(
            x, y, bulletId,
            this.gameState,
            this.hitAnimationSystem,
            this.hitBuildingKeys,
            this.hitTreeKeys
        );
    }

    getBuildingHitPoint(bulletX, bulletY, building) {
        return getBuildingHitPoint(bulletX, bulletY, building);
    }

    getTreeHitPoint(bulletX, bulletY, tree) {
        return getTreeHitPoint(bulletX, bulletY, tree);
    }


}

window.addEventListener('load', () => {
    window.gameClient = new GameClient();
});

window.addEventListener('beforeunload', () => {
    if (window.gameClient) {
        window.gameClient.cleanup();
    }
});

window.addEventListener('pagehide', () => {
    if (window.gameClient) {
        window.gameClient.cleanup();
    }
});

