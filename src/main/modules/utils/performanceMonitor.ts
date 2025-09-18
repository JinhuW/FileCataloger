import { EventEmitter } from 'events';
import * as os from 'os';
import { errorHandler, ErrorSeverity, ErrorCategory } from './errorHandler';
import { logger } from './logger';

export interface PerformanceMetrics {
  cpu: {
    usage: number; // Percentage 0-100
    cores: number;
    model: string;
    speed: number; // MHz
    temperature?: number; // Celsius (if available)
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
    handles: number;
    threads: number;
  };
  system: {
    uptime: number; // Seconds
    loadAverage: number[]; // 1, 5, 15 minute averages
    platform: string;
    arch: string;
    version: string;
  };
  timestamp: number;
}

export interface PerformanceThresholds {
  cpuWarning: number; // Default 70%
  cpuCritical: number; // Default 90%
  memoryWarning: number; // Default 80%
  memoryCritical: number; // Default 95%
  appMemoryLimit: number; // MB, default 500
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 100;
  private updateInterval: number = 10000; // 10 seconds - reduced from 1 second
  private adaptiveInterval: boolean = true;
  private minInterval: number = 5000; // 5 seconds minimum
  private maxInterval: number = 30000; // 30 seconds maximum

  private thresholds: PerformanceThresholds = {
    cpuWarning: 70,
    cpuCritical: 90,
    memoryWarning: 90, // Increased from 80 to 90 - macOS typically uses high memory
    memoryCritical: 95,
    appMemoryLimit: 500,
  };

  private lastCpuInfo: any = null;
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
    // Get initial CPU info for comparison
    this.lastCpuInfo = this.getCpuInfo();
  }

  public start(interval: number = 1000): void {
    if (this.isMonitoring) {
      logger.warn('PerformanceMonitor is already running');
      return;
    }

    this.updateInterval = interval;
    this.isMonitoring = true;

    // Start monitoring
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, this.updateInterval);

    // Collect initial metrics
    this.collectMetrics();
  }

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

      // Add to history
      this.addToHistory(metrics);

      // Check thresholds
      this.checkThresholds(metrics);

      // Emit metrics
      this.emit('metrics', metrics);

      // Adaptive interval adjustment
      if (this.adaptiveInterval) {
        this.adjustInterval(metrics);
      }
    } catch (error) {
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.PERFORMANCE,
        context: { module: 'performance-monitor' },
      });
    }
  }

  private adjustInterval(metrics: PerformanceMetrics): void {
    // If CPU or memory usage is high, monitor more frequently
    const isHighUsage = metrics.cpu.usage > 50 || metrics.memory.percentage > 70;
    const isCritical =
      metrics.cpu.usage > this.thresholds.cpuWarning ||
      metrics.memory.percentage > this.thresholds.memoryWarning;

    let newInterval = this.updateInterval;

    if (isCritical) {
      // Critical: Monitor every 5 seconds
      newInterval = this.minInterval;
    } else if (isHighUsage) {
      // High usage: Monitor every 10 seconds
      newInterval = 10000;
    } else {
      // Low usage: Monitor every 30 seconds
      newInterval = this.maxInterval;
    }

    // Only restart if interval changed significantly
    if (Math.abs(newInterval - this.updateInterval) > 1000) {
      this.updateInterval = newInterval;

      // Restart monitoring with new interval
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => {
          this.collectMetrics();
        }, this.updateInterval);
      }
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    const cpuInfo = this.getCpuInfo();
    const cpuUsage = this.calculateCpuUsage(cpuInfo);
    const memInfo = this.getMemoryInfo();
    const processInfo = this.getProcessInfo();
    const systemInfo = this.getSystemInfo();

    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed,
        temperature: this.getCpuTemperature(),
      },
      memory: memInfo,
      process: processInfo,
      system: systemInfo,
      timestamp: Date.now(),
    };
  }

  private getCpuInfo(): any {
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

  private calculateCpuUsage(currentInfo: any): number {
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = currentInfo;
      return 0;
    }

    const idleDiff = currentInfo.idle - this.lastCpuInfo.idle;
    const totalDiff = currentInfo.total - this.lastCpuInfo.total;

    const usage = totalDiff === 0 ? 0 : 100 - (100 * idleDiff) / totalDiff;

    this.lastCpuInfo = currentInfo;

    return Math.round(usage * 10) / 10; // Round to 1 decimal
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

  private getProcessInfo(): PerformanceMetrics['process'] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      handles: (process as any)._getActiveHandles?.()?.length || 0,
      threads: (process as any)._getActiveRequests?.()?.length || 0,
    };
  }

  private getSystemInfo(): PerformanceMetrics['system'] {
    return {
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      version: os.release(),
    };
  }

  private getCpuTemperature(): number | undefined {
    // This would require platform-specific implementation
    // For now, return undefined
    return undefined;
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // Keep history size limited
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

      // DISABLED: Can cause V8 API locking issues
      // Trigger garbage collection if available
      // if (global.gc) {
      //   global.gc();
      // }
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

      // Log to error handler
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

  public getMetrics(): PerformanceMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  public getAverageMetrics(duration: number = 60000): Partial<PerformanceMetrics> {
    const now = Date.now();
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp > now - duration);

    if (relevantMetrics.length === 0) {
      return {};
    }

    const avgCpu =
      relevantMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / relevantMetrics.length;
    const avgMemory =
      relevantMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / relevantMetrics.length;
    const avgAppMemory =
      relevantMetrics.reduce((sum, m) => sum + m.memory.appUsage, 0) / relevantMetrics.length;

    return {
      cpu: {
        usage: Math.round(avgCpu * 10) / 10,
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed,
      },
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        percentage: Math.round(avgMemory * 10) / 10,
        appUsage: Math.round(avgAppMemory),
      },
    };
  }

  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  public clearHistory(): void {
    this.metricsHistory = [];
  }

  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  public isHealthy(): boolean {
    const metrics = this.getMetrics();
    if (!metrics) return true;

    return (
      metrics.cpu.usage < this.thresholds.cpuWarning &&
      metrics.memory.percentage < this.thresholds.memoryWarning &&
      metrics.memory.appUsage / (1024 * 1024) < this.thresholds.appMemoryLimit
    );
  }

  public getHealthStatus(): {
    healthy: boolean;
    issues: string[];
  } {
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

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.metricsHistory = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
