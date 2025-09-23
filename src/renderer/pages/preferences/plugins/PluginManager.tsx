import React, { useState, useCallback } from 'react';
import { PluginSearch } from './PluginSearch';
import { InstalledPluginsList } from './InstalledPluginsList';
import { PluginConfigDialog } from './PluginConfigDialog';
import { useToast } from '@renderer/stores';
import { logger } from '@shared/logger';

export const PluginManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'installed'>('installed');
  const [configurePluginId, setConfigurePluginId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<any | null>(null);
  const toast = useToast();

  // Listen for installation progress
  React.useEffect(() => {
    const handleProgress = (progress: any) => {
      setInstallProgress(progress);
    };

    const cleanup = window.api.on('plugin:install-progress', handleProgress);

    return cleanup;
  }, []);

  const handleInstall = useCallback(
    async (packageName: string, version?: string) => {
      try {
        const response = await window.api.invoke('plugin:install', {
          packageName,
          version,
          activate: true,
        });

        if (response.success) {
          toast.showSuccess('Plugin Installed', `Successfully installed ${packageName}`);
          setActiveTab('installed'); // Switch to installed tab
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        logger.error('Plugin installation failed:', error);
        toast.showError('Installation Failed', error.message || 'Failed to install plugin');
        throw error;
      } finally {
        setInstallProgress(null);
      }
    },
    [toast]
  );

  const handleToggle = useCallback(
    async (pluginId: string, active: boolean) => {
      const response = await window.api.invoke('plugin:toggle', pluginId, active);

      if (!response.success) {
        throw new Error(response.error);
      }

      toast.showSuccess(
        active ? 'Plugin Activated' : 'Plugin Deactivated',
        `Plugin ${pluginId} is now ${active ? 'active' : 'inactive'}`
      );
    },
    [toast]
  );

  const handleUninstall = useCallback(async (pluginId: string) => {
    const response = await window.api.invoke('plugin:uninstall', pluginId);

    if (!response.success) {
      throw new Error(response.error);
    }
  }, []);

  const handleConfigure = useCallback((pluginId: string) => {
    setConfigurePluginId(pluginId);
  }, []);

  const handleSaveConfig = useCallback(async (pluginId: string, config: Record<string, any>) => {
    const response = await window.api.invoke('plugin:set-config', {
      pluginId,
      config,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    // Force reload of plugin list
    window.location.reload();
  }, []);

  return (
    <div className="plugin-manager">
      <h2 className="manager-title">Plugin Manager</h2>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          Installed Plugins
        </button>
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Browse Plugins
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'search' ? (
          <PluginSearch onInstall={handleInstall} />
        ) : (
          <InstalledPluginsList
            onToggle={handleToggle}
            onUninstall={handleUninstall}
            onConfigure={handleConfigure}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* Installation Progress */}
      {installProgress && (
        <div className="install-progress">
          <div className="progress-header">
            <span className="progress-stage">{installProgress.stage}</span>
            <span className="progress-message">{installProgress.message}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${installProgress.progress}%` }} />
          </div>
        </div>
      )}

      {/* Configuration Dialog */}
      <PluginConfigDialog
        pluginId={configurePluginId}
        onClose={() => setConfigurePluginId(null)}
        onSave={handleSaveConfig}
      />

      <style>{`
        .plugin-manager {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .manager-title {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 24px;
        }

        .tab-navigation {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px;
          border-radius: 8px;
        }

        .tab-button {
          flex: 1;
          padding: 10px 20px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-button:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        .tab-button.active {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .tab-content {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 24px;
          min-height: 400px;
        }

        .install-progress {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 16px;
          min-width: 300px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-stage {
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          text-transform: uppercase;
        }

        .progress-message {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }

        .progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
};
