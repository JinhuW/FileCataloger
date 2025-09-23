import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import {
  NamingPlugin,
  LoadedPlugin,
  PluginContext,
  PluginExecutionResult,
  PluginFileInfo,
  PluginRuntime,
  PluginError,
  PluginValidationError,
  ValidationResult,
  PluginUtils,
  PluginLogger,
  TableSchema,
} from '@shared/types/plugins';
import { logger } from '../utils/logger';
import { patternPersistenceManager } from '../storage/patternPersistenceManager';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private utils: PluginUtils;

  constructor() {
    super();
    this.utils = this.createPluginUtils();
    this.initializeBuiltinPlugins();
  }

  private async initializeBuiltinPlugins(): Promise<void> {
    try {
      // Register built-in plugins
      await this.registerBuiltinPlugins();
      logger.info('Built-in plugins V2 registered successfully');
    } catch (error) {
      logger.error('Failed to initialize built-in plugins V2:', error);
    }
  }

  private async registerBuiltinPlugins(): Promise<void> {
    const { builtinPlugins } = await import('./builtin');

    for (const plugin of builtinPlugins) {
      await this.registerPlugin(plugin);
    }
  }

  // Register a plugin with proper validation
  public async registerPlugin(plugin: NamingPlugin): Promise<void> {
    try {
      // Validate plugin structure
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        throw new PluginValidationError(
          plugin.id,
          `Plugin validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Create loaded plugin entry
      const loadedPlugin: LoadedPlugin = {
        plugin,
        path: '', // Built-in plugins don't have a file path
        isActive: true,
        isLoaded: true,
        loadTime: Date.now(),
        config: plugin.defaultConfig || {},
        grantedPermissions: plugin.permissions || [],
        errors: [],
        usage: {
          executions: 0,
          lastUsed: 0,
          totalTime: 0,
          errorCount: 0,
        },
      };

      this.plugins.set(plugin.id, loadedPlugin);
      this.emit('plugin-registered', plugin.id);

      // Call onActivate lifecycle hook if present
      if (plugin.lifecycle?.onActivate) {
        try {
          await plugin.lifecycle.onActivate();
        } catch (error) {
          logger.warn(`Plugin activation hook failed for ${plugin.id}:`, error);
        }
      }

      logger.debug(`Plugin registered: ${plugin.id}`);
    } catch (error) {
      logger.error(`Failed to register plugin ${plugin.id}:`, error);
      throw error;
    }
  }

  // Validate plugin structure and functions
  public validatePlugin(plugin: NamingPlugin): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!plugin.id || typeof plugin.id !== 'string') {
      errors.push('Plugin ID is required and must be a string');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    }

    if (!plugin.component || typeof plugin.component.render !== 'function') {
      errors.push('Plugin must have a component with render function');
    }

    // Validate function types
    if (plugin.component.render && typeof plugin.component.render !== 'function') {
      errors.push('Render function must be a proper function, not a string');
    }

    if (plugin.component.renderBatch && typeof plugin.component.renderBatch !== 'function') {
      errors.push('RenderBatch must be a proper function, not a string');
    }

    if (plugin.component.preview && typeof plugin.component.preview !== 'function') {
      errors.push('Preview must be a proper function, not a string');
    }

    if (plugin.component.validate && typeof plugin.component.validate !== 'function') {
      errors.push('Validate must be a proper function, not a string');
    }

    // Validate engine requirements
    if (!plugin.engine || !plugin.engine.filecataloger) {
      errors.push('Plugin must specify engine requirements');
    }

    // Validate author information
    if (!plugin.author || !plugin.author.name) {
      warnings.push('Plugin should have author information');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      plugin: errors.length === 0 ? plugin : undefined,
    };
  }

  // Execute plugin with proper function calling (NO string execution!)
  public async executePlugin(
    pluginId: string,
    context: PluginContext
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    try {
      const loadedPlugin = this.plugins.get(pluginId);
      if (!loadedPlugin) {
        throw new PluginError(pluginId, 'NOT_FOUND', 'Plugin not found');
      }

      if (!loadedPlugin.isActive) {
        throw new PluginError(pluginId, 'INACTIVE', 'Plugin is not active');
      }

      // Create execution context with utilities
      const executionContext = this.createExecutionContext(context, loadedPlugin);

      // Execute the render function DIRECTLY (no string execution!)
      const result = await loadedPlugin.plugin.component.render(executionContext);

      // Update usage statistics
      const executionTime = Date.now() - startTime;
      loadedPlugin.usage.executions++;
      loadedPlugin.usage.lastUsed = Date.now();
      loadedPlugin.usage.totalTime += executionTime;

      this.emit('plugin-executed', {
        pluginId,
        success: true,
        executionTime,
        result,
      });

      return {
        success: true,
        result,
        executionTime,
        memoryUsed: 0, // TODO: Implement memory tracking
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const loadedPlugin = this.plugins.get(pluginId);

      if (loadedPlugin) {
        loadedPlugin.usage.errorCount++;
        loadedPlugin.errors.push(error as PluginError);

        // Call onError lifecycle hook if present
        if (loadedPlugin.plugin.lifecycle?.onError && error instanceof Error) {
          try {
            await loadedPlugin.plugin.lifecycle.onError(error);
          } catch (lifecycleError) {
            logger.warn(`Plugin error hook failed for ${pluginId}:`, lifecycleError);
          }
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit('plugin-executed', {
        pluginId,
        success: false,
        executionTime,
        error: errorMessage,
      });

      logger.error(`Plugin execution failed for ${pluginId}:`, error);

      return {
        success: false,
        error: errorMessage,
        executionTime,
        memoryUsed: 0,
      };
    }
  }

  // Execute batch processing if supported
  public async executeBatchPlugin(
    pluginId: string,
    contexts: PluginContext[]
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    try {
      const loadedPlugin = this.plugins.get(pluginId);
      if (!loadedPlugin) {
        throw new PluginError(pluginId, 'NOT_FOUND', 'Plugin not found');
      }

      if (!loadedPlugin.plugin.component.renderBatch) {
        throw new PluginError(
          pluginId,
          'NO_BATCH_SUPPORT',
          'Plugin does not support batch processing'
        );
      }

      // Create execution contexts with utilities
      const executionContexts = contexts.map(context =>
        this.createExecutionContext(context, loadedPlugin)
      );

      // Execute the batch render function DIRECTLY
      const results = await loadedPlugin.plugin.component.renderBatch(executionContexts);

      const executionTime = Date.now() - startTime;
      loadedPlugin.usage.executions++;
      loadedPlugin.usage.lastUsed = Date.now();
      loadedPlugin.usage.totalTime += executionTime;

      return {
        success: true,
        result: results,
        executionTime,
        memoryUsed: 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Plugin batch execution failed for ${pluginId}:`, error);

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
      };
    }
  }

  // Create execution context with proper utilities
  private createExecutionContext(
    context: PluginContext,
    loadedPlugin: LoadedPlugin
  ): PluginContext {
    return {
      ...context,
      config: { ...loadedPlugin.config, ...context.config },
      utils: this.utils,
      logger: this.createPluginLogger(loadedPlugin.plugin.id),
    };
  }

  // Create plugin utilities (same as before but properly typed)
  private createPluginUtils(): PluginUtils {
    return {
      // File system utilities (restricted)
      fs: {
        readFile: async (path: string, options?: any) => {
          // TODO: Implement with permission checks
          const fs = await import('fs/promises');
          return fs.readFile(path, options);
        },
        exists: async (path: string) => {
          try {
            const fs = await import('fs/promises');
            await fs.access(path);
            return true;
          } catch {
            return false;
          }
        },
        getStats: async (path: string) => {
          const fs = await import('fs/promises');
          return fs.stat(path);
        },
        readDir: async (path: string) => {
          const fs = await import('fs/promises');
          return fs.readdir(path);
        },
      },

      // Database utilities (when DATABASE_ACCESS permission granted)
      database: {
        query: async (sql: string, params?: any[]) => {
          // TODO: Check permissions before allowing database access
          const db = patternPersistenceManager['db']; // Access private db
          if (!db) throw new Error('Database not available');
          return db.prepare(sql).all(params || []);
        },

        exec: async (sql: string) => {
          const db = patternPersistenceManager['db'];
          if (!db) throw new Error('Database not available');
          db.exec(sql);
        },

        prepare: (sql: string) => ({
          run: async (params?: any[]) => {
            const db = patternPersistenceManager['db'];
            if (!db) throw new Error('Database not available');
            const stmt = db.prepare(sql);
            const result = stmt.run(params || []);
            return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
          },
          get: async (params?: any[]) => {
            const db = patternPersistenceManager['db'];
            if (!db) throw new Error('Database not available');
            const stmt = db.prepare(sql);
            return stmt.get(params || []);
          },
          all: async (params?: any[]) => {
            const db = patternPersistenceManager['db'];
            if (!db) throw new Error('Database not available');
            const stmt = db.prepare(sql);
            return stmt.all(params || []);
          },
        }),

        createTable: async (tableName: string, schema: TableSchema) => {
          const db = patternPersistenceManager['db'];
          if (!db) throw new Error('Database not available');

          const columns = Object.entries(schema).map(([name, def]) => {
            let column = `${name} ${def.type}`;
            if (def.primaryKey) column += ' PRIMARY KEY';
            if (def.autoIncrement) column += ' AUTOINCREMENT';
            if (def.notNull) column += ' NOT NULL';
            if (def.unique) column += ' UNIQUE';
            if (def.default !== undefined) column += ` DEFAULT ${def.default}`;
            return column;
          });

          const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
          db.exec(sql);
        },

        dropTable: async (tableName: string) => {
          const db = patternPersistenceManager['db'];
          if (!db) throw new Error('Database not available');
          db.exec(`DROP TABLE IF EXISTS ${tableName}`);
        },

        tableExists: async (tableName: string) => {
          const db = patternPersistenceManager['db'];
          if (!db) return false;
          const result = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
            .get(tableName);
          return !!result;
        },

        transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
          const db = patternPersistenceManager['db'];
          if (!db) throw new Error('Database not available');

          const transaction = db.transaction(callback);
          return transaction();
        },
      },

      // Formatting utilities
      format: {
        date: (date: Date | number, format: string) => {
          const d = new Date(date);

          // Enhanced date formatting with more options
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hour = String(d.getHours()).padStart(2, '0');
          const minute = String(d.getMinutes()).padStart(2, '0');
          const second = String(d.getSeconds()).padStart(2, '0');

          return format
            .replace(/YYYY/g, String(year))
            .replace(/MM/g, month)
            .replace(/DD/g, day)
            .replace(/HH/g, hour)
            .replace(/mm/g, minute)
            .replace(/ss/g, second);
        },
        number: (num: number, _format: string) => {
          return num.toLocaleString();
        },
        bytes: (bytes: number, precision = 2) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let size = bytes;
          let unitIndex = 0;

          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }

          return `${size.toFixed(precision)} ${units[unitIndex]}`;
        },
        duration: (ms: number, _format?: string) => {
          const seconds = Math.floor(ms / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);

          if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
          } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
          } else {
            return `${seconds}s`;
          }
        },
        currency: (amount: number, currency: string) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
          }).format(amount);
        },
      },

      // String manipulation utilities
      string: {
        slugify: (text: string) => {
          return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        },
        camelCase: (text: string) => {
          return text.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
        },
        pascalCase: (text: string) => {
          const camel = text.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
          return camel.charAt(0).toUpperCase() + camel.slice(1);
        },
        kebabCase: (text: string) => {
          return text
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        },
        snakeCase: (text: string) => {
          return text
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
        },
        titleCase: (text: string) => {
          return text.replace(
            /\w\S*/g,
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        },
        truncate: (text: string, length: number) => {
          return text.length > length ? text.substring(0, length) + '...' : text;
        },
        padStart: (text: string, length: number, char = ' ') => {
          return text.padStart(length, char);
        },
        padEnd: (text: string, length: number, char = ' ') => {
          return text.padEnd(length, char);
        },
      },

      // Crypto utilities
      crypto: {
        md5: (data: string | Buffer) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const crypto = require('crypto');
          return crypto.createHash('md5').update(data).digest('hex');
        },
        sha1: (data: string | Buffer) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const crypto = require('crypto');
          return crypto.createHash('sha1').update(data).digest('hex');
        },
        sha256: (data: string | Buffer) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const crypto = require('crypto');
          return crypto.createHash('sha256').update(data).digest('hex');
        },
        uuid: () => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const crypto = require('crypto');
          return crypto.randomUUID();
        },
        randomString: (length: number, charset?: string) => {
          const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          const chars = charset || defaultCharset;
          let result = '';
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        },
      },

      // Data utilities (placeholder for future expansion)
      data: {
        parse: {
          json: (_text: string) => JSON.parse(_text),
          yaml: (_text: string) => {
            // TODO: Implement YAML parsing
            throw new Error('YAML parsing not yet implemented');
          },
          csv: (_text: string) => {
            // Simple CSV parsing
            return _text.split('\n').map(line => line.split(','));
          },
          xml: (_text: string) => {
            // TODO: Implement XML parsing
            throw new Error('XML parsing not yet implemented');
          },
        },
        stringify: {
          json: (_data: any, pretty = false) => JSON.stringify(_data, null, pretty ? 2 : 0),
          yaml: (_data: any) => {
            // TODO: Implement YAML stringification
            throw new Error('YAML stringification not yet implemented');
          },
          csv: (_data: any[]) => {
            return _data.map(row => row.join(',')).join('\n');
          },
          xml: (_data: any) => {
            // TODO: Implement XML stringification
            throw new Error('XML stringification not yet implemented');
          },
        },
      },
    };
  }

  // Create plugin logger with proper namespacing
  private createPluginLogger(pluginId: string): PluginLogger {
    return {
      debug: (message: string, ...args: any[]) => {
        logger.debug(`[Plugin:${pluginId}] ${message}`, ...args);
      },
      info: (message: string, ...args: any[]) => {
        logger.info(`[Plugin:${pluginId}] ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        logger.warn(`[Plugin:${pluginId}] ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        logger.error(`[Plugin:${pluginId}] ${message}`, ...args);
      },
      log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
        logger[level](`[Plugin:${pluginId}] ${message}`, ...args);
      },
    };
  }

  // Plugin query methods
  public getPlugin(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  public getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  public getActivePlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.isActive);
  }

  public isPluginLoaded(id: string): boolean {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.isLoaded : false;
  }

  public isPluginActive(id: string): boolean {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.isActive : false;
  }

  // Utility method to create file info from path (static for external access)
  public static async createFileInfo(filePath: string): Promise<PluginFileInfo> {
    const path = await import('path');
    const fs = await import('fs/promises');

    try {
      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);
      const extension = path.extname(filePath);
      const nameWithoutExtension = path.basename(filePath, extension);

      return {
        path: filePath,
        name,
        nameWithoutExtension,
        extension: extension.startsWith('.') ? extension.slice(1) : extension,
        size: stats.size,
        type: stats.isDirectory() ? 'directory' : 'file',
        created: stats.birthtime.getTime(),
        modified: stats.mtime.getTime(),
        accessed: stats.atime.getTime(),
        isDirectory: stats.isDirectory(),
        isHidden: name.startsWith('.'),
      };
    } catch (error) {
      // Return basic info if file doesn't exist or can't be accessed
      const name = path.basename(filePath);
      const extension = path.extname(filePath);

      return {
        path: filePath,
        name,
        nameWithoutExtension: path.basename(filePath, extension),
        extension: extension.startsWith('.') ? extension.slice(1) : extension,
        size: 0,
        type: 'file',
        created: Date.now(),
        modified: Date.now(),
        accessed: Date.now(),
        isDirectory: false,
        isHidden: name.startsWith('.'),
      };
    }
  }

  // Utility method to create plugin runtime context (static for external access)
  public static createRuntime(index: number = 0, total: number = 1): PluginRuntime {
    return {
      index,
      total,
      timestamp: Date.now(),
      locale: 'en-US',
      platform: process.platform,
      isDarkMode: false, // TODO: Get from system preferences
      appVersion: '2.0.0', // TODO: Get from package.json
      pluginVersion: '2.0.0',
    };
  }

  // Activate/deactivate plugins
  public async activatePlugin(id: string): Promise<void> {
    const loadedPlugin = this.plugins.get(id);
    if (!loadedPlugin) {
      throw new PluginError(id, 'NOT_FOUND', 'Plugin not found');
    }

    if (loadedPlugin.isActive) return;

    loadedPlugin.isActive = true;

    if (loadedPlugin.plugin.lifecycle?.onActivate) {
      await loadedPlugin.plugin.lifecycle.onActivate();
    }

    this.emit('plugin-activated', id);
  }

  public async deactivatePlugin(id: string): Promise<void> {
    const loadedPlugin = this.plugins.get(id);
    if (!loadedPlugin) {
      throw new PluginError(id, 'NOT_FOUND', 'Plugin not found');
    }

    if (!loadedPlugin.isActive) return;

    loadedPlugin.isActive = false;

    if (loadedPlugin.plugin.lifecycle?.onDeactivate) {
      await loadedPlugin.plugin.lifecycle.onDeactivate();
    }

    this.emit('plugin-deactivated', id);
  }

  // Clean shutdown
  public async close(): Promise<void> {
    for (const [id, loadedPlugin] of this.plugins) {
      try {
        if (loadedPlugin.plugin.component.cleanup) {
          await loadedPlugin.plugin.component.cleanup(loadedPlugin.config);
        }

        if (loadedPlugin.plugin.lifecycle?.onDeactivate) {
          await loadedPlugin.plugin.lifecycle.onDeactivate();
        }
      } catch (error) {
        logger.warn(`Error during plugin cleanup for ${id}:`, error);
      }
    }

    this.plugins.clear();
    this.removeAllListeners();
  }

  // ===== EXTERNAL PLUGIN SUPPORT =====

  /**
   * Load external plugin from file path
   */
  public async loadExternalPlugin(pluginPath: string): Promise<void> {
    try {
      logger.info(`Loading external plugin from: ${pluginPath}`);

      // Check if path exists
      if (!(await fs.pathExists(pluginPath))) {
        throw new Error(`Plugin path does not exist: ${pluginPath}`);
      }

      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(pluginPath)];

      // Dynamic import of plugin module
      const pluginModule = require(pluginPath);
      const plugin = pluginModule.default || pluginModule;

      // Validate plugin structure
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        throw new PluginValidationError(plugin.id, validation.errors.join(', '));
      }

      // Register the plugin
      await this.registerExternalPlugin(plugin, pluginPath);
      logger.info(`External plugin loaded successfully: ${plugin.id}`);
    } catch (error) {
      logger.error(`Failed to load external plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  /**
   * Register external plugin
   */
  private async registerExternalPlugin(plugin: NamingPlugin, pluginPath: string): Promise<void> {
    try {
      // Create loaded plugin entry
      const loadedPlugin: LoadedPlugin = {
        plugin,
        path: pluginPath,
        isActive: true,
        isLoaded: true,
        loadTime: Date.now(),
        config: plugin.defaultConfig || {},
        grantedPermissions: plugin.permissions || [],
        errors: [],
        usage: {
          executions: 0,
          lastUsed: 0,
          totalTime: 0,
          errorCount: 0,
        },
        isExternal: true, // Mark as external plugin
      };

      this.plugins.set(plugin.id, loadedPlugin);
      this.emit('plugin-registered', plugin.id);

      // Call onActivate lifecycle hook if present
      if (plugin.lifecycle?.onActivate) {
        try {
          await plugin.lifecycle.onActivate();
        } catch (error) {
          logger.warn(`Plugin activation hook failed for ${plugin.id}:`, error);
        }
      }

      logger.debug(`External plugin registered: ${plugin.id}`);
    } catch (error) {
      logger.error(`Failed to register external plugin ${plugin.id}:`, error);
      throw error;
    }
  }

  /**
   * Scan plugins directory for external plugins
   */
  public async scanPluginsDirectory(): Promise<void> {
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');

    try {
      // Ensure directory exists
      await fs.ensureDir(pluginsDir);

      // Read directory contents
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(pluginsDir, entry.name);

          // Look for package.json to find entry point
          const packageJsonPath = path.join(pluginPath, 'package.json');

          if (await fs.pathExists(packageJsonPath)) {
            try {
              const packageJson = await fs.readJson(packageJsonPath);

              // Check if it's a FileCataloger plugin
              if (packageJson.keywords?.includes('filecataloger-plugin')) {
                const mainFile = path.join(pluginPath, packageJson.main || 'index.js');

                if (await fs.pathExists(mainFile)) {
                  await this.loadExternalPlugin(mainFile);
                } else {
                  logger.warn(`Plugin main file not found: ${mainFile}`);
                }
              }
            } catch (error) {
              logger.error(`Failed to load plugin from ${pluginPath}:`, error);
            }
          }
        }
      }

      logger.info(
        `Plugin directory scan complete. Loaded ${this.getExternalPlugins().length} external plugins`
      );
    } catch (error) {
      logger.error('Failed to scan plugins directory:', error);
    }
  }

  /**
   * Get all external plugins
   */
  public getExternalPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.isExternal);
  }

  /**
   * Remove external plugin
   */
  public async removeExternalPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);

    if (!loadedPlugin) {
      throw new PluginError(pluginId, 'NOT_FOUND', 'Plugin not found');
    }

    if (!loadedPlugin.isExternal) {
      throw new PluginError(pluginId, 'NOT_EXTERNAL', 'Cannot remove built-in plugin');
    }

    // Call lifecycle hooks
    if (loadedPlugin.plugin.component.cleanup) {
      await loadedPlugin.plugin.component.cleanup(loadedPlugin.config);
    }

    if (loadedPlugin.plugin.lifecycle?.onDeactivate) {
      await loadedPlugin.plugin.lifecycle.onDeactivate();
    }

    if (loadedPlugin.plugin.lifecycle?.onUninstall) {
      await loadedPlugin.plugin.lifecycle.onUninstall();
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this.emit('plugin-removed', pluginId);

    logger.info(`External plugin removed: ${pluginId}`);
  }

  /**
   * Reload external plugin
   */
  public async reloadExternalPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);

    if (!loadedPlugin) {
      throw new PluginError(pluginId, 'NOT_FOUND', 'Plugin not found');
    }

    if (!loadedPlugin.isExternal || !loadedPlugin.path) {
      throw new PluginError(pluginId, 'NOT_EXTERNAL', 'Cannot reload built-in plugin');
    }

    const pluginPath = loadedPlugin.path;

    // Remove the plugin
    await this.removeExternalPlugin(pluginId);

    // Load it again
    await this.loadExternalPlugin(pluginPath);

    logger.info(`External plugin reloaded: ${pluginId}`);
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
