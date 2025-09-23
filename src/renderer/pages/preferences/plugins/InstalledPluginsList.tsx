import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle } from '@renderer/components/primitives';
import { useToast } from '@renderer/stores';
import { logger } from '@shared/logger';
import { LoadedPlugin } from '@shared/types/plugins';

interface InstalledPluginsListProps {
  onToggle: (pluginId: string, active: boolean) => Promise<void>;
  onUninstall: (pluginId: string) => Promise<void>;
  onConfigure: (pluginId: string) => void;
  onRefresh?: () => Promise<void>;
}

export const InstalledPluginsList: React.FC<InstalledPluginsListProps> = ({
  onToggle,
  onUninstall,
  onConfigure,
  onRefresh,
}) => {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlugin, setProcessingPlugin] = useState<string | null>(null);
  const toast = useToast();

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.api.invoke('plugin:list');

      if (response.success) {
        setPlugins(response.data);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      logger.error('Failed to load plugins:', error);
      toast.showError('Load Failed', 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleToggle = async (pluginId: string, active: boolean) => {
    setProcessingPlugin(pluginId);
    try {
      await onToggle(pluginId, active);
      // Update local state
      setPlugins(plugins.map(p => (p.plugin.id === pluginId ? { ...p, isActive: active } : p)));
    } catch (error) {
      logger.error('Failed to toggle plugin:', error);
      toast.showError('Toggle Failed', 'Failed to toggle plugin');
    } finally {
      setProcessingPlugin(null);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    const plugin = plugins.find(p => p.plugin.id === pluginId);
    if (!plugin) return;

    const confirmed = await window.api.invoke('dialog:show-message-box', {
      type: 'warning',
      title: 'Uninstall Plugin',
      message: `Are you sure you want to uninstall "${plugin.plugin.name}"?`,
      detail: 'This action cannot be undone.',
      buttons: ['Cancel', 'Uninstall'],
      defaultId: 0,
      cancelId: 0,
    });

    if (confirmed.response === 1) {
      setProcessingPlugin(pluginId);
      try {
        await onUninstall(pluginId);
        // Remove from local state
        setPlugins(plugins.filter(p => p.plugin.id !== pluginId));
        toast.showSuccess('Plugin Uninstalled', `Successfully uninstalled ${plugin.plugin.name}`);
      } catch (error) {
        logger.error('Failed to uninstall plugin:', error);
        toast.showError('Uninstall Failed', 'Failed to uninstall plugin');
      } finally {
        setProcessingPlugin(null);
      }
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPluginIcon = (plugin: LoadedPlugin): string => {
    return plugin.plugin.icon || '🔌';
  };

  // const isBuiltIn = (plugin: LoadedPlugin): boolean => {
  //   return !plugin.isExternal;
  // };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading plugins...</div>
      </div>
    );
  }

  const externalPlugins = plugins.filter(p => p.isExternal);
  const builtInPlugins = plugins.filter(p => !p.isExternal);

  return (
    <div className="installed-plugins">
      {/* External Plugins */}
      {externalPlugins.length > 0 && (
        <div className="plugin-section">
          <h3 className="section-title">Installed Plugins</h3>
          <AnimatePresence>
            {externalPlugins.map(plugin => (
              <motion.div
                key={plugin.plugin.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="plugin-item"
              >
                <div className="plugin-icon">{getPluginIcon(plugin)}</div>
                <div className="plugin-details">
                  <div className="plugin-header">
                    <h4 className="plugin-name">{plugin.plugin.name}</h4>
                    <span className="plugin-version">v{plugin.plugin.version}</span>
                  </div>
                  <p className="plugin-description">{plugin.plugin.description}</p>
                  <div className="plugin-meta">
                    <span className="plugin-author">by {plugin.plugin.author.name}</span>
                    <span className="plugin-date">Installed {formatDate(plugin.loadTime)}</span>
                  </div>
                </div>
                <div className="plugin-controls">
                  <Toggle
                    checked={plugin.isActive}
                    onChange={checked => handleToggle(plugin.plugin.id, checked)}
                    disabled={processingPlugin === plugin.plugin.id}
                    label={plugin.isActive ? 'Active' : 'Inactive'}
                  />
                  <button
                    className="config-button"
                    onClick={() => onConfigure(plugin.plugin.id)}
                    disabled={processingPlugin === plugin.plugin.id}
                  >
                    Configure
                  </button>
                  <button
                    className="uninstall-button"
                    onClick={() => handleUninstall(plugin.plugin.id)}
                    disabled={processingPlugin === plugin.plugin.id}
                  >
                    Uninstall
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Built-in Plugins */}
      <div className="plugin-section">
        <h3 className="section-title">Built-in Plugins</h3>
        <AnimatePresence>
          {builtInPlugins.map(plugin => (
            <motion.div
              key={plugin.plugin.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="plugin-item built-in"
            >
              <div className="plugin-icon">{getPluginIcon(plugin)}</div>
              <div className="plugin-details">
                <div className="plugin-header">
                  <h4 className="plugin-name">{plugin.plugin.name}</h4>
                  <span className="plugin-version">v{plugin.plugin.version}</span>
                  <span className="built-in-badge">Built-in</span>
                </div>
                <p className="plugin-description">{plugin.plugin.description}</p>
                <div className="plugin-meta">
                  <span className="plugin-author">by {plugin.plugin.author.name}</span>
                </div>
              </div>
              <div className="plugin-controls">
                <Toggle
                  checked={plugin.isActive}
                  onChange={checked => handleToggle(plugin.plugin.id, checked)}
                  disabled={processingPlugin === plugin.plugin.id}
                  label={plugin.isActive ? 'Active' : 'Inactive'}
                />
                <button
                  className="config-button"
                  onClick={() => onConfigure(plugin.plugin.id)}
                  disabled={processingPlugin === plugin.plugin.id}
                >
                  Configure
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Refresh Button */}
      {onRefresh && (
        <button className="refresh-button" onClick={onRefresh}>
          Refresh Plugin List
        </button>
      )}

      <style>{`
        .installed-plugins {
          margin-top: 24px;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: rgba(255, 255, 255, 0.6);
        }

        .plugin-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 16px;
        }

        .plugin-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          margin-bottom: 12px;
          transition: all 0.2s;
        }

        .plugin-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .plugin-item.built-in {
          background: rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .plugin-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .plugin-details {
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

        .built-in-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          color: #60a5fa;
        }

        .plugin-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 8px;
          line-height: 1.4;
        }

        .plugin-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .plugin-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .config-button,
        .uninstall-button {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .config-button:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .uninstall-button {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .uninstall-button:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .config-button:disabled,
        .uninstall-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .refresh-button {
          margin-top: 16px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-button:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
};
