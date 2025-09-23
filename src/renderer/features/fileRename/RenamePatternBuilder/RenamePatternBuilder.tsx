/**
 * @file RenamePatternBuilder.tsx
 * @description Interactive pattern builder for constructing file rename templates using drag-and-drop
 * components. Provides real-time preview and customizable rename patterns with multi-pattern support
 * and persistence.
 *
 * @props {RenameComponent[]} components - Array of rename pattern components in order
 * @props {function} onChange - Callback when pattern components change
 * @props {function} onRename - Callback to execute the rename operation
 * @props {boolean} hasFiles - Whether files are selected for renaming
 *
 * @features
 * - Visual pattern builder with drag-and-drop component arrangement
 * - Five component types: date, fileName, counter, text, project
 * - Real-time preview of pattern with sample values
 * - Tab-based interface for multiple pattern management
 * - Component removal with visual feedback
 * - Rename button with state-dependent styling
 * - Pattern persistence and management (create, rename, delete, duplicate)
 * - Built-in and custom patterns
 * - Loading states and error handling
 *
 * @component-types
 * - date: Current date in YYYYMMDD format
 * - fileName: Original file name (without extension)
 * - counter: Sequential numbering (001, 002, etc.)
 * - text: Custom text input
 * - project: Project name identifier
 *
 * @usage
 * ```tsx
 * <RenamePatternBuilder
 *   components={patternComponents}
 *   onChange={setPatternComponents}
 *   onRename={executeRename}
 *   hasFiles={selectedFiles.length > 0}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RenameComponent, ShelfItem } from '@shared/types';
import { ScrollableTabContainer } from '@renderer/components/layout';
import { PatternTab } from '../PatternTab';
import { AddPatternButton } from '../AddPatternButton';
import { usePatternManager } from '@renderer/hooks/usePatternManager';
import { usePatternStore, useToast } from '@renderer/stores';
import { EmptyState } from '@renderer/components/domain';
import { LoadingSpinner, PatternBuilderSkeleton } from '@renderer/components/primitives';
import {
  PATTERN_VALIDATION,
  PATTERN_COMPONENT_TYPES,
  PATTERN_COMPONENT_LABELS,
  PATTERN_COMPONENT_ICONS,
} from '@renderer/constants/namingPatterns';
import { useExternalPlugins } from '@renderer/hooks/useExternalPlugins';
// import { ComponentPluginBridge } from '@shared/ComponentPluginBridge';

export interface RenamePatternBuilderProps {
  components: RenameComponent[];
  onChange: (components: RenameComponent[]) => void;
  onRename: () => void;
  hasFiles: boolean;
  selectedFiles?: ShelfItem[];
  onDestinationChange?: (path: string) => void;
}

// Component limits from constants
const MAX_COMPONENTS = PATTERN_VALIDATION.MAX_COMPONENTS;
const MAX_PATTERNS = PATTERN_VALIDATION.MAX_PATTERNS;

export const RenamePatternBuilder: React.FC<RenamePatternBuilderProps> = ({
  components,
  onChange,
  onRename,
  hasFiles,
  selectedFiles = [],
  onDestinationChange,
}) => {
  const [destinationPath, setDestinationPath] = useState('');
  const [showNewPatternDialog, setShowNewPatternDialog] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [draggedPatternId, setDraggedPatternId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  // Get external plugin components
  const { components: pluginComponents, isLoading: pluginsLoading } = useExternalPlugins();

  // Initialize ComponentPluginBridge for handling both legacy and plugin components
  // const componentBridge = useMemo(() => new ComponentPluginBridge(), []);
  const {
    patterns,
    activePattern,
    activePatternId,
    patternCount,
    createPattern,
    updatePattern,
    deletePattern,
    setActivePattern,
    error,
  } = usePatternManager();

  const { addComponentToPattern, removeComponentFromPattern } = usePatternStore();

  // Initialize loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Show error toasts
  useEffect(() => {
    if (error) {
      toast.error('Pattern Error', error);
    }
  }, [error, toast]);

  // Get the directory path from the first file
  React.useEffect(() => {
    if (selectedFiles.length > 0) {
      // Use the first file's path, or default to home directory
      const firstFile = selectedFiles[0];
      if (firstFile.path) {
        const pathParts = firstFile.path.split('/');
        pathParts.pop(); // Remove filename
        const initialPath = pathParts.join('/') || '/';
        setDestinationPath(initialPath);
      } else {
        // Default to Downloads directory if no path is available
        // Try to infer username from window location or use a sensible default
        const pathMatch = window.location.pathname.match(/\/Users\/([^/]+)/);
        const username = pathMatch ? pathMatch[1] : 'Downloads';
        const defaultPath = pathMatch ? `/Users/${username}/Downloads` : '~/Downloads';
        setDestinationPath(defaultPath);
      }
    }
  }, [selectedFiles]);

  // Sync components with active pattern
  useEffect(() => {
    if (activePattern && JSON.stringify(activePattern.components) !== JSON.stringify(components)) {
      onChange(activePattern.components);
    }
  }, [activePattern, onChange, components]);

  const handlePathEdit = useCallback(async () => {
    try {
      const selectedPath = await window.api.invoke('dialog:select-folder', destinationPath);
      if (selectedPath) {
        setDestinationPath(selectedPath);
        if (onDestinationChange) {
          onDestinationChange(selectedPath);
        }
      }
    } catch (error) {
      // Failed to open folder dialog
    }
  }, [destinationPath, onDestinationChange]);

  const availableComponents = [
    {
      type: PATTERN_COMPONENT_TYPES.DATE,
      label: PATTERN_COMPONENT_LABELS.date,
      icon: PATTERN_COMPONENT_ICONS.date,
    },
    {
      type: PATTERN_COMPONENT_TYPES.FILE_NAME,
      label: PATTERN_COMPONENT_LABELS.fileName,
      icon: PATTERN_COMPONENT_ICONS.fileName,
    },
    {
      type: PATTERN_COMPONENT_TYPES.COUNTER,
      label: PATTERN_COMPONENT_LABELS.counter,
      icon: PATTERN_COMPONENT_ICONS.counter,
    },
    {
      type: PATTERN_COMPONENT_TYPES.TEXT,
      label: PATTERN_COMPONENT_LABELS.text,
      icon: PATTERN_COMPONENT_ICONS.text,
    },
    {
      type: PATTERN_COMPONENT_TYPES.PROJECT,
      label: PATTERN_COMPONENT_LABELS.project,
      icon: PATTERN_COMPONENT_ICONS.project,
    },
    // Add external plugin components
    ...pluginComponents.map(plugin => ({
      type: plugin.type,
      label: plugin.label,
      icon: plugin.icon,
      pluginId: plugin.pluginId,
      description: plugin.description,
    })),
  ];

  const addComponent = useCallback(
    (type: RenameComponent['type'], pluginInfo?: { pluginId: string; description?: string }) => {
      if (!activePattern || components.length >= MAX_COMPONENTS) {
        // Maximum component limit reached
        return;
      }

      const newComponent: RenameComponent = {
        id: `${type}-${Date.now()}`,
        type,
        value: type === 'text' ? 'New Text' : undefined,
        format: type === 'date' ? 'YYYYMMDD' : undefined,
        pluginId: pluginInfo?.pluginId,
        config: pluginInfo ? {} : undefined,
      };

      addComponentToPattern(activePattern.id, newComponent);
    },
    [activePattern, components.length, addComponentToPattern]
  );

  const removeComponent = useCallback(
    (id: string) => {
      if (!activePattern) return;
      removeComponentFromPattern(activePattern.id, id);
    },
    [activePattern, removeComponentFromPattern]
  );

  const handleCreatePattern = useCallback(async () => {
    if (newPatternName.trim()) {
      setIsSaving(true);
      try {
        await createPattern(newPatternName.trim());
        setNewPatternName('');
        setShowNewPatternDialog(false);
        toast.success('Pattern Created', `"${newPatternName.trim()}" has been created`);
      } catch (error) {
        toast.error('Failed to Create Pattern', 'Please try again');
      } finally {
        setIsSaving(false);
      }
    }
  }, [newPatternName, createPattern, toast]);

  const handleRenamePattern = useCallback(
    async (patternId: string, newName: string) => {
      try {
        await updatePattern(patternId, { name: newName });
        toast.success('Pattern Renamed', 'Pattern has been renamed successfully');
      } catch (error) {
        toast.error('Failed to Rename Pattern', 'Please try again');
      }
    },
    [updatePattern, toast]
  );

  const handleDeletePattern = useCallback(
    async (patternId: string) => {
      if (window.confirm('Are you sure you want to delete this pattern?')) {
        try {
          await deletePattern(patternId);
          toast.success('Pattern Deleted', 'Pattern has been deleted successfully');
        } catch (error) {
          toast.error('Failed to Delete Pattern', 'Please try again');
        }
      }
    },
    [deletePattern, toast]
  );

  const handleDragStart = useCallback((e: React.DragEvent, patternId: string) => {
    setDraggedPatternId(patternId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedPatternId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPatternId: string) => {
      e.preventDefault();
      if (draggedPatternId && draggedPatternId !== targetPatternId) {
        const store = usePatternStore.getState();
        store.reorderPatterns(draggedPatternId, targetPatternId);
      }
      setDraggedPatternId(null);
    },
    [draggedPatternId]
  );

  // For future use: updating component values
  // const updateComponent = useCallback((id: string, updates: Partial<RenameComponent>) => {
  //   onChange(components.map(c => c.id === id ? { ...c, ...updates } : c));
  // }, [components, onChange]);

  if (isLoading || pluginsLoading) {
    return <PatternBuilderSkeleton />;
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        position: 'relative',
      }}
    >
      {/* Header with scrollable tabs */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h3
            style={{
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Naming Pattern
          </h3>
          {isSaving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LoadingSpinner size="small" />
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Saving...</span>
            </div>
          )}
        </div>

        <ScrollableTabContainer>
          {patterns.map(pattern => (
            <PatternTab
              key={pattern.id}
              id={pattern.id}
              name={pattern.name}
              active={pattern.id === activePatternId}
              editable={!pattern.isBuiltIn}
              isDragging={draggedPatternId === pattern.id}
              onClick={() => setActivePattern(pattern.id)}
              onClose={() => handleDeletePattern(pattern.id)}
              onRename={newName => handleRenamePattern(pattern.id, newName)}
              onDragStart={e => handleDragStart(e, pattern.id)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, pattern.id)}
            />
          ))}
          <AddPatternButton
            onClick={() => setShowNewPatternDialog(true)}
            disabled={patternCount >= MAX_PATTERNS}
            maxReached={patternCount >= MAX_PATTERNS}
          />
        </ScrollableTabContainer>
      </div>

      {/* Pattern Builder Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Current Pattern */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '16px',
            minHeight: '120px',
            maxHeight: '200px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              minHeight: '88px',
              maxHeight: '168px',
              alignItems: components.length === 0 ? 'center' : 'flex-start',
              alignContent: components.length === 0 ? 'center' : 'flex-start',
              justifyContent: components.length === 0 ? 'center' : 'flex-start',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            {components.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No pattern components"
                description="Click components below to build your pattern"
                style={{ width: '100%' }}
              />
            ) : (
              components.map((component, index) => (
                <motion.div
                  key={component.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {index > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>_</span>}
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        color: '#3b82f6',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {component.type === PATTERN_COMPONENT_TYPES.DATE && '20250917'}
                      {component.type === PATTERN_COMPONENT_TYPES.FILE_NAME &&
                        (component.value || 'File Name')}
                      {component.type === PATTERN_COMPONENT_TYPES.COUNTER && '001'}
                      {component.type === PATTERN_COMPONENT_TYPES.TEXT &&
                        (component.value || 'Text')}
                      {component.type === PATTERN_COMPONENT_TYPES.PROJECT &&
                        (component.value || 'Project')}
                      {component.type.startsWith('plugin:') &&
                        (component.value || component.type.split(':')[1])}
                    </span>
                    <button
                      onClick={() => removeComponent(component.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '10px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={activePattern?.isBuiltIn}
                      aria-label="Remove component"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Available Components */}
        <div>
          <h4
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 600,
              margin: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Available Components
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
            }}
          >
            {availableComponents.map(comp => (
              <button
                key={comp.type}
                onClick={() =>
                  addComponent(
                    comp.type as RenameComponent['type'],
                    comp.pluginId
                      ? { pluginId: comp.pluginId, description: comp.description }
                      : undefined
                  )
                }
                disabled={components.length >= MAX_COMPONENTS || activePattern?.isBuiltIn}
                title={comp.description}
                style={{
                  background:
                    components.length >= MAX_COMPONENTS || activePattern?.isBuiltIn
                      ? 'rgba(255, 255, 255, 0.02)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '8px',
                  color:
                    components.length >= MAX_COMPONENTS || activePattern?.isBuiltIn
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'rgba(255, 255, 255, 0.8)',
                  cursor:
                    components.length >= MAX_COMPONENTS || activePattern?.isBuiltIn
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    components.length >= MAX_COMPONENTS || activePattern?.isBuiltIn ? 0.5 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                }}
                onMouseEnter={e => {
                  if (components.length < MAX_COMPONENTS && !activePattern?.isBuiltIn) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
                onMouseLeave={e => {
                  if (components.length < MAX_COMPONENTS && !activePattern?.isBuiltIn) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                aria-label={`Add ${comp.label} component`}
              >
                <span>{comp.icon}</span>
                <span>{comp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Info */}
        {activePattern && activePattern.isBuiltIn && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <p style={{ margin: 0 }}>
              This is a built-in pattern. Create a custom pattern to edit components.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Path Display */}
        {destinationPath && (
          <div
            style={{
              flex: 1,
              position: 'relative',
              minWidth: 0, // Important for text truncation
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
                minWidth: 0,
                minHeight: '44px',
                maxHeight: '80px', // Allow up to ~3 lines
              }}
              title={destinationPath}
              onClick={handlePathEdit}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {/* Folder Icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  flexShrink: 0,
                  marginTop: '2px', // Align with first line of text
                }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>

              {/* Path segments */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  overflow: 'hidden',
                  flex: 1,
                  minWidth: 0,
                  wordBreak: 'break-all',
                  lineHeight: '20px',
                }}
              >
                {(() => {
                  const segments = destinationPath.split('/').filter(Boolean);

                  return segments.map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <span
                        style={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '12px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {segment}
                      </span>
                      {index < array.length - 1 && (
                        <span
                          style={{
                            color: 'rgba(255, 255, 255, 0.3)',
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          ›
                        </span>
                      )}
                    </React.Fragment>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onRename}
          disabled={!hasFiles || components.length === 0}
          style={{
            background: hasFiles && components.length > 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: hasFiles && components.length > 0 ? '#fff' : 'rgba(255, 255, 255, 0.3)',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasFiles && components.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          aria-label="Save and rename files"
        >
          Save
        </button>
      </div>

      {/* New Pattern Dialog */}
      {showNewPatternDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowNewPatternDialog(false)}
        >
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: '#fff', marginTop: 0 }}>Create New Pattern</h3>
            <input
              type="text"
              placeholder="Pattern name"
              value={newPatternName}
              onChange={e => setNewPatternName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCreatePattern();
                } else if (e.key === 'Escape') {
                  setShowNewPatternDialog(false);
                  setNewPatternName('');
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                marginBottom: '16px',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowNewPatternDialog(false);
                  setNewPatternName('');
                }}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePattern}
                disabled={!newPatternName.trim()}
                style={{
                  padding: '8px 16px',
                  background: newPatternName.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: newPatternName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
