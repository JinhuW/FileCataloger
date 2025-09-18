import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LogLevel, LogEntry as SharedLogEntry, ILogger } from '@shared/logger';

/**
 * Main process log entry (extends shared interface)
 */
interface LogEntry extends SharedLogEntry {
  processType: 'main';
}

/**
 * Console color mappings for different log levels
 */
const CONSOLE_COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m', // Green
  [LogLevel.WARN]: '\x1b[33m', // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  RESET: '\x1b[0m', // Reset
  TIMESTAMP: '\x1b[90m', // Gray
  CONTEXT: '\x1b[35m', // Magenta
} as const;

/**
 * Logger configuration
 */
interface LoggerConfig {
  logLevel: LogLevel;
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  logDirectory: string;
  maxLogFiles: number;
  logFilePrefix: string;
  logFileExtension: string;
}

/**
 * Comprehensive Logger class with singleton pattern
 * Supports both console and file logging with different log levels,
 * timestamps, context information, and log rotation.
 */
export class Logger implements ILogger {
  private static instance: Logger | null = null;
  private config: LoggerConfig;
  private logDirectory: string;
  private currentLogFile: string;
  private fileWriteStream: fs.WriteStream | null = null;
  private isInitialized: boolean = false;
  private pendingLogs: LogEntry[] = [];
  private context: string | null = null;

  private constructor(config?: Partial<LoggerConfig>) {
    const defaultConfig: LoggerConfig = {
      logLevel: LogLevel.DEBUG,
      enableConsoleLogging: true,
      enableFileLogging: true,
      logDirectory: this.getLogDirectory(),
      maxLogFiles: 7, // Keep 7 days worth of logs
      logFilePrefix: 'app',
      logFileExtension: 'log',
    };

    this.config = { ...defaultConfig, ...config };
    this.logDirectory = this.config.logDirectory;
    this.currentLogFile = this.generateLogFileName();

    this.initialize();
  }

  /**
   * Get singleton instance of Logger
   */
  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Set logging context for subsequent log entries
   */
  public setContext(context: string): Logger {
    this.context = context;
    return this;
  }

  /**
   * Clear logging context
   */
  public clearContext(): Logger {
    this.context = null;
    return this;
  }

  /**
   * Create a new logger instance with specific context
   */
  public createContextLogger(context: string): Logger {
    const contextLogger = Object.create(Logger.prototype);
    Object.assign(contextLogger, this);
    contextLogger.context = context;
    return contextLogger;
  }

  /**
   * Initialize logger - create directories, setup file stream, process pending logs
   */
  private async initialize(): Promise<void> {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }

      // Setup file logging if enabled
      if (this.config.enableFileLogging) {
        await this.setupFileLogging();
        await this.rotateOldLogs();
      }

      this.isInitialized = true;

      // Process any pending logs
      if (this.pendingLogs.length > 0) {
        for (const entry of this.pendingLogs) {
          this.writeLogEntry(entry);
        }
        this.pendingLogs = [];
      }

