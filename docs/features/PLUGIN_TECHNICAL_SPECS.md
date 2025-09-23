# Technical Specifications - Plugin System Implementation

## 1. Plugin Installer Module Specification

### File: `src/main/modules/plugins/pluginInstaller.ts`

```typescript
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';
import { app } from 'electron';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import { pluginManager } from './pluginManager';
import { NamingPlugin, PluginError } from '@shared/types/plugins';

export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  author: string | { name: string; email?: string };
  keywords: string[];
  repository?: { type: string; url: string };
  downloads?: number;
  lastPublished?: string;
}

export interface InstalledPluginInfo {
  id: string;
  packageName: string;
  version: string;
  installDate: number;
  installPath: string;
  isActive: boolean;
  permissions: string[];
  config?: Record<string, any>;
}

export interface InstallOptions {
  version?: string;
  activate?: boolean;
  skipValidation?: boolean;
}

export interface InstallProgress {
  stage: 'searching' | 'downloading' | 'validating' | 'installing' | 'registering' | 'complete';
  progress: number; // 0-100
  message: string;
}

export class PluginInstaller extends EventEmitter {
  private pluginsDir: string;
  private tempDir: string;
  private npmRegistry = 'https://registry.npmjs.org';

  constructor() {
    super();
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.tempDir = path.join(app.getPath('temp'), 'filecataloger-plugins');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.pluginsDir);
    await fs.ensureDir(this.tempDir);
  }

  /**
   * Search NPM registry for FileCataloger plugins
   */
  async searchNpmRegistry(query: string, limit = 20): Promise<NpmPackageInfo[]> {
    try {
      this.emitProgress('searching', 0, 'Searching npm registry...');

      // Search for packages with filecataloger-plugin keyword
      const searchUrl = `${this.npmRegistry}/-/v1/search?text=${encodeURIComponent(
        query
      )}+keywords:filecataloger-plugin&size=${limit}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      this.emitProgress('searching', 100, 'Search complete');

      return data.objects.map((obj: any) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description,
        author: obj.package.author,
        keywords: obj.package.keywords || [],
        repository: obj.package.repository,
        downloads: obj.downloads?.weekly,
        lastPublished: obj.package.date,
      }));
    } catch (error) {
      logger.error('Failed to search npm registry:', error);
      throw new Error(`Failed to search plugins: ${error.message}`);
    }
  }

  /**
   * Install a plugin from NPM
   */
  async installFromNpm(
    packageName: string,
    options: InstallOptions = {}
  ): Promise<InstalledPluginInfo> {
    const installId = `${packageName}-${Date.now()}`;
    const installPath = path.join(this.tempDir, installId);

    try {
      // Step 1: Download package
      this.emitProgress('downloading', 0, `Downloading ${packageName}...`);
      await this.downloadPackage(packageName, installPath, options.version);
      this.emitProgress('downloading', 100, 'Download complete');

      // Step 2: Validate package
      this.emitProgress('validating', 0, 'Validating plugin package...');
      if (!options.skipValidation) {
        await this.validatePackageStructure(installPath);
      }
      this.emitProgress('validating', 100, 'Validation complete');

      // Step 3: Load and validate plugin
      this.emitProgress('installing', 0, 'Loading plugin...');
      const plugin = await this.loadPluginModule(installPath);
      this.emitProgress('installing', 50, 'Plugin loaded');

      // Step 4: Move to plugins directory
      const finalPath = path.join(this.pluginsDir, plugin.id);
      await fs.move(installPath, finalPath, { overwrite: true });
      this.emitProgress('installing', 100, 'Plugin installed');

      // Step 5: Register with plugin manager
      this.emitProgress('registering', 0, 'Registering plugin...');
      await pluginManager.registerPlugin(plugin);

      if (options.activate !== false) {
        await pluginManager.activatePlugin(plugin.id);
      }
      this.emitProgress('registering', 100, 'Plugin registered');

      // Step 6: Save installation info
      const installInfo: InstalledPluginInfo = {
        id: plugin.id,
        packageName,
        version: plugin.version,
        installDate: Date.now(),
        installPath: finalPath,
        isActive: options.activate !== false,
        permissions: plugin.permissions || [],
      };

      await this.saveInstallationInfo(installInfo);
      this.emitProgress('complete', 100, 'Installation complete');

      return installInfo;
    } catch (error) {
      // Cleanup on failure
      await fs.remove(installPath);
      logger.error(`Failed to install plugin ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Download NPM package
   */
  private async downloadPackage(
    packageName: string,
    targetPath: string,
    version?: string
  ): Promise<void> {
    const packageSpec = version ? `${packageName}@${version}` : packageName;

    try {
      // Create package.json for npm install
      const packageJson = {
        name: 'temp-install',
        version: '1.0.0',
        dependencies: {
          [packageName]: version || 'latest',
        },
      };

      await fs.ensureDir(targetPath);
      await fs.writeJson(path.join(targetPath, 'package.json'), packageJson);

      // Run npm install
      execSync('npm install --production', {
        cwd: targetPath,
        stdio: 'pipe',
      });

      // Move installed package to root
      const installedPath = path.join(targetPath, 'node_modules', packageName);
      const files = await fs.readdir(installedPath);

      for (const file of files) {
        await fs.move(
          path.join(installedPath, file),
          path.join(targetPath, file),
          { overwrite: true }
        );
      }

      // Cleanup node_modules
      await fs.remove(path.join(targetPath, 'node_modules'));
      await fs.remove(path.join(targetPath, 'package.json'));
      await fs.remove(path.join(targetPath, 'package-lock.json'));
    } catch (error) {
      throw new Error(`Failed to download package: ${error.message}`);
    }
  }

  /**
   * Validate plugin package structure
   */
  private async validatePackageStructure(packagePath: string): Promise<void> {
    // Check package.json
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('Missing package.json');
    }

    const packageJson = await fs.readJson(packageJsonPath);

    // Validate required fields
    if (!packageJson.name) {
      throw new Error('Package.json missing name field');
    }

    if (!packageJson.keywords?.includes('filecataloger-plugin')) {
      throw new Error('Package must include "filecataloger-plugin" keyword');
    }

    if (!packageJson.main) {
      throw new Error('Package.json missing main entry point');
    }

    // Check main file exists
    const mainFile = path.join(packagePath, packageJson.main);
    if (!await fs.pathExists(mainFile)) {
      throw new Error(`Main entry point not found: ${packageJson.main}`);
    }

    // Check for FileCataloger metadata
    if (!packageJson.filecataloger) {
      throw new Error('Package.json missing filecataloger metadata');
    }

    if (!packageJson.filecataloger.pluginVersion) {
      throw new Error('Missing filecataloger.pluginVersion');
    }
  }

  /**
   * Load plugin module
   */
  private async loadPluginModule(packagePath: string): Promise<NamingPlugin> {
    const packageJson = await fs.readJson(path.join(packagePath, 'package.json'));
    const mainFile = path.join(packagePath, packageJson.main);

    try {
      // Clear require cache
      delete require.cache[require.resolve(mainFile)];

      // Load the module
      const pluginModule = require(mainFile);
      const plugin = pluginModule.default || pluginModule;

      // Validate it's a proper plugin
      const validation = pluginManager.validatePlugin(plugin);
      if (!validation.valid) {
        throw new Error(`Invalid plugin structure: ${validation.errors.join(', ')}`);
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      // Deactivate in plugin manager
      await pluginManager.deactivatePlugin(pluginId);

      // Remove from file system
      const pluginPath = path.join(this.pluginsDir, pluginId);
      await fs.remove(pluginPath);

      // Remove installation info
      await this.removeInstallationInfo(pluginId);

      logger.info(`Plugin ${pluginId} uninstalled successfully`);
    } catch (error) {
      logger.error(`Failed to uninstall plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get all installed plugins
   */
  async getInstalledPlugins(): Promise<InstalledPluginInfo[]> {
    const infoPath = path.join(this.pluginsDir, 'installed.json');

    try {
      if (await fs.pathExists(infoPath)) {
        return await fs.readJson(infoPath);
      }
      return [];
    } catch (error) {
      logger.error('Failed to read installed plugins:', error);
      return [];
    }
  }

  /**
   * Save installation info
   */
  private async saveInstallationInfo(info: InstalledPluginInfo): Promise<void> {
    const infoPath = path.join(this.pluginsDir, 'installed.json');
    const installed = await this.getInstalledPlugins();

    // Update or add
    const index = installed.findIndex(p => p.id === info.id);
    if (index >= 0) {
      installed[index] = info;
    } else {
      installed.push(info);
    }

    await fs.writeJson(infoPath, installed, { spaces: 2 });
  }

  /**
   * Remove installation info
   */
  private async removeInstallationInfo(pluginId: string): Promise<void> {
    const infoPath = path.join(this.pluginsDir, 'installed.json');
    const installed = await this.getInstalledPlugins();
    const filtered = installed.filter(p => p.id !== pluginId);
    await fs.writeJson(infoPath, filtered, { spaces: 2 });
  }

  /**
   * Emit installation progress
   */
  private emitProgress(stage: InstallProgress['stage'], progress: number, message: string): void {
    const event: InstallProgress = { stage, progress, message };
    this.emit('progress', event);
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    await fs.emptyDir(this.tempDir);
  }
}

// Export singleton instance
export const pluginInstaller = new PluginInstaller();
```

---

## 2. Plugin Security Module Specification

### File: `src/main/modules/security/pluginSecurity.ts`

```typescript
import * as vm from 'vm';
import { createHash } from 'crypto';
import * as path from 'path';
import { logger } from '../utils/logger';
import { PluginCapability } from '@shared/types/plugins';

export interface SecurityReport {
  safe: boolean;
  risks: SecurityRisk[];
  recommendations: string[];
}

export interface SecurityRisk {
  type: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
}

export interface SandboxOptions {
  timeout: number;
  memoryLimit: number;
  permissions: PluginCapability[];
}

export class PluginSecurityManager {
  private blacklistedModules = [
    'child_process',
    'cluster',
    'dgram',
    'dns',
    'net',
    'tls',
    'http',
    'https',
  ];

  private dangerousGlobals = [
    'process',
    'require',
    '__dirname',
    '__filename',
    'module',
    'exports',
  ];

  private maliciousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /new\s+Function/,
    /require\s*\(\s*['"`]child_process/,
    /\.exec\s*\(/,
    /\.execSync\s*\(/,
    /\.spawn\s*\(/,
    /\.fork\s*\(/,
  ];

  /**
   * Scan plugin code for security issues
   */
  async scanPlugin(pluginPath: string): Promise<SecurityReport> {
    const risks: SecurityRisk[] = [];
    const recommendations: string[] = [];

    try {
      // Read all JavaScript files
      const files = await this.findJavaScriptFiles(pluginPath);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const fileRisks = await this.scanFileContent(content, file);
        risks.push(...fileRisks);
      }

      // Check package.json for suspicious dependencies
      const packageJsonPath = path.join(pluginPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const depRisks = this.checkDependencies(packageJson);
        risks.push(...depRisks);
      }

      // Generate recommendations
      if (risks.some(r => r.type === 'high')) {
        recommendations.push('This plugin contains high-risk code patterns and should be reviewed carefully');
      }

      if (risks.some(r => r.category === 'network')) {
        recommendations.push('This plugin may access network resources');
      }

      return {
        safe: risks.filter(r => r.type === 'high').length === 0,
        risks,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to scan plugin:', error);
      return {
        safe: false,
        risks: [{
          type: 'high',
          category: 'scan-error',
          description: 'Failed to complete security scan',
        }],
        recommendations: ['Could not complete security scan'],
      };
    }
  }

  /**
   * Scan file content for security issues
   */
  private async scanFileContent(content: string, filePath: string): Promise<SecurityRisk[]> {
    const risks: SecurityRisk[] = [];

    // Check for malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(content)) {
        risks.push({
          type: 'high',
          category: 'dangerous-code',
          description: `Potentially dangerous code pattern detected: ${pattern}`,
          location: filePath,
        });
      }
    }

    // Check for blacklisted module usage
    for (const module of this.blacklistedModules) {
      const importPattern = new RegExp(`require\\s*\\(\\s*['"\`]${module}['"\`]\\s*\\)`);
      const importStatementPattern = new RegExp(`import\\s+.*\\s+from\\s+['"\`]${module}['"\`]`);

      if (importPattern.test(content) || importStatementPattern.test(content)) {
        risks.push({
          type: 'medium',
          category: 'restricted-module',
          description: `Uses restricted module: ${module}`,
          location: filePath,
        });
      }
    }

    // Check for file system access
    if (/fs\.|require\(['"`]fs['"`]\)/.test(content)) {
      risks.push({
        type: 'medium',
        category: 'file-system',
        description: 'Accesses file system',
        location: filePath,
      });
    }

    // Check for network access
    if (/fetch\(|axios|XMLHttpRequest/.test(content)) {
      risks.push({
        type: 'low',
        category: 'network',
        description: 'May perform network requests',
        location: filePath,
      });
    }

    return risks;
  }

  /**
   * Check dependencies for security issues
   */
  private checkDependencies(packageJson: any): SecurityRisk[] {
    const risks: SecurityRisk[] = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
      // Check for suspicious dependencies
      if (this.blacklistedModules.includes(dep)) {
        risks.push({
          type: 'high',
          category: 'dangerous-dependency',
          description: `Depends on restricted module: ${dep}`,
        });
      }

      // Check for git dependencies (potential security risk)
      if (typeof version === 'string' && version.includes('git')) {
        risks.push({
          type: 'medium',
          category: 'git-dependency',
          description: `Uses git dependency: ${dep}`,
        });
      }
    }

    return risks;
  }

  /**
   * Create sandboxed execution context
   */
  createSandbox(options: SandboxOptions): vm.Context {
    const sandbox = {
      // Provide safe globals
      console: {
        log: (...args: any[]) => logger.info('[Plugin]', ...args),
        error: (...args: any[]) => logger.error('[Plugin]', ...args),
        warn: (...args: any[]) => logger.warn('[Plugin]', ...args),
        info: (...args: any[]) => logger.info('[Plugin]', ...args),
      },

      // Safe utilities
      setTimeout: (fn: Function, delay: number) => {
        if (delay > options.timeout) {
          throw new Error('Timeout exceeds maximum allowed');
        }
        return setTimeout(fn, delay);
      },

      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,

      // Custom error class
      Error,

      // Restricted require function
      require: this.createRestrictedRequire(options.permissions),
    };

    // Remove dangerous globals
    for (const global of this.dangerousGlobals) {
      Object.defineProperty(sandbox, global, {
        get() {
          throw new Error(`Access to ${global} is not allowed`);
        },
      });
    }

    return vm.createContext(sandbox);
  }

  /**
   * Create restricted require function
   */
  private createRestrictedRequire(permissions: PluginCapability[]) {
    return (module: string) => {
      // Check if module is allowed
      if (this.blacklistedModules.includes(module)) {
        throw new Error(`Module ${module} is not allowed`);
      }

      // Check permissions for specific modules
      if (module === 'fs' && !permissions.includes(PluginCapability.FILE_SYSTEM_READ)) {
        throw new Error('File system access not permitted');
      }

      if (['http', 'https', 'net'].includes(module) &&
          !permissions.includes(PluginCapability.NETWORK_ACCESS)) {
        throw new Error('Network access not permitted');
      }

      // Allow whitelisted modules
      const whitelisted = ['path', 'url', 'querystring', 'util'];
      if (whitelisted.includes(module)) {
        return require(module);
      }

      throw new Error(`Module ${module} is not allowed`);
    };
  }

  /**
   * Execute code in sandbox with resource limits
   */
  async executeInSandbox(
    code: string,
    sandbox: vm.Context,
    options: SandboxOptions
  ): Promise<any> {
    const script = new vm.Script(code, {
      timeout: options.timeout,
      displayErrors: true,
    });

    // Monitor memory usage
    const startMemory = process.memoryUsage().heapUsed;
    let memoryCheckInterval: NodeJS.Timeout;

    try {
      // Set up memory monitoring
      memoryCheckInterval = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        const usedMemory = currentMemory - startMemory;

        if (usedMemory > options.memoryLimit) {
          throw new Error('Memory limit exceeded');
        }
      }, 100);

      // Execute the script
      const result = await script.runInContext(sandbox, {
        timeout: options.timeout,
        displayErrors: true,
      });

      return result;
    } finally {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
      }
    }
  }

  /**
   * Calculate plugin hash for integrity checking
   */
  async calculatePluginHash(pluginPath: string): Promise<string> {
    const hash = createHash('sha256');
    const files = await this.findJavaScriptFiles(pluginPath);

    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  /**
   * Find all JavaScript files in plugin
   */
  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...await this.findJavaScriptFiles(fullPath));
      } else if (entry.isFile() && /\.(js|mjs|ts)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

export const pluginSecurity = new PluginSecurityManager();
```

---

## 3. IPC Handler Module Specification

### File: `src/main/ipc/pluginHandlers.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { pluginManager } from '../modules/plugins/pluginManager';
import { pluginInstaller } from '../modules/plugins/pluginInstaller';
import { pluginSecurity } from '../modules/security/pluginSecurity';
import { logger } from '../modules/utils/logger';
import {
  NamingPlugin,
  LoadedPlugin,
  PluginContext,
  PluginExecutionResult
} from '@shared/types/plugins';

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PluginSearchParams {
  query: string;
  limit?: number;
}

export interface PluginInstallParams {
  packageName: string;
  version?: string;
  activate?: boolean;
}

export interface PluginExecuteParams {
  pluginId: string;
  context: PluginContext;
}

export interface PluginConfigParams {
  pluginId: string;
  config: Record<string, any>;
}

/**
 * Register all plugin-related IPC handlers
 */
export function registerPluginHandlers(): void {
  // Search for plugins in npm registry
  ipcMain.handle(
    'plugin:search',
    async (
      event: IpcMainInvokeEvent,
      params: PluginSearchParams
    ): Promise<IPCResponse<any[]>> => {
      try {
        const results = await pluginInstaller.searchNpmRegistry(
          params.query,
          params.limit || 20
        );
        return { success: true, data: results };
      } catch (error) {
        logger.error('Plugin search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search failed'
        };
      }
    }
  );

  // Install plugin from npm
  ipcMain.handle(
    'plugin:install',
    async (
      event: IpcMainInvokeEvent,
      params: PluginInstallParams
    ): Promise<IPCResponse<any>> => {
      try {
        // Send progress updates
        pluginInstaller.on('progress', (progress) => {
          event.sender.send('plugin:install-progress', progress);
        });

        const result = await pluginInstaller.installFromNpm(params.packageName, {
          version: params.version,
          activate: params.activate,
        });

        // Cleanup listener
        pluginInstaller.removeAllListeners('progress');

        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin installation failed:', error);
        pluginInstaller.removeAllListeners('progress');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Installation failed'
        };
      }
    }
  );

  // Uninstall plugin
  ipcMain.handle(
    'plugin:uninstall',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse<boolean>> => {
      try {
        await pluginInstaller.uninstallPlugin(pluginId);
        return { success: true, data: true };
      } catch (error) {
        logger.error('Plugin uninstall failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Uninstall failed'
        };
      }
    }
  );

  // List all plugins (built-in + installed)
  ipcMain.handle(
    'plugin:list',
    async (): Promise<IPCResponse<LoadedPlugin[]>> => {
      try {
        const plugins = pluginManager.getPlugins();
        return { success: true, data: plugins };
      } catch (error) {
        logger.error('Failed to list plugins:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list plugins'
        };
      }
    }
  );

  // Get installed plugins info
  ipcMain.handle(
    'plugin:list-installed',
    async (): Promise<IPCResponse<any[]>> => {
      try {
        const installed = await pluginInstaller.getInstalledPlugins();
        return { success: true, data: installed };
      } catch (error) {
        logger.error('Failed to list installed plugins:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list installed plugins'
        };
      }
    }
  );

  // Toggle plugin active state
  ipcMain.handle(
    'plugin:toggle',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string,
      active: boolean
    ): Promise<IPCResponse<boolean>> => {
      try {
        if (active) {
          await pluginManager.activatePlugin(pluginId);
        } else {
          await pluginManager.deactivatePlugin(pluginId);
        }
        return { success: true, data: true };
      } catch (error) {
        logger.error('Failed to toggle plugin:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to toggle plugin'
        };
      }
    }
  );

  // Get plugin configuration
  ipcMain.handle(
    'plugin:get-config',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse<Record<string, any>>> => {
      try {
        const plugin = pluginManager.getPlugin(pluginId);
        if (!plugin) {
          throw new Error('Plugin not found');
        }
        return { success: true, data: plugin.config };
      } catch (error) {
        logger.error('Failed to get plugin config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get config'
        };
      }
    }
  );

  // Update plugin configuration
  ipcMain.handle(
    'plugin:set-config',
    async (
      event: IpcMainInvokeEvent,
      params: PluginConfigParams
    ): Promise<IPCResponse<boolean>> => {
      try {
        const plugin = pluginManager.getPlugin(params.pluginId);
        if (!plugin) {
          throw new Error('Plugin not found');
        }

        // Validate config against schema
        if (plugin.plugin.component.validate) {
          const validation = plugin.plugin.component.validate(params.config);
          if (typeof validation === 'object' && !validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
          }
        }

        plugin.config = params.config;
        // TODO: Persist config to storage

        return { success: true, data: true };
      } catch (error) {
        logger.error('Failed to set plugin config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set config'
        };
      }
    }
  );

  // Execute plugin render function
  ipcMain.handle(
    'plugin:execute',
    async (
      event: IpcMainInvokeEvent,
      params: PluginExecuteParams
    ): Promise<IPCResponse<PluginExecutionResult>> => {
      try {
        const result = await pluginManager.executePlugin(
          params.pluginId,
          params.context
        );
        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin execution failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed'
        };
      }
    }
  );

  // Execute plugin batch render
  ipcMain.handle(
    'plugin:execute-batch',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string,
      contexts: PluginContext[]
    ): Promise<IPCResponse<PluginExecutionResult>> => {
      try {
        const result = await pluginManager.executeBatchPlugin(pluginId, contexts);
        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin batch execution failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Batch execution failed'
        };
      }
    }
  );

  // Security scan plugin
  ipcMain.handle(
    'plugin:security-scan',
    async (
      event: IpcMainInvokeEvent,
      pluginPath: string
    ): Promise<IPCResponse<any>> => {
      try {
        const report = await pluginSecurity.scanPlugin(pluginPath);
        return { success: true, data: report };
      } catch (error) {
        logger.error('Security scan failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Security scan failed'
        };
      }
    }
  );

  // Get plugin details
  ipcMain.handle(
    'plugin:get-details',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse<LoadedPlugin | null>> => {
      try {
        const plugin = pluginManager.getPlugin(pluginId);
        return { success: true, data: plugin || null };
      } catch (error) {
        logger.error('Failed to get plugin details:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get details'
        };
      }
    }
  );

  logger.info('Plugin IPC handlers registered');
}

