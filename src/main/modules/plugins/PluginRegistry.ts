/**
 * @file PluginRegistry.ts
 * @description Plugin registry system for discovering, installing, and managing plugins
 * Provides centralized plugin discovery and marketplace functionality
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { NamingPlugin, LoadedPlugin, PluginError } from '@shared/types/plugins';
import { logger } from '@shared/logger';

export interface PluginRegistryEntry {
  plugin: NamingPlugin;
  metadata: {
    downloadCount: number;
    rating: number;
    lastUpdated: number;
    fileSize: number;
    verified: boolean;
    featured: boolean;
  };
  versions: {
    version: string;
    downloadUrl: string;
    changelog: string;
    publishedAt: number;
  }[];
  author: {
    name: string;
    verified: boolean;
    plugins: number;
  };
}

export interface PluginSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PluginInstallOptions {
  force?: boolean;
  skipValidation?: boolean;
  activateAfterInstall?: boolean;
}

export interface PluginMarketplace {
  baseUrl: string;
  apiKey?: string;
  enableTelemetry: boolean;
}

/**
 * Plugin Registry manages plugin discovery, installation, and marketplace integration
 */
export class PluginRegistry extends EventEmitter {
  private plugins = new Map<string, PluginRegistryEntry>();
  private localCache = new Map<string, PluginRegistryEntry>();
  private marketplace: PluginMarketplace;
  private pluginManager: any; // Will be injected

  constructor(marketplace: Partial<PluginMarketplace> = {}) {
    super();

    this.marketplace = {
      baseUrl: 'https://plugins.filecataloger.com/api',
      enableTelemetry: true,
      ...marketplace,
    };

    logger.info('PluginRegistry initialized', { marketplace: this.marketplace });
  }

  /**
   * Set the plugin manager instance for integration
   */
  setPluginManager(pluginManager: any): void {
    this.pluginManager = pluginManager;
  }

  /**
   * Initialize the registry and load local cache
   */
  async initialize(): Promise<void> {
    try {
      await this.loadLocalCache();
      await this.refreshFromMarketplace();

      this.emit('initialized', { pluginCount: this.plugins.size });
      logger.info('PluginRegistry initialization complete', {
        cachedPlugins: this.localCache.size,
        marketplacePlugins: this.plugins.size,
      });
    } catch (error) {
      logger.error('Failed to initialize PluginRegistry', error);
      throw error;
    }
  }

