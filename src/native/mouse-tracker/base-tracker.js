"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMouseTracker = void 0;
const events_1 = require("events");
/**
 * Base class for mouse tracking implementations
 * Provides common functionality and event handling
 */
class BaseMouseTracker extends events_1.EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.lastPosition = { x: 0, y: 0, timestamp: Date.now() };
        this.performanceMetrics = {
            mouseEventFrequency: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastUpdate: Date.now()
        };
        // Performance monitoring
        this.eventCount = 0;
        this.lastMetricsUpdate = Date.now();
        this.setupPerformanceMonitoring();
    }
    getCurrentPosition() {
        return { ...this.lastPosition };
    }
    isTracking() {
        return this.isActive;
    }
    updatePosition(x, y, fullPosition) {
        const timestamp = Date.now();
        // Use full position if provided (includes button state), otherwise just x, y, timestamp
        this.lastPosition = fullPosition || { x, y, timestamp };
        this.eventCount++;
        // Emit position event
        this.emit('position', this.lastPosition);
    }
    handleError(error) {
        console.error('Mouse tracker error:', error);
        this.emit('error', error);
    }
    setupPerformanceMonitoring() {
        // Update performance metrics every second
        this.metricsInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 1000);
    }
    updatePerformanceMetrics() {
        const now = Date.now();
        const timeDelta = now - this.lastMetricsUpdate;
        // Calculate events per second
        this.performanceMetrics.mouseEventFrequency = (this.eventCount * 1000) / timeDelta;
        // Get memory usage
        const memUsage = process.memoryUsage();
        this.performanceMetrics.memoryUsage = memUsage.heapUsed;
        // CPU usage would require additional implementation
        this.performanceMetrics.cpuUsage = 0; // TODO: Implement CPU monitoring
        this.performanceMetrics.lastUpdate = now;
        // Reset counters
        this.eventCount = 0;
        this.lastMetricsUpdate = now;
    }
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    destroy() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }
        this.removeAllListeners();
        this.isActive = false;
    }
}
exports.BaseMouseTracker = BaseMouseTracker;
//# sourceMappingURL=base-tracker.js.map