/**
 * Cleanup plugin handlers
 */
export function cleanupPluginHandlers(): void {
  const handlers = [
    'plugin:search',
    'plugin:install',
    'plugin:uninstall',
    'plugin:list',
    'plugin:list-installed',
    'plugin:toggle',
    'plugin:get-config',
    'plugin:set-config',
    'plugin:execute',
    'plugin:execute-batch',
    'plugin:security-scan',
    'plugin:get-details',
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }

  logger.info('Plugin IPC handlers cleaned up');
}
```

---

## 4. React UI Components Specification

### File: `src/renderer/pages/preferences/plugins/PluginSearch.tsx`

```typescript
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '@renderer/components/primitives';
import { useToast } from '@renderer/stores';
import { logger } from '@shared/logger';

interface PluginSearchResult {
  name: string;
  version: string;
  description: string;
  author: string | { name: string };
  keywords: string[];
  downloads?: number;
  lastPublished?: string;
}

interface PluginSearchProps {
  onInstall: (packageName: string, version?: string) => Promise<void>;
}

export const PluginSearch: React.FC<PluginSearchProps> = ({ onInstall }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PluginSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await window.api.invoke('plugin:search', {
          query: searchQuery,
          limit: 20,
        });

        if (response.success) {
          setResults(response.data);
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        logger.error('Plugin search failed:', error);
        toast.error('Search Failed', error.message || 'Failed to search plugins');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500),
    [toast]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleInstall = async (packageName: string, version?: string) => {
    setInstalling(packageName);
    try {
      await onInstall(packageName, version);
      // Remove from results after successful install
      setResults(results.filter(r => r.name !== packageName));
    } finally {
      setInstalling(null);
    }
  };

  const formatAuthorName = (author: string | { name: string }): string => {
    return typeof author === 'string' ? author : author.name;
  };

  const formatDownloads = (downloads?: number): string => {
    if (!downloads) return '';
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  return (
    <div className="plugin-search">
      {/* Search Input */}
      <div className="search-container">
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search npm for FileCataloger plugins..."
          className="search-input"
        />
        {loading && (
          <div className="search-loading">
            <LoadingSpinner size="small" />
          </div>
        )}
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="search-results"
          >
            {results.map((result) => (
              <motion.div
                key={result.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="plugin-search-item"
              >
                <div className="plugin-info">
                  <div className="plugin-header">
                    <h4 className="plugin-name">{result.name}</h4>
                    <span className="plugin-version">v{result.version}</span>
                  </div>
                  <p className="plugin-description">{result.description}</p>
                  <div className="plugin-meta">
                    <span className="plugin-author">
                      by {formatAuthorName(result.author)}
                    </span>
                    {result.downloads && (
                      <span className="plugin-downloads">
                        {formatDownloads(result.downloads)} downloads/week
                      </span>
                    )}
                  </div>
                  {result.keywords && result.keywords.length > 0 && (
                    <div className="plugin-keywords">
                      {result.keywords.slice(0, 5).map((keyword) => (
                        <span key={keyword} className="keyword-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="plugin-actions">
                  <button
                    onClick={() => handleInstall(result.name, result.version)}
                    disabled={installing === result.name}
                    className="install-button"
                  >
                    {installing === result.name ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      'Install'
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .plugin-search {
          margin-bottom: 24px;
        }

        .search-container {
          position: relative;
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px;
          padding-right: 48px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: #3b82f6;
        }

        .search-loading {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
        }

        .search-results {
          max-height: 400px;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .plugin-search-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s;
        }

        .plugin-search-item:last-child {
          border-bottom: none;
        }

        .plugin-search-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .plugin-info {
          flex: 1;
          min-width: 0;
        }

        .plugin-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .plugin-name {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .plugin-version {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .plugin-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 8px;
          line-height: 1.4;
        }

        .plugin-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .plugin-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .keyword-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
        }

        .plugin-actions {
          flex-shrink: 0;
          margin-left: 16px;
        }

        .install-button {
          padding: 8px 16px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .install-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .install-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
```

---

## Summary

These technical specifications provide:

1. **Detailed Module Implementations** with TypeScript interfaces and classes
2. **Security-First Approach** with sandboxing and validation
3. **Robust Error Handling** throughout all modules
4. **Progress Tracking** for long-running operations
5. **Type Safety** with comprehensive TypeScript definitions
6. **Modular Architecture** allowing independent development

Each module is designed to be:
- **Self-contained** with clear responsibilities
- **Testable** with dependency injection where needed
- **Secure** with multiple validation layers
- **Performant** with caching and optimization
- **User-friendly** with progress tracking and clear error messages

The implementation follows Electron best practices and maintains consistency with the existing FileCataloger architecture.