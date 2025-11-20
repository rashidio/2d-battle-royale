import * as PIXI from 'pixi.js';
import { TRIM_BATCH, destroyAndClearCache } from '../utils.js';

const MAX_PICKUP_CACHE = 300;

export class PickupRenderer {
    constructor(ammoContainer, weaponContainer, healthContainer) {
        this.ammoContainer = ammoContainer;
        this.weaponContainer = weaponContainer;
        this.healthContainer = healthContainer;
        this.pickupGraphicsCache = new Map();
        this.activeAmmoIds = new Set();
        this.activeWeaponIds = new Set();
        this.activeHealthIds = new Set();
    }

    render(gameState, viewport) {
        this.activeAmmoIds.clear();
        if (gameState.ammoPickups) {
            for (const ammoId in gameState.ammoPickups) {
                const ammo = gameState.ammoPickups[ammoId];
                if (!ammo.active) continue;

                if (viewport && (ammo.x < viewport.viewLeft || ammo.x > viewport.viewRight ||
                    ammo.y < viewport.viewTop || ammo.y > viewport.viewBottom)) {
                    continue;
                }

                this.activeAmmoIds.add(ammoId);

                let ammoGraphics = this.pickupGraphicsCache.get(ammoId);
                if (!ammoGraphics) {
                    ammoGraphics = new PIXI.Graphics();

                    ammoGraphics.beginFill(0x8B4513);
                    ammoGraphics.drawRect(-4, -6, 8, 12);
                    ammoGraphics.endFill();

                    ammoGraphics.beginFill(0x654321);
                    ammoGraphics.drawRect(-4, -6, 8, 3);
                    ammoGraphics.endFill();

                    ammoGraphics.beginFill(0xFFD700);
                    ammoGraphics.drawRect(-3, -3, 6, 2);
                    ammoGraphics.endFill();

                    ammoGraphics.lineStyle(1, 0x000000);
                    ammoGraphics.drawRect(-4, -6, 8, 12);
                    ammoGraphics.lineStyle(0);

                    this.pickupGraphicsCache.set(ammoId, ammoGraphics);
                    this.ammoContainer.addChild(ammoGraphics);
                }

                ammoGraphics.x = ammo.x;
                ammoGraphics.y = ammo.y;
                ammoGraphics.visible = true;
            }
        }

        for (const ammoId of this.pickupGraphicsCache.keys()) {
            if (!this.activeAmmoIds.has(ammoId)) {
                const graphics = this.pickupGraphicsCache.get(ammoId);
                if (graphics && graphics.parent === this.ammoContainer) {
                    graphics.visible = false;
                }
            }
        }

        this.activeWeaponIds.clear();
        if (gameState.weaponPickups) {
            for (const weaponId in gameState.weaponPickups) {
                const weapon = gameState.weaponPickups[weaponId];
                if (!weapon.active) continue;

                if (viewport && (weapon.x < viewport.viewLeft || weapon.x > viewport.viewRight ||
                    weapon.y < viewport.viewTop || weapon.y > viewport.viewBottom)) {
                    continue;
                }

                this.activeWeaponIds.add(weaponId);

                let weaponGraphics = this.pickupGraphicsCache.get(weaponId);
                if (!weaponGraphics) {
                    weaponGraphics = new PIXI.Graphics();

                    if (weapon.weapon === 'pistol') {
                        weaponGraphics.beginFill(0x8B4513);
                        weaponGraphics.drawRect(-8, -3, 12, 6);
                        weaponGraphics.drawRect(-2, -2, 4, 8);
                        weaponGraphics.endFill();
                        weaponGraphics.lineStyle(1, 0x654321);
                        weaponGraphics.drawRect(-8, -3, 12, 6);
                        weaponGraphics.drawRect(-2, -2, 4, 8);
                    } else if (weapon.weapon === 'rifle') {
                        weaponGraphics.beginFill(0x654321);
                        weaponGraphics.drawRect(-12, -3, 20, 6);
                        weaponGraphics.drawRect(-14, -2, 4, 8);
                        weaponGraphics.endFill();
                        weaponGraphics.lineStyle(1, 0x3E2723);
                        weaponGraphics.drawRect(-12, -3, 20, 6);
                        weaponGraphics.drawRect(-14, -2, 4, 8);
                    } else if (weapon.weapon === 'machinegun') {
                        weaponGraphics.beginFill(0x2C2C2C);
                        weaponGraphics.drawRect(-14, -3, 24, 6);
                        weaponGraphics.drawRect(-16, -2, 4, 8);
                        weaponGraphics.drawRect(8, -2, 4, 4);
                        weaponGraphics.endFill();
                        weaponGraphics.lineStyle(1, 0x1A1A1A);
                        weaponGraphics.drawRect(-14, -3, 24, 6);
                        weaponGraphics.drawRect(-16, -2, 4, 8);
                        weaponGraphics.drawRect(8, -2, 4, 4);
                    }

                    this.pickupGraphicsCache.set(weaponId, weaponGraphics);
                    this.weaponContainer.addChild(weaponGraphics);
                }

                weaponGraphics.x = weapon.x;
                weaponGraphics.y = weapon.y;
                weaponGraphics.visible = true;
            }
        }

        for (const weaponId of this.pickupGraphicsCache.keys()) {
            if (!this.activeWeaponIds.has(weaponId)) {
                const graphics = this.pickupGraphicsCache.get(weaponId);
                if (graphics && graphics.parent === this.weaponContainer) {
                    graphics.visible = false;
                }
            }
        }

        this.activeHealthIds.clear();
        if (gameState.healthPickups) {
            for (const healthId in gameState.healthPickups) {
                const health = gameState.healthPickups[healthId];
                if (!health.active) continue;

                if (viewport && (health.x < viewport.viewLeft || health.x > viewport.viewRight ||
                    health.y < viewport.viewTop || health.y > viewport.viewBottom)) {
                    continue;
                }

                this.activeHealthIds.add(healthId);

                let healthGraphics = this.pickupGraphicsCache.get(healthId);
                if (!healthGraphics) {
                    healthGraphics = new PIXI.Graphics();
                    healthGraphics.lineStyle(0);
                    healthGraphics.beginFill(0xFFFFFF);
                    healthGraphics.drawCircle(0, 0, 12);
                    healthGraphics.endFill();

                    healthGraphics.lineStyle(2, 0xFF0000);
                    healthGraphics.beginFill(0xFFFFFF, 0);
                    healthGraphics.drawCircle(0, 0, 12);
                    healthGraphics.endFill();
                    healthGraphics.lineStyle(0);

                    healthGraphics.beginFill(0xFF0000);
                    healthGraphics.drawRect(-6, -2, 12, 4);
                    healthGraphics.drawRect(-2, -6, 4, 12);
                    healthGraphics.endFill();

                    this.pickupGraphicsCache.set(healthId, healthGraphics);
                    this.healthContainer.addChild(healthGraphics);
                }

                healthGraphics.x = health.x;
                healthGraphics.y = health.y;
                healthGraphics.visible = true;
            }
        }

        for (const [healthId, graphics] of this.pickupGraphicsCache) {
            if (!this.activeHealthIds.has(healthId) && graphics.parent === this.healthContainer) {
                graphics.visible = false;
            }
        }
    }

