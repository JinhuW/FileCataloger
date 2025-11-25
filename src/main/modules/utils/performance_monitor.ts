import { EventEmitter } from 'events';
import * as os from 'os';
import { errorHandler, ErrorSeverity, ErrorCategory } from './error_handler';
import { logger } from './logger';

/**
 * Performance metrics collected by the monitor
 */
export interface PerformanceMetrics {
  cpu: {
    usage: number; // Percentage 0-100
    cores: number;
  };
  memory: {
    total: number; // Bytes
    used: number; // Bytes
    free: number; // Bytes
    percentage: number; // Percentage 0-100
    appUsage: number; // Bytes used by this app
  };
  process: {
    pid: number;
    uptime: number; // Seconds
  };
  timestamp: number;
}

/**
 * Configurable thresholds for performance warnings
 */
export interface PerformanceThresholds {
  cpuWarning: number; // Default 80%
  cpuCritical: number; // Default 95%
  memoryWarning: number; // Default 95%
  memoryCritical: number; // Default 99%
  appMemoryLimit: number; // MB, default 200
}

/**
 * Simplified performance monitor for a small utility application.
 * Provides basic CPU/memory monitoring with threshold alerts.
 *
 * Events:
 * - 'metrics': Emitted with PerformanceMetrics on each collection
 * - 'performance-warning': Emitted when thresholds are exceeded
 * - 'performance-warning-cleared': Emitted when warning state clears
 */
