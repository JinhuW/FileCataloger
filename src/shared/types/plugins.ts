import { JSONSchema7 } from 'json-schema';

// Core plugin function types with full TypeScript support
export type PluginRenderFunction = (context: PluginContext) => Promise<string> | string;
export type PluginRenderBatchFunction = (contexts: PluginContext[]) => Promise<string[]> | string[];
export type PluginPreviewFunction = (config: Record<string, any>, utils: PluginUtils) => string;
export type PluginValidateFunction = (config: Record<string, any>) => PluginValidationResult;
export type PluginSetupFunction = (config: Record<string, any>) => Promise<void> | void;
export type PluginCleanupFunction = (config: Record<string, any>) => Promise<void> | void;

// Plugin validation result
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Database schema definition for plugin table creation
export interface TableSchema {
  [columnName: string]: {
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NUMERIC';
    primaryKey?: boolean;
    autoIncrement?: boolean;
    notNull?: boolean;
    unique?: boolean;
    default?: any;
    foreignKey?: {
      table: string;
      column: string;
      onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
      onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    };
  };
}

// Plugin Author Information
export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

// Plugin Engine Requirements
export interface PluginEngine {
  filecataloger: string; // ">=2.0.0"
  node?: string; // ">=16.0.0"
  electron?: string; // ">=28.0.0"
}

// Plugin Capabilities (permissions system)
export enum PluginCapability {
  FILE_SYSTEM_READ = 'file_system_read',
  FILE_SYSTEM_WRITE = 'file_system_write',
  NETWORK_ACCESS = 'network_access',
  DATABASE_ACCESS = 'database_access',
  EXTERNAL_PROCESS = 'external_process',
  SYSTEM_INFO = 'system_info',
  CLIPBOARD = 'clipboard',
  NOTIFICATIONS = 'notifications',
  STORAGE_ACCESS = 'storage_access',
}

export type PluginPermission = PluginCapability;

// Plugin Dependencies
export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

// Component Definition with TypeScript functions (NOT strings)
export interface ComponentDefinition {
  // Main render function - proper TypeScript function
  render: PluginRenderFunction;

  // Optional batch processing function
  renderBatch?: PluginRenderBatchFunction;

  // Component UI configuration function
  configComponent?: React.ComponentType<any>;

  // Preview function for UI
  preview?: PluginPreviewFunction;

  // Validation function
  validate?: PluginValidateFunction;

  // Setup function (called when component is added to pattern)
  setup?: PluginSetupFunction;

  // Cleanup function (called when component is removed)
  cleanup?: PluginCleanupFunction;
}

// Plugin Lifecycle Hooks with TypeScript functions
export interface PluginLifecycle {
  onInstall?: () => Promise<void> | void;
  onUninstall?: () => Promise<void> | void;
  onActivate?: () => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
  onUpdate?: (oldVersion: string, newVersion: string) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
}

// Main Plugin Interface with TypeScript functions
export interface NamingPlugin {
  // Metadata
  id: string;
  name: string;
  version: string;
  author: PluginAuthor;
  description: string;
  icon?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];

  // Technical details
  type: 'component';
  engine: PluginEngine;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  dependencies?: PluginDependency[];

  // Component specific - using TypeScript functions
  component: ComponentDefinition;

  // Lifecycle hooks - using TypeScript functions
  lifecycle?: PluginLifecycle;

  // Configuration
  configSchema?: JSONSchema7;
  defaultConfig?: Record<string, any>;

  // Plugin metadata
  category?: string;
  tags?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
  deprecated?: boolean;
  experimental?: boolean;
}

// Plugin Context (execution environment) - same as before
export interface PluginFileInfo {
  path: string;
  name: string;
  nameWithoutExtension: string;
  extension: string;
  size: number;
  type: string;
  created: number; // timestamp
  modified: number;
  accessed: number;
  isDirectory: boolean;
  isHidden: boolean;
  metadata?: Record<string, any>;
}

export interface PluginRuntime {
  index: number;
  total: number;
  timestamp: number;
  locale: string;
  platform: NodeJS.Platform;
  isDarkMode: boolean;
  appVersion: string;
  pluginVersion: string;
}

export interface PluginEventEmitter {
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void;
}

export interface PluginStorage {
  // Local storage (per-plugin, not synced)
  local: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    keys: () => Promise<string[]>;
    size: () => Promise<number>;
  };

  // User storage (synced across devices if available)
  user: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    keys: () => Promise<string[]>;
  };

  // Session storage (cleared on app restart)
  session: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    delete: (key: string) => void;
    clear: () => void;
  };
}

export interface PluginUtils {
  // File system utilities (restricted based on permissions)
  fs: {
    readFile: (path: string) => Promise<Buffer>;
    exists: (path: string) => Promise<boolean>;
    getStats: (path: string) => Promise<any>;
    readDir: (path: string) => Promise<string[]>;
  };

