/**
 * Shared logger interfaces and types for both main and renderer processes
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  context?: string;
  message: string;
  data?: any[];
  processType: 'main' | 'renderer';
  processId?: string;
}

/**
 * Logger interface that both main and renderer loggers implement
 */
export interface ILogger {
  debug(message: string, ...data: any[]): void;
  info(message: string, ...data: any[]): void;
  warn(message: string, ...data: any[]): void;
  error(message: string, ...data: any[]): void;
  setContext(context: string): ILogger;
  clearContext(): ILogger;
  createContextLogger(context: string): ILogger;
  setLogLevel(level: LogLevel): void;
  isReady(): boolean;
}

/**
 * Renderer logger that forwards logs to main process
 */
export class RendererLogger implements ILogger {
  private context: string | null = null;
  private logLevel: LogLevel = LogLevel.DEBUG;
  private processId: string;

  constructor() {
    this.processId = `renderer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Set logging context
   */
  public setContext(context: string): ILogger {
    this.context = context;
    return this;
  }

  /**
   * Clear logging context
   */
  public clearContext(): ILogger {
    this.context = null;
    return this;
  }

  /**
   * Create a new logger instance with specific context
   */
  public createContextLogger(context: string): ILogger {
    const contextLogger = new RendererLogger();
    contextLogger.context = context;
    contextLogger.logLevel = this.logLevel;
    contextLogger.processId = this.processId;
    return contextLogger;
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if logger is ready
   */
  public isReady(): boolean {
    // Check if in renderer process with window available
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined') {
      const win = (globalThis as any).window;
      return win.api && typeof win.api.send === 'function';
    }
    return false;
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get level name from LogLevel enum
   */
  private getLevelName(level: LogLevel): string {
    return LogLevel[level];
  }

  /**
   * Send log entry to main process and also log to console
   */
  private log(level: LogLevel, message: string, ...data: any[]): void {
    // Check if this level should be logged
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      levelName: this.getLevelName(level),
      context: this.context || undefined,
      message,
      data: data.length > 0 ? data : undefined,
      processType: 'renderer',
      processId: this.processId
    };

    // Log to console immediately for development
    this.logToConsole(entry);

    // Send to main process for file logging (if available)
    if (this.isReady()) {
      try {
        if (typeof (globalThis as any).window !== 'undefined') {
          (globalThis as any).window.api.send('logger:log', entry);
        }
      } catch (error) {
        console.warn('Failed to send log to main process:', error);
      }
    }
  }

  /**
   * Log to console with colors (similar to main logger)
   */
  private logToConsole(entry: LogEntry): void {
    const styles = {
      [LogLevel.DEBUG]: 'color: #00BCD4',   // Cyan
      [LogLevel.INFO]: 'color: #4CAF50',    // Green  
      [LogLevel.WARN]: 'color: #FF9800',    // Orange
      [LogLevel.ERROR]: 'color: #F44336',   // Red
      timestamp: 'color: #9E9E9E',          // Gray
      context: 'color: #9C27B0'             // Purple
    };

    let parts = [`%c[${entry.timestamp}]`, styles.timestamp];
    parts.push(`%c[${entry.levelName}]`, styles[entry.level]);
    
    if (entry.context) {
      parts.push(`%c[${entry.context}]`, styles.context);
    }
    
    parts.push(`%c${entry.message}`, 'color: inherit');

    // Choose appropriate console method
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(...parts, ...(entry.data || []));
        break;
      case LogLevel.WARN:
        console.warn(...parts, ...(entry.data || []));
        break;
      case LogLevel.INFO:
        console.info(...parts, ...(entry.data || []));
        break;
      case LogLevel.DEBUG:
        console.log(...parts, ...(entry.data || []));
        break;
    }
  }

  /**
   * Debug level logging
   */
  public debug(message: string, ...data: any[]): void {
    this.log(LogLevel.DEBUG, message, ...data);
  }

  /**
   * Info level logging
   */
  public info(message: string, ...data: any[]): void {
    this.log(LogLevel.INFO, message, ...data);
  }

  /**
   * Warning level logging
   */
  public warn(message: string, ...data: any[]): void {
    this.log(LogLevel.WARN, message, ...data);
  }

  /**
   * Error level logging
   */
  public error(message: string, ...data: any[]): void {
    this.log(LogLevel.ERROR, message, ...data);
  }
}

/**
 * Create a logger instance based on the current environment
 */
export function createLogger(context?: string): ILogger {
  const logger = new RendererLogger();
  if (context) {
    logger.setContext(context);
  }
  return logger;
}

/**
 * Default logger instance for renderer processes
 */
export const logger = new RendererLogger();