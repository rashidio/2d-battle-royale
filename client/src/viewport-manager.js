export class ViewportManager {
    cullBuildings(buildingGraphicsCache, buildingDataCache, viewport, hitBuildingKeys, buildingHighlightState) {
        const { viewLeft, viewRight, viewTop, viewBottom } = viewport;
        let buildingsVisible = 0;
        let buildingsTotal = 0;

        for (const [key, buildingGraphics] of buildingGraphicsCache) {
            buildingsTotal++;
            const data = buildingDataCache.get(key);
            if (data) {
                const buildingRight = data.x + data.width;
                const buildingBottom = data.y + data.height;
                const isVisible = !(buildingRight < viewLeft || data.x > viewRight ||
                    buildingBottom < viewTop || data.y > viewBottom);
                buildingGraphics.visible = isVisible;
                if (isVisible) buildingsVisible++;

                const isHit = hitBuildingKeys.has(key);
                const lastState = buildingHighlightState.get(key);

                if (isHit) {
                    if (lastState !== true) {
                        buildingHighlightState.set(key, true);
                    }
                    const hitTime = hitBuildingKeys.get(key);
                    const currentTime = performance.now();
                    const elapsed = currentTime - hitTime;
                    const highlightDuration = 300;
                    if (elapsed < highlightDuration) {
                        const progress = Math.min(1.0, elapsed / highlightDuration);
                        const flashIntensity = Math.sin(progress * Math.PI) * 0.5 + 0.5;

                        buildingGraphics.tint = 0xFF6B35;
                        buildingGraphics.alpha = 0.5 + flashIntensity * 0.5;
                    } else {
                        hitBuildingKeys.delete(key);
                        buildingHighlightState.set(key, false);
                        buildingGraphics.tint = 0xFFFFFF;
                        buildingGraphics.alpha = 1.0;
                    }
                } else if (lastState === true) {
                    buildingHighlightState.set(key, false);
                    buildingGraphics.tint = 0xFFFFFF;
                    buildingGraphics.alpha = 1.0;
                }
            }
        }

        return { buildingsVisible, buildingsTotal };
    }

    cullTrees(treeGraphicsCache, treeDataCache, viewport, hitTreeKeys, treeHighlightState) {
        const { viewLeft, viewRight, viewTop, viewBottom } = viewport;
        let treesVisible = 0;
        let treesTotal = 0;

        for (const [key, treeGraphics] of treeGraphicsCache) {
            treesTotal++;
            const data = treeDataCache.get(key);
            if (data) {
                const treeRight = data.x + data.size;
                const treeLeft = data.x - data.size;
                const treeBottom = data.y + data.size;
                const treeTop = data.y - data.size;
                const isVisible = !(treeRight < viewLeft || treeLeft > viewRight ||
                    treeBottom < viewTop || treeTop > viewBottom);
                treeGraphics.visible = isVisible;
                if (isVisible) treesVisible++;

                const isHit = hitTreeKeys.has(key);
                const lastState = treeHighlightState.get(key);

                if (isHit) {
                    if (lastState !== true) {
                        treeHighlightState.set(key, true);
                    }
                    const hitTime = hitTreeKeys.get(key);
                    const currentTime = performance.now();
                    const elapsed = currentTime - hitTime;
                    const highlightDuration = 300;
                    if (elapsed < highlightDuration) {
                        const progress = Math.min(1.0, elapsed / highlightDuration);
                        const flashIntensity = Math.sin(progress * Math.PI) * 0.5 + 0.5;

                        treeGraphics.tint = 0xFF8C00;
                        treeGraphics.alpha = 0.6 + flashIntensity * 0.4;
                    } else {
                        hitTreeKeys.delete(key);
                        treeHighlightState.set(key, false);
                        treeGraphics.tint = 0xFFFFFF;
                        treeGraphics.alpha = 1.0;
                    }
                } else if (lastState === true) {
                    treeHighlightState.set(key, false);
                    treeGraphics.tint = 0xFFFFFF;
                    treeGraphics.alpha = 1.0;
                }
            }
        }

        return { treesVisible, treesTotal };
    }
}