  // Database utilities (when DATABASE_ACCESS permission granted)
  database: {
    // Execute raw SQL queries
    query: (sql: string, params?: any[]) => Promise<any[]>;

    // Execute SQL without returning results
    exec: (sql: string) => Promise<void>;

    // Prepared statements for performance
    prepare: (sql: string) => {
      run: (params?: any[]) => Promise<{ changes: number; lastInsertRowid: number }>;
      get: (params?: any[]) => Promise<any>;
      all: (params?: any[]) => Promise<any[]>;
    };

    // Table management
    createTable: (tableName: string, schema: TableSchema) => Promise<void>;
    dropTable: (tableName: string) => Promise<void>;
    tableExists: (tableName: string) => Promise<boolean>;

    // Transaction support
    transaction: <T>(callback: () => Promise<T>) => Promise<T>;
  };

  // Formatting utilities
  format: {
    date: (date: Date | number, format: string) => string;
    number: (num: number, format: string) => string;
    bytes: (bytes: number, precision?: number) => string;
    duration: (ms: number, format?: string) => string;
    currency: (amount: number, currency: string) => string;
  };

  // String manipulation
  string: {
    slugify: (text: string) => string;
    camelCase: (text: string) => string;
    pascalCase: (text: string) => string;
    kebabCase: (text: string) => string;
    snakeCase: (text: string) => string;
    titleCase: (text: string) => string;
    truncate: (text: string, length: number) => string;
    padStart: (text: string, length: number, char?: string) => string;
    padEnd: (text: string, length: number, char?: string) => string;
  };

  // Crypto utilities
  crypto: {
    md5: (data: string | Buffer) => string;
    sha1: (data: string | Buffer) => string;
    sha256: (data: string | Buffer) => string;
    uuid: () => string;
    randomString: (length: number, charset?: string) => string;
  };

  // Data utilities
  data: {
    parse: {
      json: (text: string) => any;
      yaml: (text: string) => any;
      csv: (text: string) => any[];
      xml: (text: string) => any;
    };
    stringify: {
      json: (data: any, pretty?: boolean) => string;
      yaml: (data: any) => string;
      csv: (data: any[]) => string;
      xml: (data: any) => string;
    };
  };
}

export interface PluginContext {
  // Current file information
  file: PluginFileInfo;

  // User configuration for this instance
  config: Record<string, any>;

  // Utility functions
  utils: PluginUtils;

  // Runtime information
  runtime: PluginRuntime;

  // Storage access
  storage: PluginStorage;

  // Event system
  events: PluginEventEmitter;

  // Logger
  logger: PluginLogger;
}

// Plugin Manager Types (updated for function-based approach)
export interface LoadedPlugin {
  plugin: NamingPlugin;
  path: string;
  isActive: boolean;
  isLoaded: boolean;
  loadTime: number;
  config: Record<string, any>;
  grantedPermissions: PluginPermission[];
  errors: PluginError[];
  usage: {
    executions: number;
    lastUsed: number;
    totalTime: number;
    errorCount: number;
  };
  isExternal?: boolean; // True for npm-installed plugins, false/undefined for built-in
}

// Plugin Execution
export interface PluginExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  memoryUsed: number;
}

// Plugin Errors (same as before)
export class PluginError extends Error {
  constructor(
    public pluginId: string,
    public code: string,
    message: string,
    public details?: any,
    public timestamp: number = Date.now()
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class PluginLoadError extends PluginError {
  constructor(pluginId: string, message: string, details?: any) {
    super(pluginId, 'LOAD_ERROR', message, details);
    this.name = 'PluginLoadError';
  }
}

export class PluginExecutionError extends PluginError {
  constructor(pluginId: string, message: string, details?: any) {
    super(pluginId, 'EXECUTION_ERROR', message, details);
    this.name = 'PluginExecutionError';
  }
}

export class PluginPermissionError extends PluginError {
  constructor(pluginId: string, permission: string, details?: any) {
    super(pluginId, 'PERMISSION_ERROR', `Permission denied: ${permission}`, details);
    this.name = 'PluginPermissionError';
  }
}

export class PluginValidationError extends PluginError {
  constructor(pluginId: string, message: string, details?: any) {
    super(pluginId, 'VALIDATION_ERROR', message, details);
    this.name = 'PluginValidationError';
  }
}

export class PluginTimeoutError extends PluginError {
  constructor(pluginId: string, timeout: number, details?: any) {
    super(pluginId, 'TIMEOUT_ERROR', `Plugin execution timed out after ${timeout}ms`, details);
    this.name = 'PluginTimeoutError';
  }
}

// Validation Result Interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  plugin?: NamingPlugin;
}
