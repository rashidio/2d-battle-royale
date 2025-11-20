const ANGLE_PRECISION = 10000;
const COORD_PRECISION = 100;

export const TRIM_BATCH = 0.5;

export function roundAngle(angle) {
    return Math.round(angle * ANGLE_PRECISION) / ANGLE_PRECISION;
}

export function roundCoord(coord) {
    return Math.round(coord * COORD_PRECISION) / COORD_PRECISION;
}

export function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

export function getBuildingKey(building) {
    return `${Math.round(building.x)},${Math.round(building.y)},${Math.round(building.width)},${Math.round(building.height)}`;
}

export function getTreeKey(tree) {
    return `${Math.round(tree.x)},${Math.round(tree.y)},${Math.round(tree.size)}`;
}

export function trimMap(map, maxSize, trimBatch = TRIM_BATCH) {
    if (map.size > maxSize) {
        const trimCount = Math.floor(maxSize * trimBatch);
        const toDelete = Array.from(map.keys()).slice(0, trimCount);
        for (const key of toDelete) {
            map.delete(key);
        }
    }
}

export function destroyAndClearCache(cache) {
    for (const [key, graphics] of cache) {
        if (graphics) {
            graphics.destroy();
        }
    }
    cache.clear();
}

