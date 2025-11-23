import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Configuration for circular log buffer
 */
export interface CircularLogConfig {
  maxLines: number;
  flushInterval: number; // milliseconds
  backupOnRotate: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CIRCULAR_CONFIG: CircularLogConfig = {
  maxLines: 1000,
  flushInterval: 5000, // Flush every 5 seconds
  backupOnRotate: false,
};

/**
 * Circular log buffer that maintains only the last N lines
 */
export class CircularLogBuffer {
  private config: CircularLogConfig;
  private buffer: string[] = [];
  private logFilePath: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;

  constructor(logFilePath: string, config: Partial<CircularLogConfig> = {}) {
    this.logFilePath = logFilePath;
    this.config = { ...DEFAULT_CIRCULAR_CONFIG, ...config };

    // Load existing log file if it exists
    this.loadExistingLog().catch(() => {
      // Ignore errors, start with empty buffer
    });

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Load existing log file into buffer
   */
  private async loadExistingLog(): Promise<void> {
    try {
      const content = await readFile(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      // Keep only the last maxLines
      if (lines.length > this.config.maxLines) {
        this.buffer = lines.slice(-this.config.maxLines);
      } else {
        this.buffer = lines;
      }
    } catch (error) {
      // File doesn't exist or can't be read, start fresh
      this.buffer = [];
    }
  }

  /**
   * Add a log line to the buffer
   */
  public addLine(line: string): void {
    // Remove newlines from the line (we'll add them when writing)
    const cleanLine = line.replace(/\n/g, ' ');

    this.buffer.push(cleanLine);

    // Remove oldest lines if we exceed maxLines
    while (this.buffer.length > this.config.maxLines) {
      this.buffer.shift();
    }

    this.isDirty = true;
  }

  /**
   * Add multiple lines to the buffer
   */
  public addLines(lines: string[]): void {
    for (const line of lines) {
      this.addLine(line);
    }
  }

  /**
   * Get current buffer contents
   */
  public getLines(): string[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size
   */
  public getLineCount(): number {
    return this.buffer.length;
  }

  /**
   * Flush buffer to disk
   */
  public async flush(): Promise<void> {
    if (!this.isDirty || this.buffer.length === 0) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the entire buffer
      const content = this.buffer.join('\n') + '\n';
      await writeFile(this.logFilePath, content, 'utf-8');

      this.isDirty = false;
    } catch (error) {
      // Fallback to console since this is a low-level logging utility
      // eslint-disable-next-line no-console
      console.error('Failed to flush log buffer:', error);
    }
  }

  /**
   * Force rotation (clear buffer and optionally backup)
   */
  public async rotate(): Promise<void> {
    if (this.config.backupOnRotate && this.buffer.length > 0) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = this.logFilePath.replace(/\.log$/, `-${timestamp}.log`);
        await writeFile(backupPath, this.buffer.join('\n') + '\n', 'utf-8');
      } catch (error) {
        // Fallback to console since this is a low-level logging utility
        // eslint-disable-next-line no-console
        console.error('Failed to backup log during rotation:', error);
      }
    }

    // Clear buffer
    this.buffer = [];
    this.isDirty = true;
    await this.flush();
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        // Fallback to console since this is a low-level logging utility
        // eslint-disable-next-line no-console
        console.error('Auto-flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer and flush remaining data
   */
  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Get estimated memory usage
   */
  public getMemoryUsage(): number {
    // Rough estimate: average 100 bytes per log line
    return this.buffer.length * 100;
  }

  /**
   * Clear all logs
   */
  public async clear(): Promise<void> {
    this.buffer = [];
    this.isDirty = true;
    await this.flush();
  }
}
