/**
 * @file RenamePatternBuilderV2.tsx
 * @description Simplified Notion-style pattern builder using meta-component system.
 * Integrates ComponentTypeDropdown, QuickCreatePopover, ComponentChip, and ComponentBrowserDialog
 * for a streamlined component creation and pattern building experience.
 *
 * @features
 * - Inline component selection via dropdown
 * - Quick component creation (2-3 fields only)
 * - Component library browsing
 * - Drag-and-drop component arrangement
 * - Instance-level configuration
 * - Live preview of renamed files
 * - Pattern persistence
 */

import React, { useState, useCallback, useEffect } from 'react';
import { ShelfItem } from '@shared/types';
import { ComponentType, ComponentInstance } from '@shared/types/componentDefinition';
import { ScrollableTabContainer } from '@renderer/components/layout';
import { PatternTab } from '../PatternTab';
import { AddPatternButton } from '../AddPatternButton';
import { usePatternManager } from '@renderer/hooks/usePatternManager';
import { usePatternStore, useToast } from '@renderer/stores';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';
import { EmptyState } from '@renderer/components/domain';
import { LoadingSpinner, PatternBuilderSkeleton } from '@renderer/components/primitives';
import { ComponentTypeDropdown } from './ComponentTypeDropdown';
import { QuickCreatePopover } from './QuickCreatePopover';
import { ComponentChipV2 } from './ComponentChipV2';
import { RecentComponentsList } from './RecentComponentsList';
import { ComponentBrowserDialog } from '../ComponentLibrary/ComponentBrowserDialog';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';

export interface RenamePatternBuilderV2Props {
  hasFiles: boolean;
  selectedFiles?: ShelfItem[];
  onDestinationChange?: (path: string) => void;
  onRename: () => void;
}

const MAX_PATTERNS = PATTERN_VALIDATION.MAX_PATTERNS;

