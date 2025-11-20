const PLAYER_RADIUS = 8;

export function canMoveInDirection(startX, startY, moveX, moveY, moveSpeed, buildings, trees, radius = PLAYER_RADIUS) {
    if (moveX === 0 && moveY === 0) return false;
    const targetX = startX + moveX * moveSpeed;
    const targetY = startY + moveY * moveSpeed;
    const hasBuildings = buildings && buildings.length > 0;
    const hasTrees = trees && trees.length > 0;
    if (!hasBuildings && !hasTrees) {
        return true;
    }
    if (hasBuildings) {
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            if (!building) continue;
            if (targetX + radius >= building.x && targetX - radius <= building.x + building.width &&
                targetY + radius >= building.y && targetY - radius <= building.y + building.height) {
                return false;
            }
        }
    }
    if (hasTrees) {
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            if (!tree) continue;
            const treeSize = tree.size !== undefined ? tree.size : tree.Size;
            if (treeSize === undefined) continue;
            const dx = targetX - tree.x;
            const dy = targetY - tree.y;
            const minDist = treeSize + radius;
            if (dx * dx + dy * dy < minDist * minDist) {
                return false;
            }
        }
    }
    return true;
}

export function applyMovementWithCollisions(startX, startY, moveX, moveY, moveSpeed, buildings, trees, radius = PLAYER_RADIUS) {
    let targetX = startX + moveX * moveSpeed;
    let targetY = startY + moveY * moveSpeed;
    const hasBuildings = buildings && buildings.length > 0;
    const hasTrees = trees && trees.length > 0;
    if (!hasBuildings && !hasTrees) {
        return { x: targetX, y: targetY, moved: true, blocked: false };
    }
    let resultX = startX;
    let resultY = startY;
    let testX = targetX;
    let testY = startY;
    let canMoveX = true;
    if (hasBuildings) {
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            if (!building) continue;
            if (testX + radius >= building.x && testX - radius <= building.x + building.width &&
                testY + radius >= building.y && testY - radius <= building.y + building.height) {
                canMoveX = false;
                break;
            }
        }
    }
    if (canMoveX && hasTrees) {
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            if (!tree) continue;
            const treeSize = tree.size !== undefined ? tree.size : tree.Size;
            if (treeSize === undefined) continue;
            const dx = testX - tree.x;
            const dy = testY - tree.y;
            const minDist = treeSize + radius;
            if (dx * dx + dy * dy < minDist * minDist) {
                canMoveX = false;
                break;
            }
        }
    }
    if (canMoveX) {
        resultX = targetX;
    }
    testX = resultX;
    testY = targetY;
    let canMoveY = true;
    if (hasBuildings) {
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            if (!building) continue;
            if (testX + radius >= building.x && testX - radius <= building.x + building.width &&
                testY + radius >= building.y && testY - radius <= building.y + building.height) {
                canMoveY = false;
                break;
            }
        }
    }
    if (canMoveY && hasTrees) {
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            if (!tree) continue;
            const treeSize = tree.size !== undefined ? tree.size : tree.Size;
            if (treeSize === undefined) continue;
            const dx = testX - tree.x;
            const dy = testY - tree.y;
            const minDist = treeSize + radius;
            if (dx * dx + dy * dy < minDist * minDist) {
                canMoveY = false;
                break;
            }
        }
    }
    if (canMoveY) {
        resultY = targetY;
    }
    const moved = Math.abs(resultX - startX) > 0.01 || Math.abs(resultY - startY) > 0.01;
    const intendedMoveDist = Math.sqrt(moveX * moveX + moveY * moveY) * moveSpeed;
    const actualMoveDist = Math.sqrt((resultX - startX) * (resultX - startX) + (resultY - startY) * (resultY - startY));
    const blocked = intendedMoveDist > 0.1 && actualMoveDist < intendedMoveDist * 0.5;
    return { x: resultX, y: resultY, moved: moved, blocked: blocked };
}

export function resolveCircleRectCollision(x, y, radius, rect) {
    let px = x;
    let py = y;
    let adjusted = false;
    const rectMinX = rect.x;
    const rectMaxX = rect.x + rect.width;
    const rectMinY = rect.y;
    const rectMaxY = rect.y + rect.height;
    const closestX = Math.max(rectMinX, Math.min(px, rectMaxX));
    const closestY = Math.max(rectMinY, Math.min(py, rectMaxY));
    if (closestX === px && closestY === py) {
        if (px >= rectMinX && px <= rectMaxX && py >= rectMinY && py <= rectMaxY) {
            const overlapLeft = (px + radius) - rectMinX;
            const overlapRight = rectMaxX - (px - radius);
            const overlapTop = (py + radius) - rectMinY;
            const overlapBottom = rectMaxY - (py - radius);
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapLeft) {
                px = rectMinX - radius;
            } else if (minOverlap === overlapRight) {
                px = rectMaxX + radius;
            } else if (minOverlap === overlapTop) {
                py = rectMinY - radius;
            } else {
                py = rectMaxY + radius;
            }
            adjusted = true;
        }
    } else {
        const dx = px - closestX;
        const dy = py - closestY;
        const distSq = dx * dx + dy * dy;
        if (distSq < radius * radius) {
            let dist = Math.sqrt(distSq);
            if (dist < 0.0001) {
                dist = 0.0001;
            }
            const push = radius - dist;
            px += (dx / dist) * push;
            py += (dy / dist) * push;
            adjusted = true;
        }
    }
    return { x: px, y: py, adjusted };
}

export function resolveStaticCollisions(prediction, buildings, trees, radius = PLAYER_RADIUS) {
    if (prediction.x === null || prediction.y === null) return prediction;
    const hasBuildings = buildings && buildings.length > 0;
    const hasTrees = trees && trees.length > 0;
    if (!hasBuildings && !hasTrees) return prediction;

    let x = prediction.x;
    let y = prediction.y;
    const maxIterations = 2;
    let iteration = 0;
    while (iteration < maxIterations) {
        let adjusted = false;
        if (hasBuildings) {
            for (const building of buildings) {
                if (!building) continue;
                const result = resolveCircleRectCollision(x, y, radius, building);
                if (result.adjusted) {
                    x = result.x;
                    y = result.y;
                    adjusted = true;
                    break;
                }
            }
        }
        if (!adjusted && hasTrees) {
            for (const tree of trees) {
                if (!tree) continue;
                const treeSize = tree.size !== undefined ? tree.size : tree.Size;
                if (treeSize === undefined) continue;
                const minDist = treeSize + radius;
                if (minDist <= 0) continue;
                let dx = x - tree.x;
                let dy = y - tree.y;
                let distSq = dx * dx + dy * dy;
                const minDistSq = minDist * minDist;
                if (distSq < minDistSq) {
                    if (distSq < 0.0001) {
                        x = tree.x + minDist;
                        y = tree.y;
                    } else {
                        const dist = Math.sqrt(distSq);
                        const push = minDist - dist;
                        x += (dx / dist) * push;
                        y += (dy / dist) * push;
                    }
                    adjusted = true;
                    break;
                }
            }
        }
        if (!adjusted) break;
        iteration++;
    }
    return { x, y };
}
