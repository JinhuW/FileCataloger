import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { logger } from '../utils/logger';
import { PluginCapability, TableSchema } from '@shared/types/plugins';

/**
 * Secure Plugin Database Manager
 *
 * Provides isolated database access for plugins with proper permission checking
 * and SQL injection protection. Each plugin gets its own database namespace.
 */
export class PluginDatabaseManager {
  private pluginDatabases = new Map<string, Database.Database>();
  private initialized = false;
  private pluginDbDir: string;

  constructor() {
    this.pluginDbDir = path.join(app.getPath('userData'), 'plugin-databases');
  }

  /**
   * Initialize plugin database system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const fs = await import('fs-extra');
      await fs.ensureDir(this.pluginDbDir);
      this.initialized = true;
      logger.info('Plugin database manager initialized');
    } catch (error) {
      logger.error('Failed to initialize plugin database manager:', error);
      throw error;
    }
  }

  /**
   * Get or create isolated database for a plugin
   */
  private async getPluginDatabase(pluginId: string): Promise<Database.Database> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.pluginDatabases.has(pluginId)) {
      return this.pluginDatabases.get(pluginId)!;
    }

    // Create isolated database for this plugin
    const dbPath = path.join(this.pluginDbDir, `${pluginId}.db`);
    const db = new Database(dbPath, {
      verbose: (message?: unknown) => {
        logger.debug(`[Plugin DB:${pluginId}]`, String(message));
      },
    });

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Set security pragmas
    db.pragma('foreign_keys = ON');
    db.pragma('secure_delete = ON');

    this.pluginDatabases.set(pluginId, db);
    logger.info(`Created isolated database for plugin: ${pluginId}`);

    return db;
  }

  /**
   * Create secure database utilities for a plugin
   */
  createPluginDatabaseUtils(pluginId: string, permissions: PluginCapability[]) {
    // Check if plugin has database access permission
    if (!permissions.includes(PluginCapability.DATABASE_ACCESS)) {
      throw new Error(`Plugin ${pluginId} does not have database access permission`);
    }

    const utils = {
      // Execute raw SQL queries with parameter binding (prevents SQL injection)
      query: async (sql: string, params?: any[]): Promise<any[]> => {
        const db = await this.getPluginDatabase(pluginId);

        try {
          // Validate SQL is a SELECT statement for security
          const trimmedSql = sql.trim().toUpperCase();
          if (!trimmedSql.startsWith('SELECT')) {
            throw new Error('Only SELECT queries are allowed in query() method');
          }

          const stmt = db.prepare(sql);
          return stmt.all(params || []);
        } catch (error) {
          logger.error(`Plugin ${pluginId} database query failed:`, error);
          throw error;
        }
      },

      // Execute SQL without returning results (INSERT, UPDATE, DELETE)
      exec: async (sql: string): Promise<void> => {
        const db = await this.getPluginDatabase(pluginId);

        try {
          // Validate SQL is not a SELECT statement
          const trimmedSql = sql.trim().toUpperCase();
          if (trimmedSql.startsWith('SELECT')) {
            throw new Error('Use query() method for SELECT statements');
          }

          db.exec(sql);
        } catch (error) {
          logger.error(`Plugin ${pluginId} database exec failed:`, error);
          throw error;
        }
      },

      // Prepared statements for performance and security
      prepare: (sql: string) => ({
        run: async (params?: any[]) => {
          const db = await this.getPluginDatabase(pluginId);

          try {
            const stmt = db.prepare(sql);
            const result = stmt.run(params || []);
            return {
              changes: result.changes,
              lastInsertRowid: Number(result.lastInsertRowid),
            };
          } catch (error) {
            logger.error(`Plugin ${pluginId} prepared statement run failed:`, error);
            throw error;
          }
        },

        get: async (params?: any[]) => {
          const db = await this.getPluginDatabase(pluginId);

          try {
            const stmt = db.prepare(sql);
            return stmt.get(params || []);
          } catch (error) {
            logger.error(`Plugin ${pluginId} prepared statement get failed:`, error);
            throw error;
          }
        },

        all: async (params?: any[]) => {
          const db = await this.getPluginDatabase(pluginId);

          try {
            const stmt = db.prepare(sql);
            return stmt.all(params || []);
          } catch (error) {
            logger.error(`Plugin ${pluginId} prepared statement all failed:`, error);
            throw error;
          }
        },
      }),

      // Table management with validation
      createTable: async (tableName: string, schema: TableSchema): Promise<void> => {
        // Validate table name (alphanumeric + underscore only)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          throw new Error('Invalid table name. Use only letters, numbers, and underscores.');
        }

        // Add plugin prefix to prevent conflicts
        const prefixedTableName = `plugin_${pluginId}_${tableName}`;

        const db = await this.getPluginDatabase(pluginId);

        try {
          const columns = Object.entries(schema).map(([name, def]) => {
            // Validate column name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
              throw new Error(`Invalid column name: ${name}`);
            }

            let column = `${name} ${def.type}`;
            if (def.primaryKey) column += ' PRIMARY KEY';
            if (def.autoIncrement) column += ' AUTOINCREMENT';
            if (def.notNull) column += ' NOT NULL';
            if (def.unique) column += ' UNIQUE';
            if (def.default !== undefined) {
              // Safely handle default values
              if (typeof def.default === 'string') {
                column += ` DEFAULT '${def.default.replace(/'/g, "''")}'`;
              } else {
                column += ` DEFAULT ${def.default}`;
              }
            }

            if (def.foreignKey) {
              const fkTable = `plugin_${pluginId}_${def.foreignKey.table}`;
              column += ` REFERENCES ${fkTable}(${def.foreignKey.column})`;
              if (def.foreignKey.onDelete) {
                column += ` ON DELETE ${def.foreignKey.onDelete}`;
              }
              if (def.foreignKey.onUpdate) {
                column += ` ON UPDATE ${def.foreignKey.onUpdate}`;
              }
            }

            return column;
          });

          const sql = `CREATE TABLE IF NOT EXISTS ${prefixedTableName} (${columns.join(', ')})`;
          db.exec(sql);

          logger.info(`Plugin ${pluginId} created table: ${prefixedTableName}`);
        } catch (error) {
          logger.error(`Plugin ${pluginId} failed to create table ${tableName}:`, error);
          throw error;
        }
      },

      dropTable: async (tableName: string): Promise<void> => {
        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          throw new Error('Invalid table name');
        }

        const prefixedTableName = `plugin_${pluginId}_${tableName}`;
        const db = await this.getPluginDatabase(pluginId);

        try {
          db.exec(`DROP TABLE IF EXISTS ${prefixedTableName}`);
          logger.info(`Plugin ${pluginId} dropped table: ${prefixedTableName}`);
        } catch (error) {
          logger.error(`Plugin ${pluginId} failed to drop table ${tableName}:`, error);
          throw error;
        }
      },

      tableExists: async (tableName: string): Promise<boolean> => {
        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          throw new Error('Invalid table name');
        }

        const prefixedTableName = `plugin_${pluginId}_${tableName}`;
        const db = await this.getPluginDatabase(pluginId);

        try {
          const result = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
            .get(prefixedTableName);
          return !!result;
        } catch (error) {
          logger.error(`Plugin ${pluginId} failed to check table existence:`, error);
          return false;
        }
      },

      transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
        const db = await this.getPluginDatabase(pluginId);

        try {
          const transaction = db.transaction(callback);
          return transaction();
        } catch (error) {
          logger.error(`Plugin ${pluginId} transaction failed:`, error);
          throw error;
        }
      },
    };

    return utils;
  }

  /**
   * Close all plugin databases
   */
  async closeAll(): Promise<void> {
    for (const [pluginId, db] of this.pluginDatabases) {
      try {
        db.close();
        logger.info(`Closed database for plugin: ${pluginId}`);
      } catch (error) {
        logger.error(`Failed to close database for plugin ${pluginId}:`, error);
      }
    }
    this.pluginDatabases.clear();
    this.initialized = false;
  }

  /**
   * Close database for specific plugin
   */
  async closePluginDatabase(pluginId: string): Promise<void> {
    const db = this.pluginDatabases.get(pluginId);
    if (db) {
      try {
        db.close();
        this.pluginDatabases.delete(pluginId);
        logger.info(`Closed database for plugin: ${pluginId}`);
      } catch (error) {
        logger.error(`Failed to close database for plugin ${pluginId}:`, error);
      }
    }
  }

  /**
   * Get database statistics for monitoring
   */
  async getStatistics(): Promise<{
    totalPluginDatabases: number;
    pluginIds: string[];
    totalSize: number;
  }> {
    const fs = await import('fs-extra');
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.pluginDbDir);
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(this.pluginDbDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.error('Failed to calculate database statistics:', error);
    }

    return {
      totalPluginDatabases: this.pluginDatabases.size,
      pluginIds: Array.from(this.pluginDatabases.keys()),
      totalSize,
    };
  }
}

// Export singleton instance
export const pluginDatabaseManager = new PluginDatabaseManager();
