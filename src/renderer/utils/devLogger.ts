/**
 * @file devLogger.ts
 * @description Development-only logging utility with categorization and formatting.
 * Only active in development mode to avoid production log pollution.
 */

type LogCategory = 'component' | 'state' | 'ipc' | 'performance' | 'event' | 'render' | 'general';

interface LogOptions {
  category?: LogCategory;
  data?: unknown;
  color?: string;
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  component: '#3b82f6', // Blue
  state: '#8b5cf6', // Purple
  ipc: '#10b981', // Green
  performance: '#f59e0b', // Orange
  event: '#ec4899', // Pink
  render: '#06b6d4', // Cyan
  general: '#6b7280', // Gray
};

const CATEGORY_EMOJI: Record<LogCategory, string> = {
  component: '🧩',
  state: '📦',
  ipc: '📡',
  performance: '⚡',
  event: '🎯',
  render: '🎨',
  general: '📝',
};

class DevLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, options: LogOptions = {}): void {
    if (!this.isDevelopment) return;

    const { category = 'general', data, color } = options;
    const emoji = CATEGORY_EMOJI[category];
    const categoryColor = color || CATEGORY_COLORS[category];

    console.log(
      `%c${emoji} [${category.toUpperCase()}]%c ${message}`,
      `color: ${categoryColor}; font-weight: bold;`,
      'color: inherit;'
    );

    if (data !== undefined) {
      console.log('%c└─ Data:', 'color: #9ca3af;', data);
    }
  }

  /**
   * Log component lifecycle events
   */
  component(componentName: string, event: 'mount' | 'unmount' | 'update', data?: unknown): void {
    this.debug(`${componentName} ${event}`, {
      category: 'component',
      data,
    });
  }

  /**
   * Log state changes
   */
  state(storeName: string, action: string, data?: unknown): void {
    this.debug(`${storeName}.${action}`, {
      category: 'state',
      data,
    });
  }

  /**
   * Log IPC communication
   */
  ipc(channel: string, direction: 'send' | 'receive', data?: unknown): void {
    const arrow = direction === 'send' ? '→' : '←';
    this.debug(`${arrow} ${channel}`, {
      category: 'ipc',
      data,
    });
  }

  /**
   * Log performance measurements
   */
  performance(label: string, duration: number): void {
    this.debug(`${label}: ${duration.toFixed(2)}ms`, {
      category: 'performance',
    });
  }

  /**
   * Start a performance timer
   */
  startTimer(label: string): () => void {
    if (!this.isDevelopment) return () => {};

    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.performance(label, duration);
    };
  }

  /**
   * Log render information
   */
  render(componentName: string, reason?: string): void {
    this.debug(`${componentName} rendered${reason ? `: ${reason}` : ''}`, {
      category: 'render',
    });
  }

  /**
   * Group logs together
   */
  group(label: string, callback: () => void): void {
    if (!this.isDevelopment) {
      callback();
      return;
    }

    console.group(`%c📂 ${label}`, 'color: #3b82f6; font-weight: bold;');
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Create a table visualization
   */
  table(data: unknown): void {
    if (!this.isDevelopment) return;
    console.table(data);
  }
}

export const devLogger = new DevLogger();
