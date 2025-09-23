import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { app } from 'electron';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import { pluginManager } from './pluginManager';
import { NamingPlugin } from '@shared/types/plugins';

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
      throw new Error(
        `Failed to search plugins: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
   * Securely run npm install with timeout and validation
   */
  private async runSecureNpmInstall(targetPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Validate the target path to prevent path injection
      const resolvedPath = path.resolve(targetPath);
      if (!resolvedPath.startsWith(this.tempDir)) {
        reject(new Error('Invalid installation path'));
        return;
      }

      const timeout = 60000; // 60 second timeout
      const npmArgs = ['install', '--production', '--no-scripts', '--no-optional'];

      // Use spawn instead of execSync for better security and control
      const npmProcess = spawn('npm', npmArgs, {
        cwd: resolvedPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeout,
        env: {
          ...process.env,
          NPM_CONFIG_AUDIT: 'false', // Disable audit for faster install
          NPM_CONFIG_FUND: 'false', // Disable funding messages
        },
      });

      let stderr = '';

      npmProcess.stderr?.on('data', data => {
        stderr += data.toString();
      });

      npmProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}: ${stderr}`));
        }
      });

      npmProcess.on('error', error => {
        reject(new Error(`npm install process error: ${error.message}`));
      });

      // Set up timeout
      setTimeout(() => {
        if (!npmProcess.killed) {
          npmProcess.kill('SIGTERM');
          reject(new Error('npm install timed out'));
        }
      }, timeout);
    });
  }

  /**
   * Download NPM package
   */
  private async downloadPackage(
    packageName: string,
    targetPath: string,
    version?: string
  ): Promise<void> {
    // Validate package name to prevent injection attacks
    if (!this.isValidPackageName(packageName)) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    // Validate version string if provided
    if (version && !this.isValidVersion(version)) {
      throw new Error(`Invalid version: ${version}`);
    }

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

      // Run npm install securely using spawn
      await this.runSecureNpmInstall(targetPath);

      // Move installed package to root with proper error handling
      await this.movePackageFiles(targetPath, packageName);
    } catch (error) {
      throw new Error(
        `Failed to download package: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Move package files from node_modules to target directory with atomic operations
   */
  private async movePackageFiles(targetPath: string, packageName: string): Promise<void> {
    const installedPath = path.join(targetPath, 'node_modules', packageName);
    const backupPath = path.join(targetPath, '.backup');

    try {
      // Verify installed path exists
      if (!(await fs.pathExists(installedPath))) {
        throw new Error(`Package not found in node_modules: ${packageName}`);
      }

      // Create backup directory for atomic operations
      await fs.ensureDir(backupPath);

      // Get list of files to move
      const files = await fs.readdir(installedPath);
      if (files.length === 0) {
        throw new Error('No files found in installed package');
      }

      // Create a list of file operations
      const operations: Array<{ from: string; to: string; backup?: string }> = [];

      for (const file of files) {
        const sourcePath = path.join(installedPath, file);
        const targetFilePath = path.join(targetPath, file);
        const backupFilePath = path.join(backupPath, file);

        // Check if target file already exists and needs backup
        if (await fs.pathExists(targetFilePath)) {
          operations.push({
            from: targetFilePath,
            to: backupFilePath,
            backup: targetFilePath,
          });
        }

        operations.push({
          from: sourcePath,
          to: targetFilePath,
        });
      }

      // Execute operations atomically
      try {
        for (const op of operations) {
          if (op.backup) {
            // Backup existing file
            await fs.move(op.from, op.to);
          } else {
            // Move new file
            await fs.move(op.from, op.to, { overwrite: true });
          }
        }

        // Cleanup successful - remove backup
        await fs.remove(backupPath);
      } catch (moveError) {
        // Rollback on failure
        logger.warn('File move operation failed, attempting rollback:', moveError);
        await this.rollbackFileOperations(operations, backupPath);
        throw moveError;
      }

      // Clean up temporary directories
      await fs.remove(path.join(targetPath, 'node_modules'));
      await fs.remove(path.join(targetPath, 'package.json'));
      await fs.remove(path.join(targetPath, 'package-lock.json'));
    } catch (error) {
      // Ensure cleanup on any error
      try {
        await fs.remove(backupPath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup backup directory:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Rollback file operations in case of failure
   */
  private async rollbackFileOperations(
    operations: Array<{ from: string; to: string; backup?: string }>,
    _backupPath: string
  ): Promise<void> {
    try {
      // Restore backed up files
      for (const op of operations.reverse()) {
        if (op.backup && (await fs.pathExists(op.to))) {
          await fs.move(op.to, op.backup, { overwrite: true });
        }
      }
    } catch (rollbackError) {
      logger.error('Rollback failed:', rollbackError);
    }
  }

  /**
   * Validate plugin package structure
   */
  private async validatePackageStructure(packagePath: string): Promise<void> {
    // Check package.json
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) {
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
    if (!(await fs.pathExists(mainFile))) {
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pluginModule = require(mainFile);
      const plugin = pluginModule.default || pluginModule;

      // Validate it's a proper plugin
      const validation = pluginManager.validatePlugin(plugin);
      if (!validation.valid) {
        throw new Error(`Invalid plugin structure: ${validation.errors.join(', ')}`);
      }

      return plugin;
    } catch (error) {
      throw new Error(
        `Failed to load plugin module: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
   * Validate package name to prevent injection attacks
   */
  private isValidPackageName(packageName: string): boolean {
    // NPM package name validation according to NPM rules
    const npmPackagePattern = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

    // Additional security checks
    if (!packageName || packageName.length > 214) {
      return false;
    }

    // Prevent dangerous characters
    const dangerousChars = /[;&|`$(){}[\]\\]/;
    if (dangerousChars.test(packageName)) {
      return false;
    }

    return npmPackagePattern.test(packageName);
  }

  /**
   * Validate version string to prevent injection attacks
   */
  private isValidVersion(version: string): boolean {
    // Semver pattern with additional security constraints
    const semverPattern = /^(?:\d+\.)?(?:\d+\.)?(?:\d+)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;

    // Additional security checks
    if (!version || version.length > 50) {
      return false;
    }

    // Prevent dangerous characters
    const dangerousChars = /[;&|`$(){}[\]\\]/;
    if (dangerousChars.test(version)) {
      return false;
    }

    // Allow semver and 'latest', 'next', etc.
    const allowedVersions = ['latest', 'next', 'beta', 'alpha'];
    if (allowedVersions.includes(version)) {
      return true;
    }

    return semverPattern.test(version);
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
