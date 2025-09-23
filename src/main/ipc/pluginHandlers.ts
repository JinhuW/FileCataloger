import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { pluginManager } from '../modules/plugins/pluginManager';
import { pluginInstaller } from '../modules/plugins/pluginInstaller';
import { pluginSecurity } from '../modules/security/pluginSecurity';
import { pluginStorage } from '../modules/storage/pluginStorage';
import { logger } from '../modules/utils/logger';
import {
  LoadedPlugin,
  PluginContext,
  PluginExecutionResult,
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
  // Initialize plugin storage
  pluginStorage.initialize().catch(error => {
    logger.error('Failed to initialize plugin storage:', error);
  });

  // Search for plugins in npm registry
  ipcMain.handle(
    'plugin:search',
    async (event: IpcMainInvokeEvent, params: PluginSearchParams): Promise<IPCResponse<any[]>> => {
      try {
        const results = await pluginInstaller.searchNpmRegistry(params.query, params.limit || 20);
        return { success: true, data: results };
      } catch (error) {
        logger.error('Plugin search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search failed',
        };
      }
    }
  );

  // Install plugin from npm
  ipcMain.handle(
    'plugin:install',
    async (event: IpcMainInvokeEvent, params: PluginInstallParams): Promise<IPCResponse<any>> => {
      try {
        // Send progress updates
        pluginInstaller.on('progress', progress => {
          event.sender.send('plugin:install-progress', progress);
        });

        const result = await pluginInstaller.installFromNpm(params.packageName, {
          version: params.version,
          activate: params.activate,
        });

        // Save to storage
        await pluginStorage.saveInstalledPlugin(result);

        // Cleanup listener
        pluginInstaller.removeAllListeners('progress');

        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin installation failed:', error);
        pluginInstaller.removeAllListeners('progress');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Installation failed',
        };
      }
    }
  );

  // Uninstall plugin
  ipcMain.handle(
    'plugin:uninstall',
    async (event: IpcMainInvokeEvent, pluginId: string): Promise<IPCResponse<boolean>> => {
      try {
        await pluginInstaller.uninstallPlugin(pluginId);
        await pluginStorage.removePlugin(pluginId);
        return { success: true, data: true };
      } catch (error) {
        logger.error('Plugin uninstall failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Uninstall failed',
        };
      }
    }
  );

  // List all plugins (built-in + installed)
  ipcMain.handle('plugin:list', async (): Promise<IPCResponse<LoadedPlugin[]>> => {
    try {
      const plugins = pluginManager.getPlugins();
      return { success: true, data: plugins };
    } catch (error) {
      logger.error('Failed to list plugins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list plugins',
      };
    }
  });

  // Get installed plugins info
  ipcMain.handle('plugin:list-installed', async (): Promise<IPCResponse<any[]>> => {
    try {
      const installed = await pluginStorage.getInstalledPlugins();
      return { success: true, data: installed };
    } catch (error) {
      logger.error('Failed to list installed plugins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list installed plugins',
      };
    }
  });

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

        await pluginStorage.updatePluginActiveState(pluginId, active);

        return { success: true, data: true };
      } catch (error) {
        logger.error('Failed to toggle plugin:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to toggle plugin',
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
        const config = await pluginStorage.getPluginConfig(pluginId);
        if (!config) {
          const plugin = pluginManager.getPlugin(pluginId);
          if (plugin) {
            return { success: true, data: plugin.config };
          }
          throw new Error('Plugin not found');
        }
        return { success: true, data: config };
      } catch (error) {
        logger.error('Failed to get plugin config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get config',
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
        await pluginStorage.savePluginConfig(params.pluginId, params.config);

        return { success: true, data: true };
      } catch (error) {
        logger.error('Failed to set plugin config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set config',
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
        const startTime = Date.now();
        const result = await pluginManager.executePlugin(params.pluginId, params.context);

        const executionTime = Date.now() - startTime;
        await pluginStorage.updateUsageStats(params.pluginId, executionTime, result.success);

        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin execution failed:', error);

        if (error instanceof Error) {
          await pluginStorage.logPluginError(params.pluginId, error);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed',
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
        const startTime = Date.now();
        const result = await pluginManager.executeBatchPlugin(pluginId, contexts);

        const executionTime = Date.now() - startTime;
        await pluginStorage.updateUsageStats(pluginId, executionTime, result.success);

        return { success: true, data: result };
      } catch (error) {
        logger.error('Plugin batch execution failed:', error);

        if (error instanceof Error) {
          await pluginStorage.logPluginError(pluginId, error);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Batch execution failed',
        };
      }
    }
  );

  // Security scan plugin
  ipcMain.handle(
    'plugin:security-scan',
    async (event: IpcMainInvokeEvent, pluginPath: string): Promise<IPCResponse<any>> => {
      try {
        const report = await pluginSecurity.scanPlugin(pluginPath);
        return { success: true, data: report };
      } catch (error) {
        logger.error('Security scan failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Security scan failed',
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
          error: error instanceof Error ? error.message : 'Failed to get details',
        };
      }
    }
  );

  // Get plugin usage statistics
  ipcMain.handle(
    'plugin:get-usage-stats',
    async (event: IpcMainInvokeEvent, pluginId?: string): Promise<IPCResponse<any>> => {
      try {
        if (pluginId) {
          const stats = await pluginStorage.getUsageStats(pluginId);
          return { success: true, data: stats };
        } else {
          const stats = await pluginStorage.getOverallStats();
          return { success: true, data: stats };
        }
      } catch (error) {
        logger.error('Failed to get usage stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stats',
        };
      }
    }
  );

  // Get plugin errors
  ipcMain.handle(
    'plugin:get-errors',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string,
      limit?: number
    ): Promise<IPCResponse<any[]>> => {
      try {
        const errors = await pluginStorage.getRecentErrors(pluginId, limit);
        return { success: true, data: errors };
      } catch (error) {
        logger.error('Failed to get plugin errors:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get errors',
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
    'plugin:get-usage-stats',
    'plugin:get-errors',
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }

  // Close storage
  pluginStorage.close().catch(error => {
    logger.error('Failed to close plugin storage:', error);
  });

  logger.info('Plugin IPC handlers cleaned up');
}
