import * as PIXI from 'pixi.js';

const ZOOM = 1.5;

export class HitAnimationSystem {
    constructor(worldContainer, camera, app, gameState, playerId) {
        this.worldContainer = worldContainer;
        this.camera = camera;
        this.app = app;
        this.gameState = gameState;
        this.playerId = playerId;

        this.hitAnimations = new Map();
        this.lastHitUpdateTime = 0;
        this.maxHitAnimations = 30;
        this.lastAnimationCreateTime = 0;
        this.animationCreateCooldown = 30;

        this.hitAnimationsContainer = new PIXI.Container();
        this.hitAnimationsContainer.zIndex = 1000;
        this.hitAnimationsContainer.interactiveChildren = false;
        this.worldContainer.addChild(this.hitAnimationsContainer);

        this.particleTextures = this.createParticleTextures();
    }

    createParticleTextures() {
        const canvas1 = document.createElement('canvas');
        canvas1.width = canvas1.height = 16;
        const ctx1 = canvas1.getContext('2d');
        ctx1.fillStyle = 'white';
        ctx1.beginPath();
        ctx1.arc(8, 8, 8, 0, Math.PI * 2);
        ctx1.fill();
        const sharpTexture = PIXI.Texture.from(canvas1);

        const canvas2 = document.createElement('canvas');
        canvas2.width = canvas2.height = 24;
        const ctx2 = canvas2.getContext('2d');
        const gradient = ctx2.createRadialGradient(12, 12, 0, 12, 12, 12);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx2.fillStyle = gradient;
        ctx2.fillRect(0, 0, 24, 24);
        const softTexture = PIXI.Texture.from(canvas2);

        const canvas3 = document.createElement('canvas');
        canvas3.width = canvas3.height = 32;
        const ctx3 = canvas3.getContext('2d');
        ctx3.strokeStyle = 'white';
        ctx3.lineWidth = 3;
        ctx3.beginPath();
        ctx3.arc(16, 16, 13, 0, Math.PI * 2);
        ctx3.stroke();
        const ringTexture = PIXI.Texture.from(canvas3);

        return {
            sharp: sharpTexture,
            soft: softTexture,
            ring: ringTexture
        };
    }

    createHitAnimation(x, y, type) {
        const now = performance.now();

        if (now - this.lastAnimationCreateTime < this.animationCreateCooldown) {
            return;
        }

        if (this.hitAnimations.size >= this.maxHitAnimations) {
            const oldestId = Array.from(this.hitAnimations.keys())[0];
            const oldestAnim = this.hitAnimations.get(oldestId);
            if (oldestAnim && oldestAnim.container) {
                oldestAnim.container.destroy({ children: true });
            }
            this.hitAnimations.delete(oldestId);
        }

        this.lastAnimationCreateTime = now;

        const animationId = `hit_${performance.now()}_${Math.random()}`;
        let particleCount = 20;
        let particleColor = 0xFFFFFF;
        let sparkColor = 0xFFFF00;
        let smokeColor = 0x888888;
        let impactRingColor = 0xFFFFFF;

        if (type === 'building') {
            particleCount = 25;
            particleColor = 0x888888;
            sparkColor = 0xAAAAAA;
            smokeColor = 0x666666;
            impactRingColor = 0xCCCCCC;
        } else if (type === 'tree') {
            particleCount = 22;
            particleColor = 0x4A7C59;
            sparkColor = 0x6B9B7A;
            smokeColor = 0x3D5A47;
            impactRingColor = 0x5A8B6A;
        }

        const player = this.gameState.players[this.playerId];
        const playerX = player ? player.x : x;
        const playerY = player ? player.y : y;
        const distSq = (x - playerX) ** 2 + (y - playerY) ** 2;
        const maxDistSq = 1500 ** 2;
        const distanceFactor = Math.min(1.0, distSq / maxDistSq);
        particleCount = Math.max(5, Math.floor(particleCount * (1.0 - distanceFactor * 0.75)));

        const smokeCount = Math.floor(particleCount * 0.3);

        const particleContainer = new PIXI.Container();
        particleContainer.x = x;
        particleContainer.y = y;

        const particles = [];
        const smokeParticles = [];

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 1.2;
            const speed = 30 + Math.random() * 20;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            const isSpark = Math.random() > 0.4;
            const sprite = new PIXI.Sprite(this.particleTextures.sharp);
            sprite.anchor.set(0.5);
            sprite.tint = isSpark ? sparkColor : particleColor;
            const size = 3 + Math.random() * 4;
            sprite.scale.set(size / 16);
            sprite.x = 0;
            sprite.y = 0;
            sprite.alpha = 1.0;

            particleContainer.addChild(sprite);

            particles.push({
                sprite: sprite,
                vx: vx,
                vy: vy,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.015,
                baseScale: sprite.scale.x
            });
        }

        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 10 + Math.random() * 8;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 5;