  /**
   * Search for plugins in the registry
   */
  async searchPlugins(options: PluginSearchOptions = {}): Promise<PluginRegistryEntry[]> {
    const {
      query,
      category,
      tags,
      author,
      verified,
      featured,
      sortBy = 'downloads',
      sortOrder = 'desc',
      limit = 50,
      offset = 0,
    } = options;

    let results = Array.from(this.plugins.values());

    // Apply filters
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        entry =>
          entry.plugin.name.toLowerCase().includes(lowerQuery) ||
          entry.plugin.description.toLowerCase().includes(lowerQuery) ||
          entry.plugin.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
      );
    }

    if (category) {
      results = results.filter(entry => entry.plugin.category === category);
    }

    if (tags && tags.length > 0) {
      results = results.filter(entry => tags.some(tag => entry.plugin.tags?.includes(tag)));
    }

    if (author) {
      results = results.filter(entry => entry.plugin.author.name === author);
    }

    if (verified !== undefined) {
      results = results.filter(entry => entry.metadata.verified === verified);
    }

    if (featured !== undefined) {
      results = results.filter(entry => entry.metadata.featured === featured);
    }

    // Apply sorting
    results.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.plugin.name;
          bValue = b.plugin.name;
          break;
        case 'downloads':
          aValue = a.metadata.downloadCount;
          bValue = b.metadata.downloadCount;
          break;
        case 'rating':
          aValue = a.metadata.rating;
          bValue = b.metadata.rating;
          break;
        case 'updated':
          aValue = a.metadata.lastUpdated;
          bValue = b.metadata.lastUpdated;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  /**
   * Get featured plugins
   */
  async getFeaturedPlugins(): Promise<PluginRegistryEntry[]> {
    return this.searchPlugins({ featured: true, limit: 10 });
  }

  /**
   * Get popular plugins
   */
  async getPopularPlugins(): Promise<PluginRegistryEntry[]> {
    return this.searchPlugins({ sortBy: 'downloads', limit: 20 });
  }

  /**
   * Get recently updated plugins
   */
  async getRecentlyUpdatedPlugins(): Promise<PluginRegistryEntry[]> {
    return this.searchPlugins({ sortBy: 'updated', limit: 20 });
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.plugins.get(pluginId) || this.localCache.get(pluginId);
  }

  /**
   * Install a plugin from the registry
   */
  async installPlugin(
    pluginId: string,
    version?: string,
    options: PluginInstallOptions = {}
  ): Promise<LoadedPlugin> {
    const { force = false, skipValidation = false, activateAfterInstall = true } = options;

    try {
      const registryEntry = this.plugins.get(pluginId);
      if (!registryEntry) {
        throw new PluginError(pluginId, 'NOT_FOUND', 'Plugin not found in registry');
      }

      // Check if already installed
      if (!force && this.pluginManager.getPlugin(pluginId)) {
        throw new PluginError(pluginId, 'ALREADY_INSTALLED', 'Plugin is already installed');
      }

      // Determine version to install
      const targetVersion = version || registryEntry.versions[0]?.version;
      const versionInfo = registryEntry.versions.find(v => v.version === targetVersion);

      if (!versionInfo) {
        throw new PluginError(pluginId, 'VERSION_NOT_FOUND', `Version ${targetVersion} not found`);
      }

      // Download and install
      const pluginPath = await this.downloadPlugin(pluginId, versionInfo);
      const loadedPlugin = await this.pluginManager.loadPluginFromPath(pluginPath);

      // Activate if requested
      if (activateAfterInstall) {
        await this.pluginManager.activatePlugin(pluginId);
      }

      // Update metadata
      registryEntry.metadata.downloadCount++;
      await this.updateLocalCache(pluginId, registryEntry);

      this.emit('plugin-installed', { pluginId, version: targetVersion, loadedPlugin });
      logger.info('Plugin installed successfully', { pluginId, version: targetVersion });

      return loadedPlugin;
    } catch (error) {
      logger.error('Failed to install plugin', { pluginId, error });
      this.emit('plugin-install-failed', { pluginId, error });
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      // Unload from plugin manager
      await this.pluginManager.unloadPlugin(pluginId);

      // Remove local files
      const pluginPath = path.join(this.pluginManager.config.pluginsDirectory, pluginId);
      await fs.rmdir(pluginPath, { recursive: true });

      this.emit('plugin-uninstalled', { pluginId });
      logger.info('Plugin uninstalled successfully', { pluginId });
    } catch (error) {
      logger.error('Failed to uninstall plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Update a plugin to the latest version
   */
  async updatePlugin(pluginId: string, targetVersion?: string): Promise<LoadedPlugin> {
    const currentPlugin = this.pluginManager.getPlugin(pluginId);
    if (!currentPlugin) {
      throw new PluginError(pluginId, 'NOT_INSTALLED', 'Plugin is not installed');
    }

    const registryEntry = this.plugins.get(pluginId);
    if (!registryEntry) {
      throw new PluginError(pluginId, 'NOT_IN_REGISTRY', 'Plugin not found in registry');
    }

    const latestVersion = targetVersion || registryEntry.versions[0]?.version;

    if (currentPlugin.plugin.version === latestVersion) {
      logger.info('Plugin is already up to date', { pluginId, version: latestVersion });
      return currentPlugin;
    }

    // Backup current plugin before update
    const backupPath = await this.backupPlugin(pluginId);

    try {
      // Install new version (force=true to overwrite)
      const updatedPlugin = await this.installPlugin(pluginId, latestVersion, { force: true });

      // Execute update lifecycle hook
      if (updatedPlugin.plugin.lifecycle?.onUpdate) {
        await updatedPlugin.plugin.lifecycle.onUpdate(currentPlugin.plugin.version, latestVersion);
      }

      // Remove backup
      await fs.rmdir(backupPath, { recursive: true });

      this.emit('plugin-updated', {
        pluginId,
        fromVersion: currentPlugin.plugin.version,
        toVersion: latestVersion,
      });

      return updatedPlugin;
    } catch (error) {
      // Restore backup on failure
      try {
        await this.restorePlugin(pluginId, backupPath);
        logger.info('Plugin restored from backup after failed update', { pluginId });
      } catch (restoreError) {
        logger.error('Failed to restore plugin backup', { pluginId, restoreError });
      }

      throw error;
    }
  }

  /**
   * Check for plugin updates
   */
  async checkForUpdates(): Promise<
    { pluginId: string; currentVersion: string; latestVersion: string }[]
  > {
    const updates: { pluginId: string; currentVersion: string; latestVersion: string }[] = [];
    const installedPlugins = this.pluginManager.getLoadedPlugins();

    for (const loadedPlugin of installedPlugins) {
      const registryEntry = this.plugins.get(loadedPlugin.plugin.id);
      if (registryEntry) {
        const latestVersion = registryEntry.versions[0]?.version;
        if (latestVersion && latestVersion !== loadedPlugin.plugin.version) {
          updates.push({
            pluginId: loadedPlugin.plugin.id,
            currentVersion: loadedPlugin.plugin.version,
            latestVersion,
          });
        }
      }
    }

    return updates;
  }

  /**
   * Refresh plugin data from marketplace
   */
  async refreshFromMarketplace(): Promise<void> {
    try {
      // TODO: Implement marketplace API integration
      logger.info('Refreshing plugin data from marketplace...');

      // For now, this is a placeholder
      // In a real implementation, this would:
      // 1. Fetch plugin list from marketplace API
      // 2. Update local plugin registry
      // 3. Cache results locally

      this.emit('marketplace-refreshed');
    } catch (error) {
      logger.error('Failed to refresh from marketplace', error);
      throw error;
    }
  }

  /**
   * Submit a plugin to the marketplace
   */
  async submitPlugin(pluginPath: string, metadata: any): Promise<void> {
    try {
      // TODO: Implement plugin submission
      logger.info('Submitting plugin to marketplace', { pluginPath });

      this.emit('plugin-submitted', { pluginPath });
    } catch (error) {
      logger.error('Failed to submit plugin', { pluginPath, error });
      throw error;
    }
  }

  /**
   * Load local plugin cache
   */
  private async loadLocalCache(): Promise<void> {
    try {
      const cacheFile = path.join(process.cwd(), 'data', 'plugin-cache.json');
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const cache = JSON.parse(cacheData);

      for (const [pluginId, entry] of Object.entries(cache)) {
        this.localCache.set(pluginId, entry as PluginRegistryEntry);
      }

      logger.info('Loaded plugin cache', { entries: this.localCache.size });
    } catch (error) {
      logger.info('No local plugin cache found, starting fresh');
    }
  }

  /**
   * Update local cache
   */
  private async updateLocalCache(pluginId: string, entry: PluginRegistryEntry): Promise<void> {
    try {
      this.localCache.set(pluginId, entry);

      const cacheFile = path.join(process.cwd(), 'data', 'plugin-cache.json');
      const cacheData = Object.fromEntries(this.localCache.entries());

      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      logger.error('Failed to update local cache', error);
    }
  }

  /**
   * Download plugin from marketplace
   */
  private async downloadPlugin(pluginId: string, versionInfo: any): Promise<string> {
    // TODO: Implement actual plugin download
    const pluginPath = path.join(this.pluginManager.config.pluginsDirectory, pluginId);

    logger.info('Downloading plugin', { pluginId, version: versionInfo.version });

    // Placeholder - in real implementation would download and extract
    await fs.mkdir(pluginPath, { recursive: true });

    return pluginPath;
  }

  /**
   * Backup plugin before update
   */
  private async backupPlugin(pluginId: string): Promise<string> {
    const pluginPath = path.join(this.pluginManager.config.pluginsDirectory, pluginId);
    const backupPath = path.join(
      this.pluginManager.config.pluginsDirectory,
      `${pluginId}.backup.${Date.now()}`
    );

    await fs.cp(pluginPath, backupPath, { recursive: true });
    return backupPath;
  }

  /**
   * Restore plugin from backup
   */
  private async restorePlugin(pluginId: string, backupPath: string): Promise<void> {
    const pluginPath = path.join(this.pluginManager.config.pluginsDirectory, pluginId);

    // Remove current version
    await fs.rmdir(pluginPath, { recursive: true });

    // Restore from backup
    await fs.cp(backupPath, pluginPath, { recursive: true });
  }

  /**
   * Get plugin categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();

    for (const entry of this.plugins.values()) {
      if (entry.plugin.category) {
        categories.add(entry.plugin.category);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    totalPlugins: number;
    categories: number;
    verifiedPlugins: number;
    featuredPlugins: number;
    averageRating: number;
  } {
    const plugins = Array.from(this.plugins.values());

    return {
      totalPlugins: plugins.length,
      categories: this.getCategories().length,
      verifiedPlugins: plugins.filter(p => p.metadata.verified).length,
      featuredPlugins: plugins.filter(p => p.metadata.featured).length,
      averageRating: plugins.reduce((sum, p) => sum + p.metadata.rating, 0) / plugins.length || 0,
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.plugins.clear();
    this.localCache.clear();
    this.removeAllListeners();

    logger.info('PluginRegistry destroyed');
  }
}
