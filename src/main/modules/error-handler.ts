import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  SYSTEM = 'system',
  NATIVE = 'native',
  USER_INPUT = 'user_input',
  FILE_OPERATION = 'file_operation',
  WINDOW = 'window',
  IPC = 'ipc',
  PERFORMANCE = 'performance',
  PERMISSION = 'permission'
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAction?: string;
  systemInfo?: {
    platform: string;
    arch: string;
    version: string;
    memory: NodeJS.MemoryUsage;
  };
}

export interface ErrorHandlerOptions {
  logToFile?: boolean;
  logPath?: string;
  showUserNotification?: boolean;
  autoReportCritical?: boolean;
  maxLogSize?: number;
  retentionDays?: number;
}

export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler;
  private errors: ErrorReport[] = [];
  private options: Required<ErrorHandlerOptions>;
  private logStream?: fs.WriteStream;
  private isShuttingDown = false;

  private constructor(options: ErrorHandlerOptions = {}) {
    super();
    
    this.options = {
      logToFile: true,
      logPath: path.join(app.getPath('userData'), 'logs'),
      showUserNotification: true,
      autoReportCritical: false,
      maxLogSize: 10 * 1024 * 1024, // 10MB
      retentionDays: 7,
      ...options
    };

    this.initializeLogging();
    this.setupGlobalHandlers();
    this.cleanOldLogs();
  }

  public static getInstance(options?: ErrorHandlerOptions): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  private initializeLogging(): void {
    if (!this.options.logToFile) return;

    try {
      // Ensure log directory exists
      if (!fs.existsSync(this.options.logPath)) {
        fs.mkdirSync(this.options.logPath, { recursive: true });
      }

      const logFileName = `dropover-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.options.logPath, logFileName);

      // Create or append to log file
      this.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      
      this.logStream.on('error', (error) => {
        console.error('Failed to write to log file:', error);
      });

      // Rotate log if it's too large
      this.rotateLogIfNeeded(logFilePath);
    } catch (error) {
      console.error('Failed to initialize logging:', error);
    }
  }

  private rotateLogIfNeeded(logFilePath: string): void {
    try {
      const stats = fs.statSync(logFilePath);
      if (stats.size > this.options.maxLogSize) {
        const rotatedPath = `${logFilePath}.${Date.now()}.old`;
        fs.renameSync(logFilePath, rotatedPath);
        this.logStream?.end();
        this.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      }
    } catch (error) {
      // Log file doesn't exist yet, which is fine
    }
  }

  private cleanOldLogs(): void {
    if (!this.options.logToFile) return;

    try {
      const files = fs.readdirSync(this.options.logPath);
      const now = Date.now();
      const maxAge = this.options.retentionDays * 24 * 60 * 60 * 1000;

      files.forEach(file => {
        if (file.startsWith('dropover-') && file.endsWith('.log')) {
          const filePath = path.join(this.options.logPath, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.handleError(error, {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM,
        context: { type: 'uncaughtException' }
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.handleError(new Error(`Unhandled Promise Rejection: ${reason}`), {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
        context: { type: 'unhandledRejection', promise }
      });
    });

    // Handle app errors
    app.on('render-process-gone', (event, webContents, details) => {
      this.handleError(new Error('Renderer process crashed'), {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM,
        context: { details }
      });
    });

    app.on('child-process-gone', (event, details) => {
      this.handleError(new Error('Child process crashed'), {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
        context: { details }
      });
    });

    // Clean up on app quit
    app.on('before-quit', () => {
      this.shutdown();
    });
  }

  public handleError(
    error: Error | string,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: Record<string, any>;
      userAction?: string;
      showNotification?: boolean;
    } = {}
  ): void {
    if (this.isShuttingDown) return;

    const errorReport: ErrorReport = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity: options.severity || ErrorSeverity.MEDIUM,
      category: options.category || ErrorCategory.SYSTEM,
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      context: options.context,
      userAction: options.userAction,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        memory: process.memoryUsage()
      }
    };

    // Store error
    this.errors.push(errorReport);
    if (this.errors.length > 1000) {
      this.errors.shift(); // Keep only last 1000 errors in memory
    }

    // Log error
    this.logError(errorReport);

    // Emit error event
    this.emit('error', errorReport);

    // Show user notification if needed
    if (options.showNotification !== false && this.shouldShowNotification(errorReport)) {
      this.showUserNotification(errorReport);
    }

    // Auto-report critical errors
    if (this.options.autoReportCritical && errorReport.severity === ErrorSeverity.CRITICAL) {
      this.reportError(errorReport);
    }

    // Handle specific error categories
    this.handleSpecificError(errorReport);
  }

  private handleSpecificError(error: ErrorReport): void {
    switch (error.category) {
      case ErrorCategory.PERMISSION:
        this.handlePermissionError(error);
        break;
      case ErrorCategory.NATIVE:
        this.handleNativeError(error);
        break;
      case ErrorCategory.WINDOW:
        this.handleWindowError(error);
        break;
      case ErrorCategory.PERFORMANCE:
        this.handlePerformanceError(error);
        break;
    }
  }

  private handlePermissionError(error: ErrorReport): void {
    if (error.message.includes('Accessibility')) {
      // Show specific accessibility permission dialog
      dialog.showMessageBox({
        type: 'warning',
        title: 'Permission Required',
        message: 'Dropover needs accessibility permission to track mouse movements.',
        detail: 'Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility',
        buttons: ['Open System Preferences', 'Later']
      }).then(result => {
        if (result.response === 0) {
          // Open system preferences on macOS
          if (process.platform === 'darwin') {
            const { exec } = require('child_process');
            exec('open x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
          }
        }
      });
    }
  }

  private handleNativeError(error: ErrorReport): void {
    console.error('Native module error:', error);
    // Could fallback to alternative implementation
    this.emit('native-error', error);
  }

  private handleWindowError(error: ErrorReport): void {
    console.error('Window error:', error);
    // Could attempt to recreate window
    this.emit('window-error', error);
  }

  private handlePerformanceError(error: ErrorReport): void {
    console.warn('Performance issue detected:', error);
    // Could trigger performance optimization
    this.emit('performance-issue', error);
  }

  private shouldShowNotification(error: ErrorReport): boolean {
    if (!this.options.showUserNotification) return false;
    
    // Don't show notifications for low severity errors
    if (error.severity === ErrorSeverity.LOW) return false;
    
    // Don't show repeated errors
    const recentErrors = this.errors.filter(e => 
      e.timestamp > Date.now() - 60000 && // Last minute
      e.message === error.message
    );
    
    return recentErrors.length <= 1;
  }

  private showUserNotification(error: ErrorReport): void {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    if (focusedWindow) {
      focusedWindow.webContents.send('error-notification', {
        severity: error.severity,
        message: this.getUserFriendlyMessage(error)
      });
    } else if (error.severity === ErrorSeverity.CRITICAL) {
      // Show system dialog for critical errors when no window is focused
      dialog.showErrorBox('Dropover Error', this.getUserFriendlyMessage(error));
    }
  }

  private getUserFriendlyMessage(error: ErrorReport): string {
    // Convert technical errors to user-friendly messages
    if (error.message.includes('ENOENT')) {
      return 'File or folder not found';
    }
    if (error.message.includes('EACCES')) {
      return 'Permission denied accessing file';
    }
    if (error.message.includes('ENOMEM')) {
      return 'Not enough memory available';
    }
    if (error.message.includes('Accessibility')) {
      return 'Accessibility permission required for mouse tracking';
    }
    
    // Default to original message for user-initiated errors
    if (error.category === ErrorCategory.USER_INPUT) {
      return error.message;
    }
    
    // Generic message for technical errors
    return `An error occurred: ${error.message}`;
  }

  private logError(error: ErrorReport): void {
    // Console log
    const logMessage = `[${error.severity.toUpperCase()}] [${error.category}] ${error.message}`;
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, error);
        break;
      case ErrorSeverity.HIGH:
        console.error(logMessage);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage);
        break;
      case ErrorSeverity.LOW:
        console.log(logMessage);
        break;
    }

    // File log
    if (this.options.logToFile && this.logStream) {
      const logEntry = {
        ...error,
        timestamp: new Date(error.timestamp).toISOString()
      };
      
      this.logStream.write(JSON.stringify(logEntry) + '\n');
    }
  }

  private reportError(error: ErrorReport): void {
    // TODO: Implement error reporting to external service
  }

  public getErrors(filter?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    since?: number;
  }): ErrorReport[] {
    let errors = [...this.errors];

    if (filter) {
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity);
      }
      if (filter.category) {
        errors = errors.filter(e => e.category === filter.category);
      }
      if (filter.since !== undefined) {
        const since = filter.since;
        errors = errors.filter(e => e.timestamp > since);
      }
    }

    return errors;
  }

  public clearErrors(): void {
    this.errors = [];
  }

  public exportErrorLog(): string {
    const logPath = path.join(this.options.logPath, `error-export-${Date.now()}.json`);
    
    try {
      fs.writeFileSync(logPath, JSON.stringify(this.errors, null, 2));
      return logPath;
    } catch (error) {
      this.handleError(error as Error, {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.FILE_OPERATION,
        context: { operation: 'export-log' }
      });
      throw error;
    }
  }

  public shutdown(): void {
    this.isShuttingDown = true;
    
    if (this.logStream) {
      this.logStream.end();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();