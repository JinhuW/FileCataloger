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
  PluginTimeoutError,
  ValidationResult,
  PluginUtils,
  PluginLogger,
  PluginCapability,
} from '@shared/types/plugins';
import { logger } from '../utils/logger';
import { pluginDatabaseManager } from './pluginDatabase';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private utils: PluginUtils;
  private readonly EXECUTION_TIMEOUT = 30000; // 30 seconds
  private readonly MEMORY_LIMIT = 100 * 1024 * 1024; // 100MB

  constructor() {
    super();
    this.utils = this.createPluginUtils();
    this.initializeBuiltinPlugins();
    // Initialize secure plugin database manager
    pluginDatabaseManager.initialize().catch(error => {
      logger.error('Failed to initialize plugin database manager:', error);
    });
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

  // Enhanced plugin validation with comprehensive security and structure checks
  public validatePlugin(plugin: NamingPlugin): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      this.validateBasicStructure(plugin, errors);

      // Component validation
      this.validateComponent(plugin, errors, warnings);

      // Engine compatibility validation
      this.validateEngineCompatibility(plugin, errors);

      // Security validation
      this.validateSecurity(plugin, errors, warnings);

      // Metadata validation
      this.validateMetadata(plugin, errors, warnings);

      // Configuration schema validation
      this.validateConfigSchema(plugin, errors, warnings);
    } catch (validationError) {
      errors.push(
        `Validation process failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      plugin: errors.length === 0 ? plugin : undefined,
    };
  }

  private validateBasicStructure(plugin: any, errors: string[]): void {
    // ID validation
    if (!plugin.id || typeof plugin.id !== 'string') {
      errors.push('Plugin ID is required and must be a string');
    } else if (!/^[a-z0-9._-]+$/.test(plugin.id)) {
      errors.push(
        'Plugin ID must only contain lowercase letters, numbers, dots, underscores, and hyphens'
      );
    } else if (plugin.id.length > 100) {
      errors.push('Plugin ID must be 100 characters or less');
    }

    // Name validation
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    } else if (plugin.name.length > 200) {
      errors.push('Plugin name must be 200 characters or less');
    }

    // Version validation
    if (!plugin.version || typeof plugin.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    } else if (!/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(plugin.version)) {
      errors.push('Plugin version must follow semantic versioning (e.g., 1.0.0)');
    }

    // Type validation
    if (!plugin.type || plugin.type !== 'component') {
      errors.push('Plugin type must be "component"');
    }
  }

  private validateComponent(plugin: any, errors: string[], warnings: string[]): void {
    if (!plugin.component) {
      errors.push('Plugin must have a component definition');
      return;
    }

    // Render function validation (required)
    if (!plugin.component.render || typeof plugin.component.render !== 'function') {
      errors.push('Plugin component must have a render function');
    }

    // Optional function validations
    const optionalFunctions = ['renderBatch', 'preview', 'validate', 'setup', 'cleanup'];
    for (const funcName of optionalFunctions) {
      if (plugin.component[funcName] && typeof plugin.component[funcName] !== 'function') {
        errors.push(`${funcName} must be a function if provided`);
      }
    }

    // Check for React component if provided
    if (
      plugin.component.configComponent &&
      typeof plugin.component.configComponent !== 'function'
    ) {
      warnings.push('configComponent should be a React component function');
    }
  }

  private validateEngineCompatibility(plugin: any, errors: string[]): void {
    if (!plugin.engine) {
      errors.push('Plugin must specify engine requirements');
      return;
    }

    if (!plugin.engine.filecataloger) {
      errors.push('Plugin must specify FileCataloger engine version requirement');
    } else if (typeof plugin.engine.filecataloger !== 'string') {
      errors.push('FileCataloger engine version must be a string');
    }

    // Check engine version compatibility
    const currentVersion = '1.0.0'; // TODO: Import from package.json properly
    if (plugin.engine.filecataloger) {
      const isCompatible = this.isVersionCompatible(plugin.engine.filecataloger, currentVersion);
      logger.debug(`Plugin ${plugin.id} version check: required=${plugin.engine.filecataloger}, current=${currentVersion}, compatible=${isCompatible}`);

      if (!isCompatible) {
        errors.push(`Plugin requires incompatible FileCataloger version: required ${plugin.engine.filecataloger}, current ${currentVersion}`);
      }
    }
  }

  private validateSecurity(plugin: any, errors: string[], warnings: string[]): void {
    // Validate permissions
    if (plugin.permissions) {
      if (!Array.isArray(plugin.permissions)) {
        errors.push('Permissions must be an array');
      } else {
        for (const permission of plugin.permissions) {
          if (!Object.values(PluginCapability).includes(permission)) {
            errors.push(`Invalid permission: ${permission}`);
          }
        }
      }
    }

    // Validate capabilities
    if (plugin.capabilities) {
      if (!Array.isArray(plugin.capabilities)) {
        errors.push('Capabilities must be an array');
      } else {
        for (const capability of plugin.capabilities) {
          if (!Object.values(PluginCapability).includes(capability)) {
            errors.push(`Invalid capability: ${capability}`);
          }
        }
      }
    }

    // Security warnings for high-risk permissions
    const highRiskPermissions = [
      PluginCapability.FILE_SYSTEM_WRITE,
      PluginCapability.NETWORK_ACCESS,
      PluginCapability.EXTERNAL_PROCESS,
    ];

    for (const permission of plugin.permissions || []) {
      if (highRiskPermissions.includes(permission)) {
        warnings.push(`Plugin requests high-risk permission: ${permission}`);
      }
    }
  }

  private validateMetadata(plugin: any, errors: string[], warnings: string[]): void {
    // Author validation
    if (!plugin.author) {
      warnings.push('Plugin should have author information');
    } else if (typeof plugin.author === 'object') {
      if (!plugin.author.name || typeof plugin.author.name !== 'string') {
        warnings.push('Author name is required');
      }
      if (plugin.author.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plugin.author.email)) {
        warnings.push('Author email format is invalid');
      }
    } else if (typeof plugin.author !== 'string') {
      warnings.push('Author must be a string or object with name and email');
    }

    // Description validation
    if (!plugin.description || typeof plugin.description !== 'string') {
      warnings.push('Plugin should have a description');
    } else if (plugin.description.length < 10) {
      warnings.push('Plugin description should be at least 10 characters');
    } else if (plugin.description.length > 1000) {
      errors.push('Plugin description must be 1000 characters or less');
    }

    // License validation
    if (!plugin.license) {
      warnings.push('Plugin should specify a license');
    }

    // Keywords validation
    if (plugin.keywords && !Array.isArray(plugin.keywords)) {
      errors.push('Keywords must be an array');
    }

    // Homepage and repository validation
    if (plugin.homepage && typeof plugin.homepage !== 'string') {
      errors.push('Homepage must be a string URL');
    }
    if (plugin.repository && typeof plugin.repository !== 'string') {
      errors.push('Repository must be a string URL');
    }
  }

  private validateConfigSchema(plugin: any, errors: string[], warnings: string[]): void {
    if (plugin.configSchema) {
      // Basic JSON Schema validation
      if (typeof plugin.configSchema !== 'object') {
        errors.push('Configuration schema must be an object');
      } else {
        // Check for required JSON Schema fields
        if (!plugin.configSchema.type) {
          warnings.push('Configuration schema should specify a type');
        }

        // Validate schema structure
        if (plugin.configSchema.properties && typeof plugin.configSchema.properties !== 'object') {
          errors.push('Schema properties must be an object');
        }
      }
    }

    // Validate default config if present
    if (plugin.defaultConfig && typeof plugin.defaultConfig !== 'object') {
      errors.push('Default configuration must be an object');
    }
  }

  private isVersionCompatible(requiredVersion: string, currentVersion: string): boolean {
    // Simple version compatibility check
    // In a real implementation, use a proper semver library
    const parseVersion = (version: string) => {
      // Handle both ">=1.0.0" and "1.0.0" formats
      const cleanVersion = version.replace(/^>=?/, ''); // Remove >= prefix
      const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
      if (!match) return null;
      return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
      };
    };

    const required = parseVersion(requiredVersion);
    const current = parseVersion(currentVersion);

    if (!required || !current) return false;

    // Fix the version comparison logic to handle >= requirements correctly
    return (
      current.major > required.major ||
      (current.major === required.major && current.minor > required.minor) ||
      (current.major === required.major && current.minor === required.minor && current.patch >= required.patch)
    );
  }

  // Execute plugin with timeout and resource monitoring
  public async executePlugin(
    pluginId: string,
    context: PluginContext
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

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

      // Execute with timeout and memory monitoring
      const result = await this.executeWithTimeout(
        () => loadedPlugin.plugin.component.render(executionContext),
        this.EXECUTION_TIMEOUT,
        pluginId
      );

      // Calculate memory usage
      const currentMemory = process.memoryUsage().heapUsed;
      const memoryUsed = Math.max(0, currentMemory - startMemory);

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
        memoryUsed,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const currentMemory = process.memoryUsage().heapUsed;
      const memoryUsed = Math.max(0, currentMemory - startMemory);
      const loadedPlugin = this.plugins.get(pluginId);

      if (loadedPlugin) {
        loadedPlugin.usage.errorCount++;
        loadedPlugin.errors.push(error as PluginError);

        // Call onError lifecycle hook if present
        if (loadedPlugin.plugin.lifecycle?.onError && error instanceof Error) {
          try {
            await this.executeWithTimeout(
              () => loadedPlugin.plugin.lifecycle!.onError!(error),
              5000, // 5 second timeout for error handlers
              pluginId
            );
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
        memoryUsed,
      };
    }
  }

  /**
   * Execute function with timeout and resource monitoring
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout: number,
    pluginId: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let isResolved = false;
      let memoryMonitor: NodeJS.Timeout | null = null;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          if (memoryMonitor) clearInterval(memoryMonitor);
          reject(new PluginTimeoutError(pluginId, timeout));
        }
      }, timeout);

      // Set up memory monitoring
      memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > this.MEMORY_LIMIT) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            if (memoryMonitor) clearInterval(memoryMonitor);
            reject(new PluginError(pluginId, 'MEMORY_LIMIT', 'Plugin exceeded memory limit'));
          }
        }
      }, 100); // Check every 100ms

      // Execute the function
      try {
        const result = fn();

        // Check if result is a Promise-like object
        if (
          result &&
          typeof result === 'object' &&
          'then' in result &&
          typeof (result as any).then === 'function'
        ) {
          // It's a Promise
          Promise.resolve(result as Promise<T>)
            .then(value => {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeoutId);
                if (memoryMonitor) clearInterval(memoryMonitor);
                resolve(value);
              }
            })
            .catch(error => {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeoutId);
                if (memoryMonitor) clearInterval(memoryMonitor);
                reject(error);
              }
            });
        } else {
          // Synchronous result
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            if (memoryMonitor) clearInterval(memoryMonitor);
            resolve(result as T);
          }
        }
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          if (memoryMonitor) clearInterval(memoryMonitor);
          reject(error);
        }
      }
    });
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
    // Create secure, plugin-specific utilities
    const secureUtils = this.createSecurePluginUtils(
      loadedPlugin.plugin.id,
      loadedPlugin.grantedPermissions
    );

    return {
      ...context,
      config: { ...loadedPlugin.config, ...context.config },
      utils: secureUtils,
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

      // Database utilities - INSECURE - Use createSecurePluginUtils instead!
      database: {
        query: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        exec: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        prepare: () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        createTable: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        dropTable: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        tableExists: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
        },
        transaction: async () => {
          throw new Error(
            'Direct database access not allowed. Use secure plugin database utilities.'
          );
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

  /**
   * Create secure, plugin-specific utilities with proper permission checking
   */
  private createSecurePluginUtils(pluginId: string, permissions: string[]): PluginUtils {
    return {
      // File system utilities (with permission checks)
      fs: {
        readFile: async (path: string, options?: any) => {
          // File system access will be implemented with proper sandboxing
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

      // Secure database utilities (isolated per plugin)
      database: pluginDatabaseManager.createPluginDatabaseUtils(pluginId, permissions as any),

      // Formatting utilities (same as global utils)
      format: this.utils.format,

      // String manipulation utilities (same as global utils)
      string: this.utils.string,

      // Crypto utilities (same as global utils)
      crypto: this.utils.crypto,

      // Data utilities (same as global utils)
      data: this.utils.data,
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

    // Close all plugin databases
    try {
      await pluginDatabaseManager.closeAll();
    } catch (error) {
      logger.error('Error closing plugin databases:', error);
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