export const RenamePatternBuilderV2: React.FC<RenamePatternBuilderV2Props> = ({
  hasFiles,
  selectedFiles = [],
  onDestinationChange,
  onRename,
}) => {
  const [destinationPath, setDestinationPath] = useState('');
  const [showNewPatternDialog, setShowNewPatternDialog] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [draggedPatternId, setDraggedPatternId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Component selection state
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<ComponentType | null>(null);
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false);

  // Component instances for current pattern
  const [instances, setInstances] = useState<ComponentInstance[]>([]);

  // Force refresh of recent components
  const [refreshKey, setRefreshKey] = useState(0);

  const toast = useToast();
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

  const { getComponent, incrementUsageCount, getRecentComponents } = useComponentLibrary();

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

  // Get destination path from selected files
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const firstFile = selectedFiles[0];
      if (firstFile.path) {
        const pathParts = firstFile.path.split('/');
        pathParts.pop();
        const initialPath = pathParts.join('/') || '/';
        setDestinationPath(initialPath);
      } else {
        const pathMatch = window.location.pathname.match(/\/Users\/([^/]+)/);
        const username = pathMatch ? pathMatch[1] : 'Downloads';
        const defaultPath = pathMatch ? `/Users/${username}/Downloads` : '~/Downloads';
        setDestinationPath(defaultPath);
      }
    }
  }, [selectedFiles]);

  // Sync instances with active pattern
  useEffect(() => {
    if (activePattern?.components) {
      // Convert legacy components to instances if needed
      // For now, we'll start with empty instances
      setInstances([]);
    }
  }, [activePattern]);

  const handlePathEdit = useCallback(async () => {
    try {
      const selectedPath = await window.api.invoke('dialog:select-folder', destinationPath);
      if (selectedPath) {
        setDestinationPath(selectedPath);
        onDestinationChange?.(selectedPath);
      }
    } catch (error) {
      // Failed to open folder dialog
    }
  }, [destinationPath, onDestinationChange]);

  const addComponentInstance = useCallback(
    (componentId: string) => {
      const definition = getComponent(componentId);
      if (!definition) {
        toast.error('Component not found', `Component ${componentId} does not exist`);
        return;
      }

      const newInstance: ComponentInstance = {
        id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        definitionId: componentId,
        name: definition.name, // Cache name from definition
        type: definition.type, // Cache type from definition
        value: undefined,
        overrides: {},
      };

      setInstances(prev => [...prev, newInstance]);
      incrementUsageCount(componentId);
    },
    [getComponent, incrementUsageCount, toast]
  );

  const handleSelectType = useCallback(
    (selection: ComponentType | string) => {
      if (
        selection === 'text' ||
        selection === 'select' ||
        selection === 'date' ||
        selection === 'number'
      ) {
        // Basic type - show quick create to add to library
        setQuickCreateType(selection as ComponentType);
        setShowTypeDropdown(false);
      } else if (selection === 'browse') {
        // Open library browser
        setShowLibraryBrowser(true);
        setShowTypeDropdown(false);
      } else if (selection === 'create') {
        // Open full creation modal (can implement later)
        toast.info('Full creation modal coming soon!');
        setShowTypeDropdown(false);
      } else {
        // Existing component ID from "MY COMPONENTS" - add to pattern
        addComponentInstance(selection);
        setShowTypeDropdown(false);
      }
    },
    [addComponentInstance, toast]
  );

  const handleQuickCreateComplete = useCallback(
    (_componentId: string) => {
      // Component is created and saved to library
      // User can now click/drag it from Recent Components to add it to pattern
      setQuickCreateType(null);
      setRefreshKey(prev => prev + 1); // Force refresh of recent components list
      toast.success('Component Created', 'Click or drag the component to add it to your pattern');
    },
    [toast]
  );

  const removeInstance = useCallback((instanceId: string) => {
    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
  }, []);

  const updateInstance = useCallback((instanceId: string, updates: Partial<ComponentInstance>) => {
    setInstances(prev =>
      prev.map(inst => (inst.id === instanceId ? { ...inst, ...updates } : inst))
    );
  }, []);

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

  if (isLoading) {
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
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
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
              onDragStart={_e => setDraggedPatternId(pattern.id)}
              onDragEnd={() => setDraggedPatternId(null)}
              onDragOver={_e => _e.preventDefault()}
              onDrop={_e => {
                _e.preventDefault();
                if (draggedPatternId && draggedPatternId !== pattern.id) {
                  const store = usePatternStore.getState();
                  store.reorderPatterns(draggedPatternId, pattern.id);
                }
                setDraggedPatternId(null);
              }}
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
          overflow: 'visible',
        }}
      >
        {/* Current Pattern */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            minHeight: '80px',
            maxHeight: '120px',
            overflow: instances.length > 6 ? 'auto' : 'hidden',
            position: 'relative',
          }}
          onDragOver={e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={e => {
            e.preventDefault();
            const componentId = e.dataTransfer.getData('componentId');
            if (componentId) {
              addComponentInstance(componentId);
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: instances.length === 0 ? 'center' : 'flex-start',
              alignContent: instances.length === 0 ? 'center' : 'flex-start',
              justifyContent: instances.length === 0 ? 'center' : 'flex-start',
              minHeight: '88px',
            }}
          >
            {instances.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No components yet"
                description="Click [+ Add Component] below to start building your pattern"
                style={{ width: '100%' }}
              />
            ) : (
              instances.map((instance, index) => {
                const definition = getComponent(instance.definitionId);
                if (!definition) return null;

                return (
                  <React.Fragment key={instance.id}>
                    {index > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>_</span>}
                    <ComponentChipV2
                      instance={instance}
                      definition={definition}
                      onRemove={() => removeInstance(instance.id)}
                      onUpdateInstance={updates => updateInstance(instance.id, updates)}
                      canDrag={!activePattern?.isBuiltIn}
                    />
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Add Component Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={_e => {
              _e.stopPropagation();
              setShowTypeDropdown(!showTypeDropdown);
            }}
            disabled={activePattern?.isBuiltIn}
            style={{
              width: '100%',
              background: activePattern?.isBuiltIn
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: activePattern?.isBuiltIn
                ? 'rgba(255, 255, 255, 0.3)'
                : 'rgba(255, 255, 255, 0.8)',
              cursor: activePattern?.isBuiltIn ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (!activePattern?.isBuiltIn) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }
            }}
            onMouseLeave={e => {
              if (!activePattern?.isBuiltIn) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
          >
            + Add Component ▼
          </button>

          <ComponentTypeDropdown
            isOpen={showTypeDropdown}
            onClose={() => setShowTypeDropdown(false)}
            onSelect={handleSelectType}
          />
        </div>

        {/* Recent Components Section */}
        <div>
          {/* Title outside the box */}
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '10px',
              fontWeight: 600,
              padding: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Recent Components ({getRecentComponents(9).length})
          </div>

          {/* Components grid */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '280px',
              overflow: 'auto',
            }}
          >
            <RecentComponentsList
              key={refreshKey}
              recentComponents={getRecentComponents(9)}
              onSelectComponent={addComponentInstance}
              onSettingsClick={componentId => {
                toast.info('Component Settings', `Editing component: ${componentId}`);
                // TODO: Implement component editing modal
              }}
              showTitle={false}
            />
          </div>
        </div>

        {/* Pattern Info */}
        {activePattern?.isBuiltIn && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <p style={{ margin: 0 }}>
              This is a built-in pattern. Create a custom pattern to add components.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          marginTop: '16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Path Display */}
        {destinationPath && (
          <div style={{ flex: 1, minWidth: 0 }}>
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
                maxHeight: '80px',
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
                  marginTop: '2px',
                }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>

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
                {destinationPath
                  .split('/')
                  .filter(Boolean)
                  .map((segment, index, array) => (
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
                  ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onRename}
          disabled={!hasFiles || instances.length === 0}
          style={{
            background: hasFiles && instances.length > 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: hasFiles && instances.length > 0 ? '#fff' : 'rgba(255, 255, 255, 0.3)',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasFiles && instances.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          aria-label="Save and rename files"
        >
          Save
        </button>
      </div>

      {/* Modals */}
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

      <QuickCreatePopover
        type={quickCreateType!}
        isOpen={!!quickCreateType}
        onClose={() => setQuickCreateType(null)}
        onCreated={handleQuickCreateComplete}
      />

      <ComponentBrowserDialog
        isOpen={showLibraryBrowser}
        onClose={() => setShowLibraryBrowser(false)}
        onSelect={componentId => {
          addComponentInstance(componentId);
          setShowLibraryBrowser(false);
        }}
        onCreateNew={() => {
          setShowLibraryBrowser(false);
          toast.info('Create new component', 'Full creation modal coming soon!');
        }}
      />
    </div>
  );
};
