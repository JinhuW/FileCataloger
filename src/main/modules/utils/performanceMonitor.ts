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

export interface PredictiveTrend {
  metric: 'cpu' | 'memory';
  trend: 'increasing' | 'stable' | 'decreasing';
  slope: number; // Rate of change per minute
  confidence: number; // 0-1, how confident we are in this prediction
  predictedIssueIn?: number; // milliseconds until threshold breach (if trending toward issue)
  recommendation?: string;
}

export interface PredictiveAlert {
  severity: 'warning' | 'critical';
  metric: string;
  currentValue: number;
  predictedValue: number;
  predictedTime: number; // when the issue is predicted to occur
  trend: PredictiveTrend;
  suggestion: string;
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 10; // Reduced from 100 to 10 to prevent memory accumulation
  private updateInterval: number = 30000; // 30 seconds - further reduced to minimize overhead
  private adaptiveInterval: boolean = true;
  private minInterval: number = 5000; // 5 seconds minimum
  private maxInterval: number = 30000; // 30 seconds maximum

  private thresholds: PerformanceThresholds = {
    cpuWarning: 80,
    cpuCritical: 95,
    memoryWarning: 95, // macOS commonly uses 95%+ memory normally
    memoryCritical: 99, // Only alert at extreme levels
    appMemoryLimit: 200, // Reduced from 500MB to 200MB for this app
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
      this.checkPredictiveIssues();

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

  /**
   * Perform predictive trend analysis on performance metrics
   */
  public analyzeTrends(lookbackMinutes: number = 5): PredictiveTrend[] {
    const now = Date.now();
    const lookbackMs = lookbackMinutes * 60 * 1000;
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp > now - lookbackMs);

    if (relevantMetrics.length < 3) {
      return []; // Need at least 3 data points for trend analysis
    }

    const trends: PredictiveTrend[] = [];

    // Analyze CPU trend
    const cpuTrend = this.calculateTrend(
      relevantMetrics,
      m => m.cpu.usage,
      'cpu',
      this.thresholds.cpuWarning,
      this.thresholds.cpuCritical
    );
    if (cpuTrend) trends.push(cpuTrend);

    // Analyze memory trend
    const memoryTrend = this.calculateTrend(
      relevantMetrics,
      m => m.memory.percentage,
      'memory',
      this.thresholds.memoryWarning,
      this.thresholds.memoryCritical
    );
    if (memoryTrend) trends.push(memoryTrend);

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(
    metrics: PerformanceMetrics[],
    valueExtractor: (m: PerformanceMetrics) => number,
    metricName: 'cpu' | 'memory',
    warningThreshold: number,
    criticalThreshold: number
  ): PredictiveTrend | null {
    if (metrics.length < 3) return null;

    const values = metrics.map(valueExtractor);
    const times = metrics.map(m => m.timestamp);

    // Calculate linear regression slope (rate of change per minute)
    const n = values.length;
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Convert slope to per-minute rate
    const slopePerMinute = slope * 60 * 1000; // Convert from per-ms to per-minute

    // Determine trend direction
    let trend: 'increasing' | 'stable' | 'decreasing';
    if (Math.abs(slopePerMinute) < 1) {
      trend = 'stable';
    } else if (slopePerMinute > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Calculate confidence based on R-squared
    const meanY = sumY / n;
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = slope * times[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Predict when thresholds might be breached
    let predictedIssueIn: number | undefined;
    let recommendation: string | undefined;

    if (trend === 'increasing' && slopePerMinute > 0.5) {
      const currentValue = values[values.length - 1];
      const timeToWarning =
        currentValue < warningThreshold
          ? ((warningThreshold - currentValue) / slopePerMinute) * 60 * 1000
          : 0;
      const timeToCritical =
        currentValue < criticalThreshold
          ? ((criticalThreshold - currentValue) / slopePerMinute) * 60 * 1000
          : 0;

      if (timeToCritical > 0 && timeToCritical < 300000) {
        // Less than 5 minutes
        predictedIssueIn = timeToCritical;
        recommendation = `${metricName.toUpperCase()} trending toward critical level. Consider reducing system load.`;
      } else if (timeToWarning > 0 && timeToWarning < 600000) {
        // Less than 10 minutes
        predictedIssueIn = timeToWarning;
        recommendation = `${metricName.toUpperCase()} usage increasing. Monitor closely.`;
      }
    }

    if (trend === 'decreasing' && values[values.length - 1] > warningThreshold) {
      recommendation = `${metricName.toUpperCase()} usage decreasing. System recovering.`;
    }

    return {
      metric: metricName,
      trend,
      slope: slopePerMinute,
      confidence,
      predictedIssueIn,
      recommendation,
    };
  }

  /**
   * Generate predictive alerts based on trend analysis
   */
  public generatePredictiveAlerts(): PredictiveAlert[] {
    const trends = this.analyzeTrends();
    const alerts: PredictiveAlert[] = [];
    const currentMetrics = this.getMetrics();

    if (!currentMetrics) return alerts;

    for (const trend of trends) {
      if (trend.predictedIssueIn && trend.recommendation) {
        const currentValue =
          trend.metric === 'cpu' ? currentMetrics.cpu.usage : currentMetrics.memory.percentage;

        const predictedValue = currentValue + trend.slope * (trend.predictedIssueIn / (60 * 1000));

        const severity: 'warning' | 'critical' =
          trend.predictedIssueIn < 180000 ? 'critical' : 'warning';

        alerts.push({
          severity,
          metric: trend.metric,
          currentValue,
          predictedValue,
          predictedTime: Date.now() + trend.predictedIssueIn,
          trend,
          suggestion: trend.recommendation,
        });
      }
    }

    return alerts;
  }

  /**
   * Check for predictive issues and emit alerts
   */
  private checkPredictiveIssues(): void {
    const alerts = this.generatePredictiveAlerts();

    for (const alert of alerts) {
      this.emit('predictive-alert', alert);
    }
  }

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.metricsHistory = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
