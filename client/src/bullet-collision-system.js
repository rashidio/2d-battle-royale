import { getBuildingKey, getTreeKey } from './utils.js';

export function checkBulletCollisionClient(prevX, prevY, currentX, currentY, bulletId, gameState, hitAnimationSystem, hitBuildingKeys, hitTreeKeys) {
    if (!gameState.buildings || !gameState.trees) {
        return false;
    }

    const midX = (prevX + currentX) / 2;
    const midY = (prevY + currentY) / 2;

    for (const building of gameState.buildings) {
        if (midX >= building.x && midX <= building.x + building.width &&
            midY >= building.y && midY <= building.y + building.height) {
            const buildingKey = getBuildingKey(building);
            const lastHitTime = hitBuildingKeys.get(buildingKey);
            const now = performance.now();

            if (!lastHitTime || (now - lastHitTime) > 100) {
                const hitPoint = getBuildingHitPoint(midX, midY, building);
                hitAnimationSystem.createHitAnimation(hitPoint.x, hitPoint.y, 'building');
                hitBuildingKeys.set(buildingKey, now);
            }
            return true;
        }
    }

    for (const tree of gameState.trees) {
        const dx = midX - tree.x;
        const dy = midY - tree.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < tree.size * tree.size) {
            const treeKey = getTreeKey(tree);
            const lastHitTime = hitTreeKeys.get(treeKey);
            const now = performance.now();

            if (!lastHitTime || (now - lastHitTime) > 100) {
                const hitPoint = getTreeHitPoint(midX, midY, tree);
                hitAnimationSystem.createHitAnimation(hitPoint.x, hitPoint.y, 'tree');
                hitTreeKeys.set(treeKey, now);
            }
            return true;
        }
    }

    return false;
}

export function checkBulletHitOnDestroy(x, y, bulletId, gameState, hitAnimationSystem, hitBuildingKeys, hitTreeKeys) {
    if (x == null || y == null || isNaN(x) || isNaN(y)) {
        return;
    }

    const tolerance = 15;
    const maxCheckDistance = 500;
    const maxCheckDistanceSq = maxCheckDistance * maxCheckDistance;
    let hitSomething = false;
    let closestBuildingDist = Infinity;
    let closestBuilding = null;

    if (gameState.buildings?.length) {
        for (const building of gameState.buildings) {
            const centerX = building.x + building.width / 2;
            const centerY = building.y + building.height / 2;
            const dx = x - centerX;
            const dy = y - centerY;
            const distSq = dx * dx + dy * dy;

            if (distSq > maxCheckDistanceSq) {
                continue;
            }

            if (distSq < closestBuildingDist * closestBuildingDist) {
                closestBuildingDist = Math.sqrt(distSq);
                closestBuilding = building;
            }

            if (x + tolerance >= building.x && x - tolerance <= building.x + building.width &&
                y + tolerance >= building.y && y - tolerance <= building.y + building.height) {
                const buildingKey = getBuildingKey(building);
                const lastHitTime = hitBuildingKeys.get(buildingKey);
                const now = performance.now();

                if (!lastHitTime || (now - lastHitTime) > 100) {
                    const hitPoint = getBuildingHitPoint(x, y, building);
                    hitAnimationSystem.createHitAnimation(hitPoint.x, hitPoint.y, 'building');
                    hitBuildingKeys.set(buildingKey, now);
                    hitSomething = true;
                }
                return;
            }
        }
    }

    if (gameState.trees?.length) {
        for (const tree of gameState.trees) {
            const dx = x - tree.x;
            const dy = y - tree.y;
            const distSq = dx * dx + dy * dy;

            if (distSq > maxCheckDistanceSq) {
                continue;
            }

            const maxDist = tree.size + tolerance;
            if (distSq < maxDist * maxDist) {
                const hitPoint = getTreeHitPoint(x, y, tree);
                const treeKey = getTreeKey(tree);
                const lastHitTime = hitTreeKeys.get(treeKey);
                const now = performance.now();

                if (!lastHitTime || (now - lastHitTime) > 100) {
                    hitAnimationSystem.createHitAnimation(hitPoint.x, hitPoint.y, 'tree');
                    hitTreeKeys.set(treeKey, now);
                    hitSomething = true;
                }
                return;
            }
        }
    }
}

export function getBuildingHitPoint(bulletX, bulletY, building) {
    const centerX = building.x + building.width / 2;
    const centerY = building.y + building.height / 2;
    const dx = bulletX - centerX;
    const dy = bulletY - centerY;

    const halfWidth = building.width / 2;
    const halfHeight = building.height / 2;

    let hitX, hitY;

    if (Math.abs(dx / halfWidth) > Math.abs(dy / halfHeight)) {
        hitX = dx > 0 ? building.x + building.width : building.x;
        hitY = centerY + (dy / Math.abs(dx)) * halfWidth;
    } else {
        hitX = centerX + (dx / Math.abs(dy)) * halfHeight;
        hitY = dy > 0 ? building.y + building.height : building.y;
    }

    hitX = Math.max(building.x, Math.min(building.x + building.width, hitX));
    hitY = Math.max(building.y, Math.min(building.y + building.height, hitY));

    return { x: hitX, y: hitY };
}

export function getTreeHitPoint(bulletX, bulletY, tree) {
    const dx = bulletX - tree.x;
    const dy = bulletY - tree.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
        return { x: tree.x + tree.size, y: tree.y };
    }

    const angle = Math.atan2(dy, dx);
    const hitX = tree.x + Math.cos(angle) * tree.size;
    const hitY = tree.y + Math.sin(angle) * tree.size;

    return { x: hitX, y: hitY };
}

