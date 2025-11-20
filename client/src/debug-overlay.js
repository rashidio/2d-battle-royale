export class DebugOverlay {
    constructor() {
        this.lastHeapCheck = 0;
        this.lastPlayersUpdate = 0;
        this.playersUpdateInterval = 500;
    }

    setVisible(enabled) {
        const debugEl = document.getElementById('debug');
        if (debugEl) {
            if (enabled) {
                debugEl.classList.remove('game-ui-hidden');
                debugEl.classList.add('debug-enabled');
            } else {
                debugEl.classList.remove('debug-enabled');
                debugEl.classList.add('game-ui-hidden');
            }
        }
    }

    update(game) {
        const now = performance.now();
        this.updateInputDebug(game);
        this.updatePositionDebug(game);
        this.updateAngleDebug(game);
        this.updatePerformanceDebug(game);
        this.updateNetworkDebug(game);
        this.updateCorrectionsDebug(game);
        this.updateViewportDebug(game);
        this.updateRenderStatsDebug(game);
        this.updateCacheSizesDebug(game);
        this.updateWSBufferDebug(game);
        this.updateExpensiveOpsDebug(game);
        this.updateNetworkBytesDebug(game);
        this.updateHeapDebug(game, now);
        this.updatePlayersDebug(game, now);
    }

    updateInputDebug(game) {
        const activeKeys = Array.from(game.inputManager.keyboard.keys);
        const isMovingUp = game.inputManager.keyboard.keys.has('w') || game.inputManager.keyboard.keys.has('arrowup');
        const isMovingDown = game.inputManager.keyboard.keys.has('s') || game.inputManager.keyboard.keys.has('arrowdown');
        const isMovingLeft = game.inputManager.keyboard.keys.has('a') || game.inputManager.keyboard.keys.has('arrowleft');
        const isMovingRight = game.inputManager.keyboard.keys.has('d') || game.inputManager.keyboard.keys.has('arrowright');

        const movementDirs = [];
        if (isMovingUp) movementDirs.push('UP');
        if (isMovingDown) movementDirs.push('DOWN');
        if (isMovingLeft) movementDirs.push('LEFT');
        if (isMovingRight) movementDirs.push('RIGHT');

        const debugKeysEl = document.getElementById('debugKeys');
        const debugMovementEl = document.getElementById('debugMovement');
        const debugShootingEl = document.getElementById('debugShooting');
        const debugPressedSetEl = document.getElementById('debugPressedSet');

        if (debugKeysEl) debugKeysEl.textContent = activeKeys.length > 0 ? activeKeys.join(', ') : 'none';
        if (debugMovementEl) debugMovementEl.textContent = movementDirs.length > 0 ? movementDirs.join(' ') : 'none';
        if (debugShootingEl) debugShootingEl.textContent = game.inputManager.keyboard.keys.has('space') ? 'YES (Space)' : 'NO';
        if (debugPressedSetEl) debugPressedSetEl.textContent = activeKeys.length > 0 ? activeKeys.join(', ') : 'none';
    }

    updatePositionDebug(game) {
        const debugPositionEl = document.getElementById('debugPosition');
        if (debugPositionEl) {
            const playerForDebug = game.gameState.players[game.playerId];
            if (playerForDebug) {
                const sX = Math.round(playerForDebug.x);
                const sY = Math.round(playerForDebug.y);
                const cX = game.clientPrediction.x !== null ? Math.round(game.clientPrediction.x) : '-';
                const cY = game.clientPrediction.y !== null ? Math.round(game.clientPrediction.y) : '-';
                debugPositionEl.textContent = `S:${sX},${sY} C:${cX},${cY}`;
            } else {
                debugPositionEl.textContent = '-';
            }
        }
    }

    updateAngleDebug(game) {
        const debugAngleEl = document.getElementById('debugAngle');
        if (debugAngleEl) {
            const playerForDebug = game.gameState.players[game.playerId];
            if (!playerForDebug) {
                debugAngleEl.textContent = '-';
            } else {
                let angleToShow = null;

                if (game.lookAngle !== null && game.lookAngle !== undefined) {
                    angleToShow = game.lookAngle;
                } else if (game.clientPrediction.angle !== undefined && game.clientPrediction.angle !== null) {
                    angleToShow = game.clientPrediction.angle;
                } else if (playerForDebug.angle !== undefined) {
                    angleToShow = playerForDebug.angle;
                }

                if (angleToShow !== null && angleToShow !== undefined) {
                    let angleDeg = (angleToShow * 180 / Math.PI);
                    if (angleDeg < 0) angleDeg += 360;
                    debugAngleEl.textContent = `${angleDeg.toFixed(1)}°`;
                } else {
                    debugAngleEl.textContent = '-';
                }
            }
        }
    }

    updatePerformanceDebug(game) {
        const debugFPSEl = document.getElementById('debugFPS');
        const debugFrameTimeEl = document.getElementById('debugFrameTime');
        const debugCPUEl = document.getElementById('debugCPU');
        const debugPingEl = document.getElementById('debugPing');
        const debugUpdateTimeEl = document.getElementById('debugUpdateTime');

        if (debugFPSEl) debugFPSEl.textContent = game.fps;
        if (debugFrameTimeEl) debugFrameTimeEl.textContent = game.frameTime;
        if (debugCPUEl) debugCPUEl.textContent = game.cpuTime.toFixed(1);
        if (debugPingEl) debugPingEl.textContent = game.ping || '-';
        if (debugUpdateTimeEl) debugUpdateTimeEl.textContent = game.updateTime.toFixed(1);
    }

    updateNetworkDebug(game) {
        const debugWSNetworkEl = document.getElementById('debugWSNetwork');
        if (debugWSNetworkEl) {
            debugWSNetworkEl.textContent = `${game.networkManager.wsPacketsSent}/${game.networkManager.wsPacketsReceived}`;
        }
    }

    updateCorrectionsDebug(game) {
        const avgError = game.correctionErrorSamples > 0 ? (game.totalCorrectionError / game.correctionErrorSamples).toFixed(1) : '0.0';
        const maxError = game.maxCorrectionError > 0 ? game.maxCorrectionError.toFixed(1) : '0.0';
        const minError = game.minCorrectionError !== Infinity ? game.minCorrectionError.toFixed(1) : '0.0';

        const debugCorrectionsEl = document.getElementById('debugCorrections');
        const debugSnapCorrectionsEl = document.getElementById('debugSnapCorrections');
        const debugSmoothCorrectionsEl = document.getElementById('debugSmoothCorrections');

        if (debugCorrectionsEl) {
            debugCorrectionsEl.textContent = `${game.correctionCount} (S:${game.snapCorrectionCount} Sm:${game.smoothCorrectionCount} M:${game.minorCorrectionCount} Sk:${game.skippedCorrectionCount})`;
        }
        if (debugSnapCorrectionsEl) {
            debugSnapCorrectionsEl.textContent = `Err: ${game.lastCorrectionError.toFixed(1)} | Avg: ${avgError} | Max: ${maxError} | Min: ${minError}`;
        }
        if (debugSmoothCorrectionsEl) {
            debugSmoothCorrectionsEl.textContent = `Samples: ${game.correctionErrorSamples}`;
        }

        if (game.correctionErrorSamples > 10000) {
            game.totalCorrectionError = 0;
            game.correctionErrorSamples = 0;
        }
    }

    updateViewportDebug(game) {
        const debugViewportEl = document.getElementById('debugViewport');
        const debugWorldBoundsEl = document.getElementById('debugWorldBounds');

        if (debugViewportEl && game.viewportInfo) {
            debugViewportEl.textContent = `${game.viewportInfo.width}x${game.viewportInfo.height} (${game.viewportInfo.worldWidth.toFixed(0)}x${game.viewportInfo.worldHeight.toFixed(0)})`;
        }

        if (debugWorldBoundsEl && game.viewportInfo) {
            debugWorldBoundsEl.textContent = `[${game.viewportInfo.left.toFixed(0)},${game.viewportInfo.top.toFixed(0)}] to [${game.viewportInfo.right.toFixed(0)},${game.viewportInfo.bottom.toFixed(0)}]`;
        }
    }

    updateRenderStatsDebug(game) {
        const debugRenderStatsEl = document.getElementById('debugRenderStats');
        if (debugRenderStatsEl && game.renderStats) {
            debugRenderStatsEl.textContent = `B:${game.renderStats.buildingsVisible}/${game.renderStats.buildingsTotal} T:${game.renderStats.treesVisible}/${game.renderStats.treesTotal} P:${game.renderStats.playersVisible}/${game.renderStats.playersTotal}`;
        }
    }

    updateCacheSizesDebug(game) {
        const debugCacheSizesEl = document.getElementById('debugCacheSizes');
        if (debugCacheSizesEl) {
            const cacheSizes = [
                `P:${game.playerGraphicsCache?.size || 0}`,
                `B:${game.bulletGraphicsCache?.size || 0}`,
                `PK:${game.pickupGraphicsCache?.size || 0}`,
                `CH:${game.cachedChunks?.size || 0}`,
                `BH:${game.buildingHighlightState?.size || 0}`,
                `TH:${game.treeHighlightState?.size || 0}`
            ].join(' ');
            debugCacheSizesEl.textContent = cacheSizes;
        }
    }

    updateWSBufferDebug(game) {
        const debugWSBufferEl = document.getElementById('debugWSBuffer');
        if (debugWSBufferEl && game.networkManager.ws) {
            const bufferSize = game.networkManager.ws.bufferedAmount || 0;
            const bufferKB = (bufferSize / 1024).toFixed(1);
            debugWSBufferEl.textContent = bufferSize > 0 ? `${bufferKB}KB` : '0KB';
        } else if (debugWSBufferEl) {
            debugWSBufferEl.textContent = '-';
        }
    }

    updateExpensiveOpsDebug(game) {
        const debugExpensiveOpsEl = document.getElementById('debugExpensiveOps');
        if (debugExpensiveOpsEl) {
            debugExpensiveOpsEl.textContent = game.expensiveOpsCount || 0;
            game.expensiveOpsCount = 0;
        }
    }

    updateNetworkBytesDebug(game) {
        const debugNetworkBytesEl = document.getElementById('debugNetworkBytes');
        if (debugNetworkBytesEl) {
            const sentKB = (game.wsBytesSent / 1024).toFixed(1);
            debugNetworkBytesEl.textContent = `↑${sentKB}KB`;
        }
    }

    updateHeapDebug(game, now) {
        if (now - this.lastHeapCheck > 1000) {
            this.lastHeapCheck = now;
            const debugHeapEl = document.getElementById('debugHeap');
            if (debugHeapEl && performance.memory) {
                const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
                const total = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
                const limit = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);
                debugHeapEl.textContent = `${used}MB / ${total}MB (${limit}MB)`;
            } else if (debugHeapEl) {
                debugHeapEl.textContent = 'N/A';
            }
        }
    }

    updatePlayersDebug(game, now) {
        if (now - this.lastPlayersUpdate >= this.playersUpdateInterval) {
            this.updateDebugPlayers(game);
            this.lastPlayersUpdate = now;
        }
    }

    updateDebugPlayers(game) {
        const debugActivePlayersEl = document.getElementById('debugActivePlayers');
        if (!debugActivePlayersEl) return;

        if (!game.playerRenderer) return;

        const humanPlayers = [];
        if (game.gameState.players) {
            for (const playerId in game.gameState.players) {
                const player = game.gameState.players[playerId];
                if (player && player.alive && !playerId.startsWith('enemy_')) {
                    let displayName = game.playerRenderer.playerDisplayNames.get(playerId);
                    if (!displayName) {
                        if (playerId === game.playerId) {
                            displayName = 'You';
                        } else {
                            displayName = playerId.startsWith('player_') ? `player${playerId.split('_')[1] || playerId}` : playerId;
                        }
                        game.playerRenderer.playerDisplayNames.set(playerId, displayName);
                    }
                    humanPlayers.push({
                        name: displayName,
                        x: Math.round(player.x),
                        y: Math.round(player.y)
                    });
                }
            }
        }

        if (humanPlayers.length === 0) {
            debugActivePlayersEl.textContent = '-';
        } else {
            let playersText = '';
            for (let i = 0; i < humanPlayers.length; i++) {
                const p = humanPlayers[i];
                if (i > 0) playersText += ', ';
                playersText += `${p.name} (${p.x},${p.y})`;
            }
            debugActivePlayersEl.textContent = playersText;
        }
    }
}

