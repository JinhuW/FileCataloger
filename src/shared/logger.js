"use strict";
/**
 * Shared logger interfaces and types for both main and renderer processes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.RendererLogger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
/**
 * Log levels in order of severity
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Renderer logger that forwards logs to main process
 */
class RendererLogger {
    constructor() {
        this.context = null;
        this.logLevel = LogLevel.DEBUG;
        this.processId = `renderer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    /**
     * Set logging context
     */
    setContext(context) {
        this.context = context;
        return this;
    }
    /**
     * Clear logging context
     */
    clearContext() {
        this.context = null;
        return this;
    }
    /**
     * Create a new logger instance with specific context
     */
    createContextLogger(context) {
        const contextLogger = new RendererLogger();
        contextLogger.context = context;
        contextLogger.logLevel = this.logLevel;
        contextLogger.processId = this.processId;
        return contextLogger;
    }
    /**
     * Set log level
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    /**
     * Check if logger is ready
     */
    isReady() {
        return typeof window !== 'undefined' &&
            window.api &&
            typeof window.api.send === 'function';
    }
    /**
     * Format timestamp
     */
    formatTimestamp() {
        return new Date().toISOString();
    }
    /**
     * Get level name from LogLevel enum
     */
    getLevelName(level) {
        return LogLevel[level];
    }
    /**
     * Send log entry to main process and also log to console
     */
    log(level, message, ...data) {
        // Check if this level should be logged
        if (level < this.logLevel) {
            return;
        }
        const entry = {
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
                window.api.send('logger:log', entry);
            }
            catch (error) {
                console.warn('Failed to send log to main process:', error);
            }
        }
    }
    /**
     * Log to console with colors (similar to main logger)
     */
    logToConsole(entry) {
        const styles = {
            [LogLevel.DEBUG]: 'color: #00BCD4', // Cyan
            [LogLevel.INFO]: 'color: #4CAF50', // Green  
            [LogLevel.WARN]: 'color: #FF9800', // Orange
            [LogLevel.ERROR]: 'color: #F44336', // Red
            timestamp: 'color: #9E9E9E', // Gray
            context: 'color: #9C27B0' // Purple
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
    debug(message, ...data) {
        this.log(LogLevel.DEBUG, message, ...data);
    }
    /**
     * Info level logging
     */
    info(message, ...data) {
        this.log(LogLevel.INFO, message, ...data);
    }
    /**
     * Warning level logging
     */
    warn(message, ...data) {
        this.log(LogLevel.WARN, message, ...data);
    }
    /**
     * Error level logging
     */
    error(message, ...data) {
        this.log(LogLevel.ERROR, message, ...data);
    }
}
exports.RendererLogger = RendererLogger;
/**
 * Create a logger instance based on the current environment
 */
function createLogger(context) {
    const logger = new RendererLogger();
    if (context) {
        logger.setContext(context);
    }
    return logger;
}
/**
 * Default logger instance for renderer processes
 */
exports.logger = new RendererLogger();
//# sourceMappingURL=logger.js.map