            const sprite = new PIXI.Sprite(this.particleTextures.soft);
            sprite.anchor.set(0.5);
            sprite.tint = smokeColor;
            const size = 4 + Math.random() * 6;
            sprite.scale.set(size / 24);
            sprite.x = 0;
            sprite.y = 0;
            sprite.alpha = 1.0;

            particleContainer.addChild(sprite);

            smokeParticles.push({
                sprite: sprite,
                vx: vx,
                vy: vy,
                life: 1.0,
                decay: 0.012 + Math.random() * 0.008,
                baseScale: sprite.scale.x
            });
        }

        const impactRing = new PIXI.Sprite(this.particleTextures.ring);
        impactRing.anchor.set(0.5);
        impactRing.tint = impactRingColor;
        impactRing.scale.set(0.5);
        impactRing.alpha = 0.8;
        particleContainer.addChild(impactRing);

        const impactFlash = new PIXI.Sprite(this.particleTextures.soft);
        impactFlash.anchor.set(0.5);
        impactFlash.tint = impactRingColor;
        impactFlash.scale.set(1.5);
        impactFlash.alpha = 0.6;
        particleContainer.addChild(impactFlash);

        if (!this.hitAnimationsContainer) {
            this.hitAnimationsContainer = new PIXI.Container();
            this.hitAnimationsContainer.visible = true;
            this.hitAnimationsContainer.alpha = 1.0;
            this.worldContainer.addChild(this.hitAnimationsContainer);
        }

        if (!this.hitAnimationsContainer.visible) {
            this.hitAnimationsContainer.visible = true;
        }

        this.hitAnimationsContainer.addChild(particleContainer);
        const scale = 0.7 + Math.random() * 0.6;
        this.hitAnimations.set(animationId, {
            container: particleContainer,
            particles: particles,
            smokeParticles: smokeParticles,
            impactRing: impactRing,
            impactFlash: impactFlash,
            startTime: performance.now(),
            duration: 2000,
            type: type,
            x: x,
            y: y,
            scale: scale
        });
    }

    updateHitAnimations(now) {
        if (this.hitAnimations.size === 0) return;

        const toRemove = [];
        const lastTime = this.lastHitUpdateTime || now;
        const deltaTime = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        this.lastHitUpdateTime = now;

        if (!this.hitAnimationsContainer.visible) {
            this.hitAnimationsContainer.visible = true;
        }

        const cameraX = this.camera?.x || 0;
        const cameraY = this.camera?.y || 0;
        const viewWidth = this.app?.screen?.width || window.innerWidth;
        const viewHeight = this.app?.screen?.height || window.innerHeight;
        const viewportMargin = 300;
        const viewMinX = cameraX - viewportMargin;
        const viewMaxX = cameraX + (viewWidth / ZOOM) + viewportMargin;
        const viewMinY = cameraY - viewportMargin;
        const viewMaxY = cameraY + (viewHeight / ZOOM) + viewportMargin;

        for (const [id, anim] of this.hitAnimations) {
            const elapsed = now - anim.startTime;

            if (elapsed >= anim.duration || elapsed < 0) {
                toRemove.push(id);
                continue;
            }

            const worldX = anim.x;
            const worldY = anim.y;

            const isInView = worldX >= viewMinX && worldX <= viewMaxX && worldY >= viewMinY && worldY <= viewMaxY;

            const container = anim.container;

            if (!isInView) {
                if (container) container.visible = false;
                continue;
            }

            if (!container.parent) {
                this.hitAnimationsContainer.addChild(container);
            }

            container.x = worldX;
            container.y = worldY;
            container.visible = true;

            const progress = elapsed / anim.duration;
            const animScale = anim.scale || 1.0;
            const sizeScale = animScale * (1.0 - progress * 0.3);

            const fadeInDuration = 0.15;
            const fadeOutStart = 0.7;
            let globalAlpha = 1.0;

            if (progress < fadeInDuration) {
                globalAlpha = progress / fadeInDuration;
            } else if (progress > fadeOutStart) {
                const fadeOutProgress = (progress - fadeOutStart) / (1.0 - fadeOutStart);
                globalAlpha = 1.0 - fadeOutProgress;
            }

            if (globalAlpha < 0.01) {
                container.visible = false;
                continue;
            }

            if (progress < 0.2) {
                const impactProgress = progress / 0.2;
                const ringScale = (0.5 + impactProgress * 1.5) * animScale;
                const ringAlpha = (1.0 - impactProgress) * 0.8 * globalAlpha;
                anim.impactRing.scale.set(ringScale);
                anim.impactRing.alpha = ringAlpha;
                anim.impactRing.visible = ringAlpha > 0.01;
            } else {
                anim.impactRing.visible = false;
            }

            if (progress < 0.4) {
                const flashProgress = progress / 0.4;
                const flashAlpha = (1.0 - flashProgress) * 0.6 * globalAlpha;
                const flashScale = (1.5 + flashProgress * 1.5) * animScale;
                anim.impactFlash.scale.set(flashScale);
                anim.impactFlash.alpha = flashAlpha;
                anim.impactFlash.visible = flashAlpha > 0.01;
            } else {
                anim.impactFlash.visible = false;
            }

            let hasVisibleParticles = false;

            for (const particle of anim.particles) {
                if (particle.life <= 0) {
                    particle.sprite.visible = false;
                    continue;
                }

                particle.sprite.x += particle.vx * deltaTime;
                particle.sprite.y += particle.vy * deltaTime;
                particle.vy += 0.18 * deltaTime;
                particle.life -= particle.decay * deltaTime;

                if (particle.life <= 0) {
                    particle.sprite.visible = false;
                    continue;
                }

                const fadeStart = 0.3;
                const fadeFactor = particle.life < fadeStart ? particle.life / fadeStart : 1.0;
                const alpha = Math.min(0.7, particle.life * 0.7 * fadeFactor * globalAlpha);

                if (alpha < 0.01) {
                    particle.sprite.visible = false;
                    continue;
                }

                hasVisibleParticles = true;
                const scale = particle.baseScale * sizeScale * particle.life;
                particle.sprite.scale.set(scale);
                particle.sprite.alpha = alpha;
                particle.sprite.visible = true;
            }

            for (const smoke of anim.smokeParticles) {
                if (smoke.life <= 0) {
                    smoke.sprite.visible = false;
                    continue;
                }

                smoke.sprite.x += smoke.vx * deltaTime;
                smoke.sprite.y += smoke.vy * deltaTime;
                smoke.vy -= 0.05 * deltaTime;
                smoke.life -= smoke.decay * deltaTime;

                if (smoke.life <= 0) {
                    smoke.sprite.visible = false;
                    continue;
                }

                const fadeStart = 0.3;
                const fadeFactor = smoke.life < fadeStart ? smoke.life / fadeStart : 1.0;
                const alpha = Math.min(0.8, smoke.life * 0.8 * fadeFactor * globalAlpha);

                if (alpha < 0.01) {
                    smoke.sprite.visible = false;
                    continue;
                }

                hasVisibleParticles = true;
                const scale = smoke.baseScale * (1.0 + progress * 1.5) * animScale * smoke.life;
                smoke.sprite.scale.set(scale);
                smoke.sprite.alpha = alpha;
                smoke.sprite.visible = true;
            }

            if (!hasVisibleParticles && !anim.impactRing.visible && !anim.impactFlash.visible) {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            const anim = this.hitAnimations.get(id);
            if (anim && anim.container) {
                anim.container.destroy({ children: true });
            }
            this.hitAnimations.delete(id);
        }
    }

    cleanupHitKeys(hitBuildingKeys, hitTreeKeys, now) {
        const highlightDuration = 300;
        const buildingKeysToRemove = [];
        for (const [key, hitTime] of hitBuildingKeys) {
            if (now - hitTime > highlightDuration) {
                buildingKeysToRemove.push(key);
            }
        }
        for (const key of buildingKeysToRemove) {
            hitBuildingKeys.delete(key);
        }

        const treeKeysToRemove = [];
        for (const [key, hitTime] of hitTreeKeys) {
            if (now - hitTime > highlightDuration) {
                treeKeysToRemove.push(key);
            }
        }
        for (const key of treeKeysToRemove) {
            hitTreeKeys.delete(key);
        }
    }
}