      // Log successful initialization
      this.info('Logger initialized successfully', {
        logDirectory: this.logDirectory,
        currentLogFile: this.currentLogFile,
        config: this.config,
      });
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      // Fall back to console-only logging
      this.config.enableFileLogging = false;
      this.isInitialized = true;
    }
  }

  /**
   * Setup file logging stream
   */
  private async setupFileLogging(): Promise<void> {
    try {
      const logFilePath = path.join(this.logDirectory, this.currentLogFile);

      // Close existing stream if any
      if (this.fileWriteStream) {
        this.fileWriteStream.end();
      }

      // Create new write stream
      this.fileWriteStream = fs.createWriteStream(logFilePath, { flags: 'a' });

      // Handle stream errors
      this.fileWriteStream.on('error', error => {
        console.error('Log file write error:', error);
        this.config.enableFileLogging = false;
      });
    } catch (error) {
      console.error('Failed to setup file logging:', error);
      this.config.enableFileLogging = false;
    }
  }

  /**
   * Get appropriate log directory based on environment
   */
  private getLogDirectory(): string {
    try {
      // Try to get Electron app userData directory
      if (app && app.getPath) {
        return path.join(app.getPath('userData'), 'logs');
      }
    } catch (error) {
      // Not in Electron main process, use fallback
    }

    // Fallback directories
    const userDataDir =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? process.env.HOME + '/Library/Application Support'
        : process.env.HOME + '/.local/share');

    return path.join(userDataDir || './logs', 'filecataloger', 'logs');
  }

  /**
   * Generate log file name with current date
   */
  private generateLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `${this.config.logFilePrefix}-${dateStr}.${this.config.logFileExtension}`;
  }

  /**
   * Rotate old log files (keep only last N days)
   */
  private async rotateOldLogs(): Promise<void> {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        return;
      }

      const files = fs.readdirSync(this.logDirectory);
      const logFiles = files
        .filter(
          file =>
            file.startsWith(this.config.logFilePrefix) &&
            file.endsWith(this.config.logFileExtension)
        )
        .map(file => ({
          name: file,
          path: path.join(this.logDirectory, file),
          mtime: fs.statSync(path.join(this.logDirectory, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove files beyond the maximum count
      if (logFiles.length > this.config.maxLogFiles) {
        const filesToDelete = logFiles.slice(this.config.maxLogFiles);
        for (const file of filesToDelete) {
          try {
            fs.unlinkSync(file.path);
            // Using console.log intentionally during log rotation
            // eslint-disable-next-line no-console
            console.log(`Rotated old log file: ${file.name}`);
          } catch (error) {
            console.warn(`Failed to delete old log file ${file.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to rotate old logs:', error);
    }
  }

  /**
   * Format timestamp for logs
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
   * Write log entry to both console and file
   */
  private writeLogEntry(entry: LogEntry): void {
    // Write to console if enabled
    if (this.config.enableConsoleLogging) {
      this.writeToConsole(entry);
    }

    // Write to file if enabled and initialized
    if (this.config.enableFileLogging && this.fileWriteStream) {
      this.writeToFile(entry);
    }
  }

  /**
   * Write log entry to console with colors
   */
  private writeToConsole(entry: LogEntry): void {
    const color = CONSOLE_COLORS[entry.level];
    const reset = CONSOLE_COLORS.RESET;
    const timestampColor = CONSOLE_COLORS.TIMESTAMP;
    const contextColor = CONSOLE_COLORS.CONTEXT;

    let formattedMessage = `${timestampColor}[${entry.timestamp}]${reset} `;
    formattedMessage += `${color}[${entry.levelName}]${reset}`;

    if (entry.context) {
      formattedMessage += ` ${contextColor}[${entry.context}]${reset}`;
    }

    formattedMessage += ` ${entry.message}`;

    // Choose appropriate console method
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...(entry.data || []));
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...(entry.data || []));
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...(entry.data || []));
        break;
      case LogLevel.DEBUG:
        console.log(formattedMessage, ...(entry.data || []));
        break;
    }
  }

  /**
   * Write log entry to file (plain text format)
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.fileWriteStream) {
      return;
    }

    let logLine = `[${entry.timestamp}] [${entry.levelName}]`;

    if (entry.context) {
      logLine += ` [${entry.context}]`;
    }

    logLine += ` ${entry.message}`;

    // Add data if present
    if (entry.data && entry.data.length > 0) {
      try {
        const dataStr = entry.data
          .map(item => (typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)))
          .join(' ');
        logLine += ` ${dataStr}`;
      } catch (error) {
        logLine += ` [Unable to serialize data: ${error}]`;
      }
    }

    logLine += '\n';

    // Write to file immediately (no buffering for important logs)
    this.fileWriteStream.write(logLine);
  }

  /**
   * Create log entry and write it
   */
  private log(level: LogLevel, message: string, ...data: any[]): void {
    // Check if this level should be logged
    if (level < this.config.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      levelName: this.getLevelName(level),
      context: this.context || undefined,
      message,
      data: data.length > 0 ? data : undefined,
      processType: 'main',
    };

    if (this.isInitialized) {
      this.writeLogEntry(entry);
    } else {
      // Store pending logs until initialization is complete
      this.pendingLogs.push(entry);
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

  /**
   * Update logger configuration
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Re-initialize if file logging settings changed
    if (
      oldConfig.enableFileLogging !== newConfig.enableFileLogging ||
      oldConfig.logDirectory !== newConfig.logDirectory
    ) {
      this.initialize();
    }

    this.info('Logger configuration updated', { newConfig, oldConfig });
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
    this.info(`Log level changed to ${this.getLevelName(level)}`);
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Get log file path
   */
  public getLogFilePath(): string | null {
    if (!this.config.enableFileLogging) {
      return null;
    }
    return path.join(this.logDirectory, this.currentLogFile);
  }

  /**
   * Flush and close logger
   */
  public async close(): Promise<void> {
    return new Promise(resolve => {
      if (this.fileWriteStream) {
        this.fileWriteStream.end(() => {
          this.info('Logger closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Check if logger is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();

/**
 * Convenience function for creating context loggers
 */
export function createLogger(context: string): Logger {
  return logger.createContextLogger(context);
}

// Export from shared logger
export { LogLevel } from '@shared/logger';
