import { app } from 'electron';
import Store from 'electron-store';
import Database from 'better-sqlite3';
import * as path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger';

// For simple key-value storage
interface SessionData {
  lastShelfPosition: { x: number; y: number };
  recentFiles: Array<{ path: string; timestamp: number }>;
  windowStates: Record<string, { bounds: Electron.Rectangle }>;
  usageStats: {
    shelfCreations: number;
    filesDropped: number;
    lastUsed: number;
  };
}

// Schema for session data validation
const sessionDataSchema = z.object({
  lastShelfPosition: z.object({ x: z.number(), y: z.number() }),
  recentFiles: z.array(
    z.object({
      path: z.string(),
      timestamp: z.number(),
    })
  ),
  windowStates: z.record(
    z.string(),
    z.object({
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
  ),
  usageStats: z.object({
    shelfCreations: z.number(),
    filesDropped: z.number(),
    lastUsed: z.number(),
  }),
});

export class PersistentDataManager {
  private static instance: PersistentDataManager;

  // Simple key-value store for session data
  private sessionStore!: Store<SessionData>;

  // SQLite for complex queries and file history
  private db: Database.Database | null = null;

  // Local cache for frequently accessed data
  private cache: Map<string, any> = new Map();

  private constructor() {
    this.initializeSessionStore();
    this.initializeDatabase();
  }

  public static getInstance(): PersistentDataManager {
    if (!PersistentDataManager.instance) {
      PersistentDataManager.instance = new PersistentDataManager();
    }
    return PersistentDataManager.instance;
  }

  private initializeSessionStore(): void {
    this.sessionStore = new Store<SessionData>({
      name: 'session',
      defaults: {
        lastShelfPosition: { x: 0, y: 0 },
        recentFiles: [],
        windowStates: {},
        usageStats: {
          shelfCreations: 0,
          filesDropped: 0,
          lastUsed: Date.now(),
        },
      },

      // Clear old data automatically
      clearInvalidConfig: true,

      // Migrations for future updates
      migrations: {
        '1.0.0': store => {
          // Migrate old format to new
          if (store.has('recentFiles') && Array.isArray(store.get('recentFiles'))) {
            const files = store.get('recentFiles') as any[];
            if (files.length > 0 && typeof files[0] === 'string') {
              // Convert string paths to objects
              store.set(
                'recentFiles',
                files.map(path => ({
                  path,
                  timestamp: Date.now(),
                }))
              );
            }
          }
        },
      },
    });
  }

  private initializeDatabase(): void {
    try {
      const dbPath = path.join(app.getPath('userData'), 'data.db');
      this.db = new Database(dbPath);

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.createTables();

      // Prepare frequently used statements
      this.prepareStatements();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      this.db = null;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // File history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        operation TEXT NOT NULL,
        shelf_id TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_file_history_timestamp
      ON file_history(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_file_history_path
      ON file_history(file_path);
    `);

    // Analytics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_type
      ON analytics(event_type, timestamp DESC);
    `);

    // Shelf history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shelf_history (
        shelf_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        closed_at INTEGER,
        position_x INTEGER,
        position_y INTEGER,
        file_count INTEGER DEFAULT 0,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_shelf_history_created
      ON shelf_history(created_at DESC);
    `);
  }

  private prepareStatements(): void {
    if (!this.db) return;

    // Prepare common statements for better performance
    this.cache.set(
      'insertFileHistory',
      this.db.prepare(`
      INSERT INTO file_history (file_path, operation, shelf_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `)
    );

    this.cache.set(
      'getRecentFiles',
      this.db.prepare(`
      SELECT DISTINCT file_path, MAX(timestamp) as last_used
      FROM file_history
      GROUP BY file_path
      ORDER BY last_used DESC
      LIMIT ?
    `)
    );
  }

  // Session data methods

  public updateLastShelfPosition(x: number, y: number): void {
    this.sessionStore.set('lastShelfPosition', { x, y });
  }

  public getLastShelfPosition(): { x: number; y: number } {
    return this.sessionStore.get('lastShelfPosition');
  }

  public addRecentFile(filePath: string): void {
    const recentFiles = this.sessionStore.get('recentFiles');

    // Remove if already exists
    const filtered = recentFiles.filter(f => f.path !== filePath);

    // Add to beginning
    filtered.unshift({ path: filePath, timestamp: Date.now() });

    // Keep only last 50
    if (filtered.length > 50) {
      filtered.splice(50);
    }

    this.sessionStore.set('recentFiles', filtered);
  }

  public getRecentFiles(limit: number = 10): Array<{ path: string; timestamp: number }> {
    return this.sessionStore.get('recentFiles').slice(0, limit);
  }

  public updateUsageStats(type: 'shelfCreation' | 'fileDropped'): void {
    const stats = this.sessionStore.get('usageStats');

    if (type === 'shelfCreation') {
      stats.shelfCreations++;
    } else if (type === 'fileDropped') {
      stats.filesDropped++;
    }

    stats.lastUsed = Date.now();
    this.sessionStore.set('usageStats', stats);
  }

  // Database methods for complex data

  public recordFileOperation(
    filePath: string,
    operation: 'dropped' | 'removed' | 'opened',
    shelfId?: string,
    metadata?: any
  ): void {
    if (!this.db) return;

    try {
      const stmt = this.cache.get('insertFileHistory');
      stmt.run(
        filePath,
        operation,
        shelfId || null,
        Date.now(),
        metadata ? JSON.stringify(metadata) : null
      );
    } catch (error) {
      logger.error('Failed to record file operation:', error);
    }
  }

  public getFileHistory(filePath: string, limit: number = 10): any[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM file_history
        WHERE file_path = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      return stmt.all(filePath, limit);
    } catch (error) {
      logger.error('Failed to get file history:', error);
      return [];
    }
  }

  public recordAnalytics(eventType: string, eventData?: any): void {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO analytics (event_type, event_data, timestamp)
        VALUES (?, ?, ?)
      `);

      stmt.run(eventType, eventData ? JSON.stringify(eventData) : null, Date.now());
    } catch (error) {
      logger.error('Failed to record analytics:', error);
    }
  }

  public getAnalyticsSummary(daysBack: number = 30): any {
    if (!this.db) return null;

    try {
      const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

      const stmt = this.db.prepare(`
        SELECT
          event_type,
          COUNT(*) as count,
          DATE(timestamp / 1000, 'unixepoch') as date
        FROM analytics
        WHERE timestamp > ?
        GROUP BY event_type, date
        ORDER BY date DESC, count DESC
      `);

      return stmt.all(cutoff);
    } catch (error) {
      logger.error('Failed to get analytics summary:', error);
      return null;
    }
  }

  // Cleanup methods

  public async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    if (!this.db) return;

    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    try {
      // Clean file history
      this.db.prepare('DELETE FROM file_history WHERE timestamp < ?').run(cutoff);

      // Clean analytics
      this.db.prepare('DELETE FROM analytics WHERE timestamp < ?').run(cutoff);

      // Clean old shelf history
      this.db.prepare('DELETE FROM shelf_history WHERE created_at < ?').run(cutoff);

      // Vacuum to reclaim space
      this.db.exec('VACUUM');

      logger.info('Old data cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Export/Import functionality

  public async exportData(): Promise<string> {
    const data = {
      session: this.sessionStore.store,
      database: this.db ? await this.exportDatabase() : null,
      version: '1.0.0',
      exportDate: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  private async exportDatabase(): Promise<any> {
    if (!this.db) return null;

    return {
      fileHistory: this.db.prepare('SELECT * FROM file_history').all(),
      analytics: this.db.prepare('SELECT * FROM analytics').all(),
      shelfHistory: this.db.prepare('SELECT * FROM shelf_history').all(),
    };
  }

  public async importData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);

      // Validate and import session data
      if (data.session) {
        const validated = sessionDataSchema.parse(data.session);
        // Clear existing data and set new data
        this.sessionStore.clear();
        Object.entries(validated).forEach(([key, value]) => {
          this.sessionStore.set(key as keyof SessionData, value as any);
        });
      }

      // Import database data if available
      if (data.database && this.db) {
        await this.importDatabase(data.database);
      }

      return true;
    } catch (error) {
      logger.error('Failed to import data:', error);
      return false;
    }
  }

  private async importDatabase(data: any): Promise<void> {
    if (!this.db) return;

    // Start transaction
    const insertFileHistory = this.db.prepare(`
      INSERT OR REPLACE INTO file_history (id, file_path, operation, shelf_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAnalytics = this.db.prepare(`
      INSERT OR REPLACE INTO analytics (id, event_type, event_data, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    const insertShelfHistory = this.db.prepare(`
      INSERT OR REPLACE INTO shelf_history (shelf_id, created_at, closed_at, position_x, position_y, file_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      // Import file history
      if (data.fileHistory) {
        for (const row of data.fileHistory) {
          insertFileHistory.run(
            row.id,
            row.file_path,
            row.operation,
            row.shelf_id,
            row.timestamp,
            row.metadata
          );
        }
      }

      // Import analytics
      if (data.analytics) {
        for (const row of data.analytics) {
          insertAnalytics.run(row.id, row.event_type, row.event_data, row.timestamp);
        }
      }

      // Import shelf history
      if (data.shelfHistory) {
        for (const row of data.shelfHistory) {
          insertShelfHistory.run(
            row.shelf_id,
            row.created_at,
            row.closed_at,
            row.position_x,
            row.position_y,
            row.file_count,
            row.metadata
          );
        }
      }
    });

    transaction();
  }
}

// Export singleton
export const persistentDataManager = PersistentDataManager.getInstance();
