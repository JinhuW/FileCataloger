/**
 * Plugin API wrapper for renderer process
 * Provides typed methods for plugin operations via IPC
 */

import { logger } from '@shared/logger';
import { LoadedPlugin, PluginContext, PluginExecutionResult } from '@shared/types/plugins';

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

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class PluginAPI {
  async search(params: PluginSearchParams): Promise<IPCResponse<any[]>> {
    try {
      return await window.api.invoke('plugin:search', params);
    } catch (error) {
      logger.error('Plugin search failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }

  async install(params: PluginInstallParams): Promise<IPCResponse<any>> {
    try {
      return await window.api.invoke('plugin:install', params);
    } catch (error) {
      logger.error('Plugin install failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Install failed',
      };
    }
  }

  async uninstall(pluginId: string): Promise<IPCResponse<boolean>> {
    try {
      return await window.api.invoke('plugin:uninstall', pluginId);
    } catch (error) {
      logger.error('Plugin uninstall failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Uninstall failed',
      };
    }
  }

  async list(): Promise<IPCResponse<LoadedPlugin[]>> {
    try {
      return await window.api.invoke('plugin:list');
    } catch (error) {
      logger.error('Failed to list plugins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list plugins',
      };
    }
  }

  async listInstalled(): Promise<IPCResponse<any[]>> {
    try {
      return await window.api.invoke('plugin:list-installed');
    } catch (error) {
      logger.error('Failed to list installed plugins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list installed plugins',
      };
    }
  }

  async toggle(pluginId: string, active: boolean): Promise<IPCResponse<boolean>> {
    try {
      return await window.api.invoke('plugin:toggle', pluginId, active);
    } catch (error) {
      logger.error('Failed to toggle plugin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle plugin',
      };
    }
  }

  async getConfig(pluginId: string): Promise<IPCResponse<Record<string, any>>> {
    try {
      return await window.api.invoke('plugin:get-config', pluginId);
    } catch (error) {
      logger.error('Failed to get plugin config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config',
      };
    }
  }

  async setConfig(params: PluginConfigParams): Promise<IPCResponse<boolean>> {
    try {
      return await window.api.invoke('plugin:set-config', params);
    } catch (error) {
      logger.error('Failed to set plugin config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set config',
      };
    }
  }

  async execute(params: PluginExecuteParams): Promise<IPCResponse<PluginExecutionResult>> {
    try {
      return await window.api.invoke('plugin:execute', params);
    } catch (error) {
      logger.error('Plugin execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  async executeBatch(
    pluginId: string,
    contexts: PluginContext[]
  ): Promise<IPCResponse<PluginExecutionResult>> {
    try {
      return await window.api.invoke('plugin:execute-batch', pluginId, contexts);
    } catch (error) {
      logger.error('Plugin batch execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch execution failed',
      };
    }
  }

  async getDetails(pluginId: string): Promise<IPCResponse<LoadedPlugin | null>> {
    try {
      return await window.api.invoke('plugin:get-details', pluginId);
    } catch (error) {
      logger.error('Failed to get plugin details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get details',
      };
    }
  }

  on(channel: string, callback: (...args: any[]) => void): () => void {
    if (channel === 'install-progress') {
      return window.api.on('plugin:install-progress', callback);
    }
    throw new Error(`Unknown plugin event channel: ${channel}`);
  }

  off(channel: string, callback: (...args: any[]) => void): void {
    window.api.removeAllListeners(`plugin:${channel}` as any);
  }
}

// Export singleton instance
export const pluginApi = new PluginAPI();
