export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.frameMetrics = {
            inputTime: 0,
            collisionTime: 0,
            renderTime: 0,
            networkTime: 0,
            totalTime: 0
        };
        this.history = {
            inputTime: [],
            collisionTime: [],
            renderTime: [],
            networkTime: []
        };
        this.maxHistorySize = 60;
        this.inputSendAttempts = 0;
        this.inputSendSuccess = 0;
        this.inputSendThrottled = 0;
        this.predictionErrors = [];
        this.maxPredictionErrors = 100;
    }

    startTiming(label) {
        this.metrics.set(label, performance.now());
    }

    endTiming(label) {
        const start = this.metrics.get(label);
        if (start !== undefined) {
            const duration = performance.now() - start;
            this.metrics.delete(label);
            return duration;
        }
        return 0;
    }

    recordPhase(phase, duration) {
        if (this.frameMetrics[phase] !== undefined) {
            this.frameMetrics[phase] = duration;

            if (this.history[phase]) {
                this.history[phase].push(duration);
                if (this.history[phase].length > this.maxHistorySize) {
                    this.history[phase].shift();
                }
            }
        }
    }

    recordInputSend(success, throttled) {
        this.inputSendAttempts++;
        if (success) {
            this.inputSendSuccess++;
        }
        if (throttled) {
            this.inputSendThrottled++;
        }
    }

    recordPredictionError(distance) {
        this.predictionErrors.push(distance);
        if (this.predictionErrors.length > this.maxPredictionErrors) {
            this.predictionErrors.shift();
        }
    }

    getPhaseStats(phase) {
        const history = this.history[phase];
        if (!history || history.length === 0) {
            return { avg: 0, min: 0, max: 0, current: 0 };
        }

        const sum = history.reduce((a, b) => a + b, 0);
        const avg = sum / history.length;
        const min = Math.min(...history);
        const max = Math.max(...history);
        const current = this.frameMetrics[phase] || 0;

        return { avg, min, max, current };
    }

    getPredictionStats() {
        if (this.predictionErrors.length === 0) {
            return { avg: 0, min: 0, max: 0, samples: 0 };
        }

        const sum = this.predictionErrors.reduce((a, b) => a + b, 0);
        const avg = sum / this.predictionErrors.length;
        const min = Math.min(...this.predictionErrors);
        const max = Math.max(...this.predictionErrors);

        return {
            avg: avg.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            samples: this.predictionErrors.length
        };
    }

    getInputSendStats() {
        const successRate = this.inputSendAttempts > 0
            ? ((this.inputSendSuccess / this.inputSendAttempts) * 100).toFixed(1)
            : '0.0';
        const throttleRate = this.inputSendAttempts > 0
            ? ((this.inputSendThrottled / this.inputSendAttempts) * 100).toFixed(1)
            : '0.0';

        return {
            attempts: this.inputSendAttempts,
            success: this.inputSendSuccess,
            throttled: this.inputSendThrottled,
            successRate,
            throttleRate
        };
    }

    reset() {
        this.inputSendAttempts = 0;
        this.inputSendSuccess = 0;
        this.inputSendThrottled = 0;
    }

    getReport() {
        const input = this.getPhaseStats('inputTime');
        const collision = this.getPhaseStats('collisionTime');
        const render = this.getPhaseStats('renderTime');
        const network = this.getPhaseStats('networkTime');
        const prediction = this.getPredictionStats();
        const inputSend = this.getInputSendStats();

        return {
            phases: {
                input: { current: input.current.toFixed(2), avg: input.avg.toFixed(2), min: input.min.toFixed(2), max: input.max.toFixed(2) },
                collision: { current: collision.current.toFixed(2), avg: collision.avg.toFixed(2), min: collision.min.toFixed(2), max: collision.max.toFixed(2) },
                render: { current: render.current.toFixed(2), avg: render.avg.toFixed(2), min: render.min.toFixed(2), max: render.max.toFixed(2) },
                network: { current: network.current.toFixed(2), avg: network.avg.toFixed(2), min: network.min.toFixed(2), max: network.max.toFixed(2) }
            },
            prediction,
            inputSend
        };
    }
}
