import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@renderer/stores';
import { logger } from '@shared/logger';
import { LoadedPlugin } from '@shared/types/plugins';

interface PluginConfigDialogProps {
  pluginId: string | null;
  onClose: () => void;
  onSave: (pluginId: string, config: Record<string, any>) => Promise<void>;
}

export const PluginConfigDialog: React.FC<PluginConfigDialogProps> = ({
  pluginId,
  onClose,
  onSave,
}) => {
  const [plugin, setPlugin] = useState<LoadedPlugin | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const loadPlugin = useCallback(async () => {
    if (!pluginId) return;

    try {
      setLoading(true);

      // Get plugin details
      const detailsResponse = await window.api.invoke('plugin:get-details', pluginId);
      if (!detailsResponse.success) {
        throw new Error(detailsResponse.error);
      }

      setPlugin(detailsResponse.data);

      // Get plugin config
      const configResponse = await window.api.invoke('plugin:get-config', pluginId);
      if (configResponse.success) {
        setConfig(configResponse.data || {});
      }
    } catch (error) {
      logger.error('Failed to load plugin:', error);
      toast.showError('Load Failed', 'Failed to load plugin configuration');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [pluginId, onClose, toast]);

  useEffect(() => {
    if (pluginId) {
      loadPlugin();
    }
  }, [pluginId, loadPlugin]);

  const handleSave = async () => {
    if (!pluginId || !plugin) return;

    setSaving(true);
    try {
      await onSave(pluginId, config);
      toast.showSuccess('Saved', 'Plugin configuration saved successfully');
      onClose();
    } catch (error) {
      logger.error('Failed to save config:', error);
      toast.showError('Save Failed', 'Failed to save plugin configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderConfigField = (key: string, value: any) => {
    const type = typeof value;

    if (type === 'boolean') {
      return (
        <label className="config-field">
          <span className="field-label">{key}:</span>
          <input
            type="checkbox"
            checked={value}
            onChange={e => handleConfigChange(key, e.target.checked)}
            className="checkbox-input"
          />
        </label>
      );
    }

    if (type === 'number') {
      return (
        <label className="config-field">
          <span className="field-label">{key}:</span>
          <input
            type="number"
            value={value}
            onChange={e => handleConfigChange(key, parseFloat(e.target.value))}
            className="number-input"
          />
        </label>
      );
    }

    // Default to text input
    return (
      <label className="config-field">
        <span className="field-label">{key}:</span>
        <input
          type="text"
          value={String(value)}
          onChange={e => handleConfigChange(key, e.target.value)}
          className="text-input"
        />
      </label>
    );
  };

  if (!pluginId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="dialog-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="dialog-container"
          onClick={e => e.stopPropagation()}
        >
          {loading ? (
            <div className="loading-state">
              <div className="spinner">Loading...</div>
            </div>
          ) : plugin ? (
            <>
              <div className="dialog-header">
                <h2 className="dialog-title">
                  {plugin.plugin.icon} {plugin.plugin.name} Configuration
                </h2>
                <button className="close-button" onClick={onClose}>
                  ×
                </button>
              </div>

              <div className="dialog-content">
                {plugin.plugin.configSchema ? (
                  <div className="config-form">
                    <p className="config-description">
                      Configure the settings for this plugin below:
                    </p>
                    {Object.entries(config).map(([key, value]) => (
                      <div key={key}>{renderConfigField(key, value)}</div>
                    ))}
                    {Object.keys(config).length === 0 && (
                      <p className="no-config">This plugin has no configurable options.</p>
                    )}
                  </div>
                ) : (
                  <p className="no-config">This plugin does not support configuration.</p>
                )}
              </div>

              <div className="dialog-footer">
                <button className="cancel-button" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="save-button"
                  onClick={handleSave}
                  disabled={saving || !plugin.plugin.configSchema}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <div className="error-state">
              <p>Failed to load plugin</p>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style>{`
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .dialog-container {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dialog-title {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .close-button {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .dialog-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .config-description {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 20px;
        }

        .config-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .field-label {
          font-size: 14px;
          color: #fff;
          text-transform: capitalize;
        }

        .text-input,
        .number-input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          width: 200px;
        }

        .text-input:focus,
        .number-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: #3b82f6;
        }

        .checkbox-input {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .no-config {
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          padding: 40px 20px;
        }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cancel-button,
        .save-button {
          padding: 8px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-button {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .save-button {
          background: #3b82f6;
          color: #fff;
        }

        .save-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .cancel-button:disabled,
        .save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-state,
        .error-state {
          padding: 60px 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </AnimatePresence>
  );
};
