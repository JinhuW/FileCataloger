/**
 * @file useExternalPlugins.ts
 * @description React hook for accessing external plugins that provide rename components
 */

import { useState, useEffect, useCallback } from 'react';
import { LoadedPlugin, NamingPlugin } from '@shared/types';
import { logger } from '@shared/logger';

export interface ExternalPluginComponent {
  type: string;
  label: string;
  icon: string;
  pluginId: string;
  description?: string;
  config?: Record<string, any>;
}

/**
 * Hook for managing external rename component plugins
 */
export function useExternalPlugins() {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [components, setComponents] = useState<ExternalPluginComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load external plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all plugins (built-in and external)
      const allPlugins = await window.api.invoke('pattern:get-plugins');

      // CRITICAL FIX: Ensure allPlugins is an array to prevent memory leak
      if (!Array.isArray(allPlugins)) {
        console.warn('allPlugins is not an array:', typeof allPlugins, allPlugins);
        setPlugins([]);
        setComponents([]);
        return;
      }

      // Filter for external plugins that provide rename components
      const externalRenamePlugins = allPlugins.filter((plugin: LoadedPlugin) => {
        return plugin.isExternal && plugin.enabled && (plugin.plugin as NamingPlugin).component;
      });

      setPlugins(externalRenamePlugins);

      // Extract components from plugins
      const extractedComponents: ExternalPluginComponent[] = externalRenamePlugins.map(plugin => {
        const namingPlugin = plugin.plugin as NamingPlugin;
        return {
          type: `plugin:${plugin.plugin.id}`,
          label: namingPlugin.metadata.name,
          icon: namingPlugin.metadata.icon || '🔌',
          pluginId: plugin.plugin.id,
          description: namingPlugin.metadata.description,
          config: plugin.config,
        };
      });

      setComponents(extractedComponents);
      logger.info('Loaded external plugin components:', extractedComponents);
    } catch (err) {
      logger.error('Failed to load external plugins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute a plugin component
  const executePlugin = useCallback(
    async (
      pluginId: string,
      filename: string,
      extension: string,
      index: number,
      config?: Record<string, any>
    ): Promise<string> => {
      try {
        const result = await window.api.invoke('pattern:execute-plugin', {
          pluginId,
          context: {
            filename,
            extension,
            index,
            config,
          },
        });

        if (result.success) {
          return result.result;
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        logger.error(`Failed to execute plugin ${pluginId}:`, err);
        throw err;
      }
    },
    []
  );

  // Refresh plugins (e.g., after installing new ones)
  const refreshPlugins = useCallback(async () => {
    await loadPlugins();
  }, [loadPlugins]);

  return {
    plugins,
    components,
    isLoading,
    error,
    executePlugin,
    refreshPlugins,
  };
}