export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly maxHistorySize: number = 5;
  private updateInterval: number = 30000; // 30 seconds

  private thresholds: PerformanceThresholds = {
    cpuWarning: 80,
    cpuCritical: 95,
    memoryWarning: 95, // macOS commonly uses 95%+ memory normally
    memoryCritical: 99, // Only alert at extreme levels
    appMemoryLimit: 200, // 200MB for this small app
  };

  private lastCpuInfo: { idle: number; total: number } | null = null;
  private warningStates = {
    cpu: false,
    memory: false,
    appMemory: false,
  };

  private constructor() {
    super();
    this.initializeMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMonitoring(): void {
    this.lastCpuInfo = this.getCpuInfo();
  }

  /**
   * Start monitoring with optional custom interval
   */
  public start(interval: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('PerformanceMonitor is already running');
      return;
    }

    this.updateInterval = interval;
    this.isMonitoring = true;

    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, this.updateInterval);

    // Collect initial metrics
    this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.isMonitoring = false;
  }

  private collectMetrics(): void {
    try {
      const metrics = this.getCurrentMetrics();
      this.addToHistory(metrics);
      this.checkThresholds(metrics);
      this.emit('metrics', metrics);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.PERFORMANCE,
        context: { module: 'performance-monitor' },
      });
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    const cpuInfo = this.getCpuInfo();
    const cpuUsage = this.calculateCpuUsage(cpuInfo);

    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
      },
      memory: this.getMemoryInfo(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
      },
      timestamp: Date.now(),
    };
  }

  private getCpuInfo(): { idle: number; total: number } {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    });

    return { idle, total };
  }

  private calculateCpuUsage(currentInfo: { idle: number; total: number }): number {
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = currentInfo;
      return 0;
    }

    const idleDiff = currentInfo.idle - this.lastCpuInfo.idle;
    const totalDiff = currentInfo.total - this.lastCpuInfo.total;
    const usage = totalDiff === 0 ? 0 : 100 - (100 * idleDiff) / totalDiff;

    this.lastCpuInfo = currentInfo;

    return Math.round(usage * 10) / 10;
  }

  private getMemoryInfo(): PerformanceMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    const appMemUsage = process.memoryUsage();
    const appUsage = appMemUsage.heapUsed + appMemUsage.external;

    return {
      total,
      used,
      free,
      percentage: Math.round(percentage * 10) / 10,
      appUsage,
    };
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Check CPU usage
    if (metrics.cpu.usage >= this.thresholds.cpuCritical) {
      this.emitWarning('cpu-critical', metrics.cpu.usage);
    } else if (metrics.cpu.usage >= this.thresholds.cpuWarning) {
      this.emitWarning('cpu-warning', metrics.cpu.usage);
    } else {
      this.clearWarning('cpu');
    }

    // Check memory usage
    if (metrics.memory.percentage >= this.thresholds.memoryCritical) {
      this.emitWarning('memory-critical', metrics.memory.percentage);
    } else if (metrics.memory.percentage >= this.thresholds.memoryWarning) {
      this.emitWarning('memory-warning', metrics.memory.percentage);
    } else {
      this.clearWarning('memory');
    }

    // Check app memory usage
    const appMemoryMB = metrics.memory.appUsage / (1024 * 1024);
    if (appMemoryMB > this.thresholds.appMemoryLimit) {
      this.emitWarning('app-memory-limit', appMemoryMB);
    } else {
      this.clearWarning('appMemory');
    }
  }

  private emitWarning(type: string, value: number): void {
    const warningType = type.includes('cpu')
      ? 'cpu'
      : type.includes('memory')
        ? 'memory'
        : 'appMemory';

    // Only emit if not already in warning state
    if (!this.warningStates[warningType as keyof typeof this.warningStates]) {
      this.warningStates[warningType as keyof typeof this.warningStates] = true;

      this.emit('performance-warning', {
        type,
        value,
        threshold: this.getThresholdForType(type),
        timestamp: Date.now(),
      });

      errorHandler.handleError(`Performance warning: ${type} at ${value.toFixed(1)}%`, {
        severity: type.includes('critical') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        category: ErrorCategory.PERFORMANCE,
        context: { type, value },
      });
    }
  }

  private clearWarning(type: 'cpu' | 'memory' | 'appMemory'): void {
    if (this.warningStates[type]) {
      this.warningStates[type] = false;
      this.emit('performance-warning-cleared', { type });
    }
  }

  private getThresholdForType(type: string): number {
    switch (type) {
      case 'cpu-warning':
        return this.thresholds.cpuWarning;
      case 'cpu-critical':
        return this.thresholds.cpuCritical;
      case 'memory-warning':
        return this.thresholds.memoryWarning;
      case 'memory-critical':
        return this.thresholds.memoryCritical;
      case 'app-memory-limit':
        return this.thresholds.appMemoryLimit;
      default:
        return 0;
    }
  }

  /**
   * Get the most recent metrics
   */
  public getMetrics(): PerformanceMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Clear metrics history
   */
  public clearHistory(): void {
    this.metricsHistory = [];
  }

  /**
   * Update thresholds
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Check if system is healthy (below all warning thresholds)
   */
  public isHealthy(): boolean {
    const metrics = this.getMetrics();
    if (!metrics) return true;

    return (
      metrics.cpu.usage < this.thresholds.cpuWarning &&
      metrics.memory.percentage < this.thresholds.memoryWarning &&
      metrics.memory.appUsage / (1024 * 1024) < this.thresholds.appMemoryLimit
    );
  }

  /**
   * Get health status with list of issues
   */
  public getHealthStatus(): { healthy: boolean; issues: string[] } {
    const metrics = this.getMetrics();
    if (!metrics) {
      return { healthy: true, issues: [] };
    }

    const issues: string[] = [];

    if (metrics.cpu.usage >= this.thresholds.cpuCritical) {
      issues.push(`Critical CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    } else if (metrics.cpu.usage >= this.thresholds.cpuWarning) {
      issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    }

    if (metrics.memory.percentage >= this.thresholds.memoryCritical) {
      issues.push(`Critical memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    } else if (metrics.memory.percentage >= this.thresholds.memoryWarning) {
      issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    }

    const appMemoryMB = metrics.memory.appUsage / (1024 * 1024);
    if (appMemoryMB > this.thresholds.appMemoryLimit) {
      issues.push(`App memory limit exceeded: ${appMemoryMB.toFixed(1)}MB`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.metricsHistory = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
