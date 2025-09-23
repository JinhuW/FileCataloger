import * as path from 'path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { logger } from '../utils/logger';
import { InstalledPluginInfo } from '../plugins/pluginInstaller';

export interface PluginUsageStats {
  pluginId: string;
  useCount: number;
  lastUsed: number;
  errorCount: number;
  totalExecutionTime: number;
}

export interface PluginConfig {
  pluginId: string;
  config: Record<string, any>;
  updatedAt: number;
}

export class PluginStorageManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'plugins.db');
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.db = new Database(this.dbPath, {
        verbose: (message?: unknown, ...additionalArgs: unknown[]) => {
          logger.debug(String(message), ...additionalArgs);
        }
      });

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.createTables();

      this.isInitialized = true;
      logger.info('Plugin storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize plugin storage:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Installed plugins table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installed_plugins (
        id TEXT PRIMARY KEY,
        package_name TEXT NOT NULL,
        version TEXT NOT NULL,
        install_date INTEGER NOT NULL,
        install_path TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        permissions TEXT,
        config TEXT,
        hash TEXT,
        UNIQUE(package_name)
      );

      CREATE TABLE IF NOT EXISTS plugin_usage (
        plugin_id TEXT PRIMARY KEY,
        use_count INTEGER DEFAULT 0,
        last_used INTEGER,
        error_count INTEGER DEFAULT 0,
        total_execution_time INTEGER DEFAULT 0,
        average_execution_time REAL DEFAULT 0,
        FOREIGN KEY(plugin_id) REFERENCES installed_plugins(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS plugin_configs (
        plugin_id TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(plugin_id) REFERENCES installed_plugins(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS plugin_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plugin_id TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        occurred_at INTEGER NOT NULL,
        FOREIGN KEY(plugin_id) REFERENCES installed_plugins(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_plugin_usage_last_used ON plugin_usage(last_used);
      CREATE INDEX IF NOT EXISTS idx_plugin_errors_plugin_id ON plugin_errors(plugin_id);
      CREATE INDEX IF NOT EXISTS idx_plugin_errors_occurred_at ON plugin_errors(occurred_at);
    `);
  }

  /**
   * Save installed plugin info
   */
  async saveInstalledPlugin(plugin: InstalledPluginInfo): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO installed_plugins
      (id, package_name, version, install_date, install_path, is_active, permissions, config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        plugin.id,
        plugin.packageName,
        plugin.version,
        plugin.installDate,
        plugin.installPath,
        plugin.isActive ? 1 : 0,
        JSON.stringify(plugin.permissions),
        JSON.stringify(plugin.config || {})
      );

      // Initialize usage stats
      this.initializeUsageStats(plugin.id);
    } catch (error) {
      logger.error('Failed to save installed plugin:', error);
      throw error;
    }
  }

  /**
   * Get all installed plugins
   */
  async getInstalledPlugins(): Promise<InstalledPluginInfo[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM installed_plugins ORDER BY install_date DESC
    `);

    try {
      const rows = stmt.all() as Array<{
        id: string;
        package_name: string;
        version: string;
        install_date: number;
        install_path: string;
        is_active: number;
        permissions: string;
        config: string;
      }>;
      return rows.map(row => ({
        id: row.id,
        packageName: row.package_name,
        version: row.version,
        installDate: row.install_date,
        installPath: row.install_path,
        isActive: row.is_active === 1,
        permissions: JSON.parse(row.permissions || '[]'),
        config: JSON.parse(row.config || '{}'),
      }));
    } catch (error) {
      logger.error('Failed to get installed plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId: string): Promise<InstalledPluginInfo | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM installed_plugins WHERE id = ?
    `);

    try {
      const row = stmt.get(pluginId) as {
        id: string;
        package_name: string;
        version: string;
        install_date: number;
        install_path: string;
        is_active: number;
        permissions: string;
        config: string;
      } | undefined;
      if (!row) return null;

      return {
        id: row.id,
        packageName: row.package_name,
        version: row.version,
        installDate: row.install_date,
        installPath: row.install_path,
        isActive: row.is_active === 1,
        permissions: JSON.parse(row.permissions || '[]'),
        config: JSON.parse(row.config || '{}'),
      };
    } catch (error) {
      logger.error('Failed to get plugin:', error);
      return null;
    }
  }

  /**
   * Update plugin active state
   */
  async updatePluginActiveState(pluginId: string, isActive: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE installed_plugins SET is_active = ? WHERE id = ?
    `);

    try {
      stmt.run(isActive ? 1 : 0, pluginId);
    } catch (error) {
      logger.error('Failed to update plugin active state:', error);
      throw error;
    }
  }

  /**
   * Remove plugin
   */
  async removePlugin(pluginId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM installed_plugins WHERE id = ?
    `);

    try {
      stmt.run(pluginId);
    } catch (error) {
      logger.error('Failed to remove plugin:', error);
      throw error;
    }
  }

  /**
   * Save plugin configuration
   */
  async savePluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO plugin_configs (plugin_id, config, updated_at)
      VALUES (?, ?, ?)
    `);

    try {
      stmt.run(pluginId, JSON.stringify(config), Date.now());
    } catch (error) {
      logger.error('Failed to save plugin config:', error);
      throw error;
    }
  }

  /**
   * Get plugin configuration
   */
  async getPluginConfig(pluginId: string): Promise<Record<string, any> | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT config FROM plugin_configs WHERE plugin_id = ?
    `);

    try {
      const row = stmt.get(pluginId) as { config: string } | undefined;
      return row ? JSON.parse(row.config) : null;
    } catch (error) {
      logger.error('Failed to get plugin config:', error);
      return null;
    }
  }

  /**
   * Initialize usage statistics for a plugin
   */
  private initializeUsageStats(pluginId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO plugin_usage (plugin_id, use_count, last_used, error_count, total_execution_time)
      VALUES (?, 0, 0, 0, 0)
    `);

    try {
      stmt.run(pluginId);
    } catch (error) {
      logger.error('Failed to initialize usage stats:', error);
    }
  }

  /**
   * Update plugin usage statistics
   */
  async updateUsageStats(pluginId: string, executionTime: number, success: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE plugin_usage
      SET use_count = use_count + 1,
          last_used = ?,
          error_count = error_count + ?,
          total_execution_time = total_execution_time + ?,
          average_execution_time = (total_execution_time + ?) / (use_count + 1)
      WHERE plugin_id = ?
    `);

    try {
      stmt.run(Date.now(), success ? 0 : 1, executionTime, executionTime, pluginId);
    } catch (error) {
      logger.error('Failed to update usage stats:', error);
    }
  }

  /**
   * Get plugin usage statistics
   */
  async getUsageStats(pluginId: string): Promise<PluginUsageStats | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM plugin_usage WHERE plugin_id = ?
    `);

    try {
      const row = stmt.get(pluginId) as {
        plugin_id: string;
        use_count: number;
        last_used: number;
        error_count: number;
        total_execution_time: number;
      } | undefined;
      if (!row) return null;

      return {
        pluginId: row.plugin_id,
        useCount: row.use_count,
        lastUsed: row.last_used,
        errorCount: row.error_count,
        totalExecutionTime: row.total_execution_time,
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      return null;
    }
  }

  /**
   * Log plugin error
   */
  async logPluginError(pluginId: string, error: Error): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO plugin_errors (plugin_id, error_message, error_stack, occurred_at)
      VALUES (?, ?, ?, ?)
    `);

    try {
      stmt.run(pluginId, error.message, error.stack, Date.now());

      // Clean up old errors (keep only last 100 per plugin)
      this.cleanupOldErrors(pluginId);
    } catch (err) {
      logger.error('Failed to log plugin error:', err);
    }
  }

  /**
   * Clean up old error logs
   */
  private cleanupOldErrors(pluginId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM plugin_errors
      WHERE plugin_id = ?
      AND id NOT IN (
        SELECT id FROM plugin_errors
        WHERE plugin_id = ?
        ORDER BY occurred_at DESC
        LIMIT 100
      )
    `);

    try {
      stmt.run(pluginId, pluginId);
    } catch (error) {
      logger.error('Failed to cleanup old errors:', error);
    }
  }

  /**
   * Get recent errors for a plugin
   */
  async getRecentErrors(pluginId: string, limit = 10): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM plugin_errors
      WHERE plugin_id = ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `);

    try {
      return stmt.all(pluginId, limit);
    } catch (error) {
      logger.error('Failed to get recent errors:', error);
      return [];
    }
  }

  /**
   * Get overall plugin statistics
   */
  async getOverallStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const totalPlugins = this.db.prepare('SELECT COUNT(*) as count FROM installed_plugins').get() as { count: number };
      const activePlugins = this.db
        .prepare('SELECT COUNT(*) as count FROM installed_plugins WHERE is_active = 1')
        .get() as { count: number };
      const totalUsage = this.db.prepare('SELECT SUM(use_count) as total FROM plugin_usage').get() as { total: number | null };
      const totalErrors = this.db
        .prepare('SELECT SUM(error_count) as total FROM plugin_usage')
        .get() as { total: number | null };

      return {
        totalPlugins: totalPlugins.count,
        activePlugins: activePlugins.count,
        totalUsage: totalUsage.total || 0,
        totalErrors: totalErrors.total || 0,
      };
    } catch (error) {
      logger.error('Failed to get overall stats:', error);
      return {
        totalPlugins: 0,
        activePlugins: 0,
        totalUsage: 0,
        totalErrors: 0,
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const pluginStorage = new PluginStorageManager();
