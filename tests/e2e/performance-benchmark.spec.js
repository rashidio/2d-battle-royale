import { test, expect } from '@playwright/test';

test.describe('Performance Benchmark', () => {
  test('collect performance metrics across scenarios', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('http://localhost:12344');

    await page.click('#playBtn');
    await page.waitForTimeout(1000);

    const report = await page.evaluate(async () => {
      const metrics = {
        scenarios: {},
        heap: {},
        summary: {}
      };

      const collectMetrics = async (duration) => {
        const measures = performance.getEntriesByType('measure');
        const input = measures.filter(m => m.name === 'game:input').map(m => m.duration);
        const render = measures.filter(m => m.name === 'game:render').map(m => m.duration);
        const collision = measures.filter(m => m.name.startsWith('collision:')).map(m => m.duration);

        performance.clearMeasures();
        performance.clearMarks();

        const heap = performance.memory ? {
          used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
          limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
        } : null;

        const stats = (arr) => {
          if (!arr.length) return { avg: 0, min: 0, max: 0, p95: 0, count: 0 };
          const sorted = [...arr].sort((a, b) => a - b);
          const sum = sorted.reduce((a, b) => a + b, 0);
          return {
            avg: (sum / sorted.length).toFixed(2),
            min: sorted[0].toFixed(2),
            max: sorted[sorted.length - 1].toFixed(2),
            p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
            count: sorted.length
          };
        };

        return {
          input: stats(input),
          render: stats(render),
          collision: stats(collision),
          heap,
          frameTime: (input.length > 0 && render.length > 0)
            ? ((input.reduce((a,b) => a+b, 0) + render.reduce((a,b) => a+b, 0)) / Math.min(input.length, render.length)).toFixed(2)
            : '0'
        };
      };

      console.log('Starting performance benchmark (headless mode - higher FPS expected)');

      console.log('Scenario 1: Idle (5 seconds)');
      await new Promise(resolve => setTimeout(resolve, 5000));
      metrics.scenarios.idle = await collectMetrics(5000);
      metrics.heap.idle = metrics.scenarios.idle.heap;

      console.log('Scenario 2: Straight Movement (8 seconds)');
      let moveStart = Date.now();
      window.gameClient.inputManager.keyboard.keys.add('w');
      while (Date.now() - moveStart < 8000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      window.gameClient.inputManager.keyboard.keys.delete('w');
      metrics.scenarios.movement = await collectMetrics(8000);
      metrics.heap.movement = metrics.scenarios.movement.heap;

      console.log('Scenario 3: Diagonal Movement (8 seconds)');
      moveStart = Date.now();
      window.gameClient.inputManager.keyboard.keys.add('w');
      window.gameClient.inputManager.keyboard.keys.add('d');
      while (Date.now() - moveStart < 8000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      window.gameClient.inputManager.keyboard.keys.delete('w');
      window.gameClient.inputManager.keyboard.keys.delete('d');
      metrics.scenarios.diagonalMove = await collectMetrics(8000);
      metrics.heap.diagonalMove = metrics.scenarios.diagonalMove.heap;

      console.log('Scenario 4: Rapid Shooting (8 seconds)');
      const shootStart = Date.now();
      window.gameClient.inputManager.keyboard.keys.add('space');
      while (Date.now() - shootStart < 8000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      window.gameClient.inputManager.keyboard.keys.delete('space');
      metrics.scenarios.shooting = await collectMetrics(8000);
      metrics.heap.shooting = metrics.scenarios.shooting.heap;

      console.log('Scenario 5: Circle Movement (10 seconds)');
      moveStart = Date.now();
      let phase = 0;
      while (Date.now() - moveStart < 10000) {
        window.gameClient.inputManager.keyboard.keys.clear();
        if (phase === 0) {
          window.gameClient.inputManager.keyboard.keys.add('w');
        } else if (phase === 1) {
          window.gameClient.inputManager.keyboard.keys.add('d');
        } else if (phase === 2) {
          window.gameClient.inputManager.keyboard.keys.add('s');
        } else {
          window.gameClient.inputManager.keyboard.keys.add('a');
        }
        await new Promise(resolve => setTimeout(resolve, 2500));
        phase = (phase + 1) % 4;
      }
      window.gameClient.inputManager.keyboard.keys.clear();
      metrics.scenarios.circleMove = await collectMetrics(10000);
      metrics.heap.circleMove = metrics.scenarios.circleMove.heap;

      console.log('Scenario 6: Intense Combat (10 seconds)');
      const combatStart = Date.now();
      window.gameClient.inputManager.keyboard.keys.add('w');
      window.gameClient.inputManager.keyboard.keys.add('d');
      window.gameClient.inputManager.keyboard.keys.add('space');
      while (Date.now() - combatStart < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      window.gameClient.inputManager.keyboard.keys.delete('w');
      window.gameClient.inputManager.keyboard.keys.delete('d');
      window.gameClient.inputManager.keyboard.keys.delete('space');
      metrics.scenarios.combat = await collectMetrics(10000);
      metrics.heap.combat = metrics.scenarios.combat.heap;

      const gameState = window.gameClient.gameState;
      metrics.summary = {
        buildings: gameState.buildings?.length || 0,
        trees: gameState.trees?.length || 0,
        targetFrameTime: '16.67ms (60 FPS)',
        worstCollision: Math.max(
          parseFloat(metrics.scenarios.movement?.collision?.max || 0),
          parseFloat(metrics.scenarios.diagonalMove?.collision?.max || 0),
          parseFloat(metrics.scenarios.circleMove?.collision?.max || 0),
          parseFloat(metrics.scenarios.combat?.collision?.max || 0)
        ).toFixed(2) + 'ms',
        worstFrame: Math.max(
          parseFloat(metrics.scenarios.idle?.frameTime || 0),
          parseFloat(metrics.scenarios.movement?.frameTime || 0),
          parseFloat(metrics.scenarios.diagonalMove?.frameTime || 0),
          parseFloat(metrics.scenarios.shooting?.frameTime || 0),
          parseFloat(metrics.scenarios.circleMove?.frameTime || 0),
          parseFloat(metrics.scenarios.combat?.frameTime || 0)
        ).toFixed(2) + 'ms',
        totalCollisionSamples: (
          parseInt(metrics.scenarios.movement?.collision?.count || 0) +
          parseInt(metrics.scenarios.diagonalMove?.collision?.count || 0) +
          parseInt(metrics.scenarios.circleMove?.collision?.count || 0) +
          parseInt(metrics.scenarios.combat?.collision?.count || 0)
        )
      };

      return metrics;
    });

    console.log('\n--- PERFORMANCE BENCHMARK REPORT ---\n');

    console.log('Game Complexity:');
    console.log(`  Buildings: ${report.summary.buildings}`);
    console.log(`  Trees: ${report.summary.trees}`);
    console.log(`  Total Objects: ${report.summary.buildings + report.summary.trees}\n`);

    console.log('Performance Target: 16.67ms per frame (60 FPS)\n');

    const printScenario = (name, data) => {
      if (!data) return;
      const frameTime = parseFloat(data.frameTime);
      const fps = (1000 / frameTime).toFixed(0);

      console.log(`${name}:`);
      console.log(`  Frame Time: ${data.frameTime}ms (${fps} FPS)`);
      console.log(`  Input:      avg=${data.input.avg}ms max=${data.input.max}ms p95=${data.input.p95}ms`);
      console.log(`  Render:     avg=${data.render.avg}ms max=${data.render.max}ms p95=${data.render.p95}ms`);

      if (data.collision.count > 0) {
        console.log(`  Collision:  avg=${data.collision.avg}ms max=${data.collision.max}ms p95=${data.collision.p95}ms samples=${data.collision.count}`);
      }

      if (data.heap) {
        console.log(`  Heap:       ${data.heap.used}MB / ${data.heap.total}MB (limit: ${data.heap.limit}MB)`);
      }
      console.log('');
    };

    printScenario('Idle (Baseline)', report.scenarios.idle);
    printScenario('Straight Movement', report.scenarios.movement);
    printScenario('Diagonal Movement', report.scenarios.diagonalMove);
    printScenario('Rapid Shooting', report.scenarios.shooting);
    printScenario('Circle Movement', report.scenarios.circleMove);
    printScenario('Intense Combat', report.scenarios.combat);

    console.log('Summary:');
    console.log(`  Worst Frame Time: ${report.summary.worstFrame}`);
    console.log(`  Worst Collision:  ${report.summary.worstCollision}`);
    console.log(`  Total Collision Samples: ${report.summary.totalCollisionSamples}`);

    const worstFrameNum = parseFloat(report.summary.worstFrame);
    const worstCollisionNum = parseFloat(report.summary.worstCollision);

    if (worstFrameNum > 16.67) {
      console.log(`  WARNING: Frame time exceeds 60 FPS target by ${(worstFrameNum - 16.67).toFixed(2)}ms`);
    }

    if (worstCollisionNum > 5) {
      console.log(`  WARNING: Collision detection is a bottleneck (${worstCollisionNum}ms > 5ms threshold)`);
      console.log(`  Recommendation: Implement spatial grid for collision detection`);
      console.log(`  Expected improvement: ${(worstCollisionNum / 0.5).toFixed(0)}x faster`);
    }

    const heapGrowth = report.heap.combat && report.heap.idle
      ? (parseFloat(report.heap.combat.used) - parseFloat(report.heap.idle.used)).toFixed(2)
      : 0;

    if (heapGrowth > 0) {
      console.log(`  Heap growth during test: ${heapGrowth}MB`);
      if (heapGrowth > 10) {
        console.log(`  WARNING: Significant memory allocation detected (possible leak)`);
      }
    }

    console.log('\n');

    expect(parseFloat(report.scenarios.idle.frameTime)).toBeLessThan(20);
    expect(parseFloat(report.summary.worstFrame)).toBeLessThan(30);
  });

  test('measure render phase breakdown', async ({ page }) => {
    await page.goto('http://localhost:12344');
    await page.click('#playBtn');
    await page.waitForTimeout(2000);

    const renderData = await page.evaluate(async () => {
      window.gameClient.inputManager.keyboard.keys.add('w');
      await new Promise(resolve => setTimeout(resolve, 5000));
      window.gameClient.inputManager.keyboard.keys.delete('w');

      const measures = performance.getEntriesByType('measure');
      const renderMeasures = measures.filter(m => m.name === 'game:render');

      const stats = (arr) => {
        if (!arr.length) return { avg: 0, total: 0 };
        const total = arr.reduce((a, b) => a + b, 0);
        return {
          avg: (total / arr.length).toFixed(2),
          total: total.toFixed(2),
          samples: arr.length
        };
      };

      const renderStats = stats(renderMeasures.map(m => m.duration));
      const renderStats60fps = window.gameClient.renderStats || {};

      return {
        render: renderStats,
        objects: {
          buildings: {
            visible: renderStats60fps.buildingsVisible || 0,
            total: renderStats60fps.buildingsTotal || 0
          },
          trees: {
            visible: renderStats60fps.treesVisible || 0,
            total: renderStats60fps.treesTotal || 0
          },
          players: {
            visible: renderStats60fps.playersVisible || 0,
            total: renderStats60fps.playersTotal || 0
          }
        }
      };
    });

    console.log('\n--- RENDER PHASE ANALYSIS ---\n');

    console.log('Render Performance:');
    console.log(`  Average render time: ${renderData.render.avg}ms`);
    console.log(`  Samples: ${renderData.render.samples}\n`);

    console.log('Objects Being Rendered (Culling):');
    console.log(`  Buildings: ${renderData.objects.buildings.visible} / ${renderData.objects.buildings.total} (${(renderData.objects.buildings.visible/renderData.objects.buildings.total*100).toFixed(0)}% visible)`);
    console.log(`  Trees:     ${renderData.objects.trees.visible} / ${renderData.objects.trees.total} (${(renderData.objects.trees.visible/renderData.objects.trees.total*100).toFixed(0)}% visible)`);
    console.log(`  Players:   ${renderData.objects.players.visible} / ${renderData.objects.players.total}\n`);

    const cullEfficiency = ((renderData.objects.buildings.visible + renderData.objects.trees.visible) /
                           (renderData.objects.buildings.total + renderData.objects.trees.total) * 100).toFixed(0);

    console.log(`Culling Efficiency: ${cullEfficiency}%`);

    if (cullEfficiency > 50) {
      console.log(`  More than 50% of objects are visible - culling may not be effective`);
    } else if (cullEfficiency < 20) {
      console.log(`  Good culling - only ${cullEfficiency}% of objects rendered`);
    }

    console.log('\n');

    expect(parseFloat(renderData.render.avg)).toBeLessThan(20);
  });
});
