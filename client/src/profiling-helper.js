export class ProfilingHelper {
    constructor() {
        this.enabled = false;
        this.metrics = {
            input: [],
            render: [],
            collision: [],
            network: []
        };
        this.maxSamples = 60;
        this.lastReport = 0;
        this.reportInterval = 2000;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    collectMetrics() {
        if (!this.enabled) return;

        const measures = performance.getEntriesByType('measure');

        for (const measure of measures) {
            if (measure.name === 'game:input') {
                this.metrics.input.push(measure.duration);
                if (this.metrics.input.length > this.maxSamples) {
                    this.metrics.input.shift();
                }
            } else if (measure.name === 'game:render') {
                this.metrics.render.push(measure.duration);
                if (this.metrics.render.length > this.maxSamples) {
                    this.metrics.render.shift();
                }
            } else if (measure.name.startsWith('collision:')) {
                this.metrics.collision.push(measure.duration);
                if (this.metrics.collision.length > this.maxSamples) {
                    this.metrics.collision.shift();
                }
            } else if (measure.name.startsWith('network:')) {
                this.metrics.network.push(measure.duration);
                if (this.metrics.network.length > this.maxSamples) {
                    this.metrics.network.shift();
                }
            }
        }

        performance.clearMeasures();

        const now = performance.now();
        if (now - this.lastReport > this.reportInterval) {
            this.lastReport = now;
            this.printReport();
        }
    }

    getStats(samples) {
        if (!samples || samples.length === 0) {
            return { avg: 0, min: 0, max: 0, p95: 0, count: 0 };
        }

        const sorted = [...samples].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avg = sum / sorted.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95 = sorted[p95Index];

        return { avg, min, max, p95, count: sorted.length };
    }

    printReport() {
    }

    getReport() {
        const input = this.getStats(this.metrics.input);
        const render = this.getStats(this.metrics.render);
        const collision = this.getStats(this.metrics.collision);
        const network = this.getStats(this.metrics.network);

        return {
            input,
            render,
            collision,
            network,
            totalAvg: input.avg + render.avg,
            frameTarget: 16.67
        };
    }

    reset() {
        this.metrics.input = [];
        this.metrics.render = [];
        this.metrics.collision = [];
        this.metrics.network = [];
    }
}

if (typeof window !== 'undefined') {
    window.profilingHelper = new ProfilingHelper();
}