    trimCache() {
        if (this.pickupGraphicsCache.size > MAX_PICKUP_CACHE) {
            const inactivePickups = [];
            for (const [pickupId] of this.pickupGraphicsCache) {
                const isActive = this.activeAmmoIds.has(pickupId) ||
                    this.activeWeaponIds.has(pickupId) ||
                    this.activeHealthIds.has(pickupId);
                if (!isActive) {
                    inactivePickups.push(pickupId);
                }
            }
            const trimCount = Math.floor(MAX_PICKUP_CACHE * TRIM_BATCH);
            for (const pickupId of inactivePickups.slice(0, trimCount)) {
                const graphics = this.pickupGraphicsCache.get(pickupId);
                if (graphics && graphics.parent) {
                    graphics.parent.removeChild(graphics);
                }
                this.pickupGraphicsCache.delete(pickupId);
            }
        }
    }

    cleanup() {
        for (const [pickupId, graphics] of this.pickupGraphicsCache) {
            if (graphics) {
                graphics.destroy();
            }
        }
        this.pickupGraphicsCache.clear();
        this.activeAmmoIds.clear();
        this.activeWeaponIds.clear();
        this.activeHealthIds.clear();
    }

    getActiveIds() {
        return {
            ammo: this.activeAmmoIds,
            weapon: this.activeWeaponIds,
            health: this.activeHealthIds
        };
    }
}

