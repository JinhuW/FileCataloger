/**
 * @file RenamePatternBuilder.tsx
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

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { ComponentEditDialog } from './ComponentEditDialog';
import { ComponentChip } from './ComponentChip';
import { MetadataComponentsGrid } from './MetadataComponentsGrid';
import { ComponentBrowserDialog } from '../ComponentLibrary/ComponentBrowserDialog';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';
import { generatePrefixedId } from '@renderer/utils/idGenerator';
import { getStorageBoolean, setStorageBoolean } from '@renderer/utils/safeStorage';

export interface RenamePatternBuilderProps {
  hasFiles: boolean;
  selectedFiles?: ShelfItem[];
  onDestinationChange?: (path: string) => void;
  onRename: (instances: ComponentInstance[]) => void;
  onPatternChange?: (instances: ComponentInstance[]) => void;
}

const MAX_PATTERNS = PATTERN_VALIDATION.MAX_PATTERNS;

export const RenamePatternBuilder: React.FC<RenamePatternBuilderProps> = ({
  hasFiles,
  selectedFiles = [],
  onDestinationChange,
  onRename,
  onPatternChange,
}) => {
  const [destinationPath, setDestinationPath] = useState('');
  const [showNewPatternDialog, setShowNewPatternDialog] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [draggedPatternId, setDraggedPatternId] = useState<string | null>(null);
  const [draggedInstanceId, setDraggedInstanceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Component selection state
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<ComponentType | null>(null);
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false);
  const [editComponentId, setEditComponentId] = useState<string | null>(null);

  // Component limit warning dialog
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [dontShowLimitWarning, setDontShowLimitWarning] = useState(() => {
    return getStorageBoolean('hideComponentLimitWarning', false);
  });

  // Component instances for current pattern
  const [instances, setInstances] = useState<ComponentInstance[]>([]);

  // Force refresh of recent components
  const [refreshKey, setRefreshKey] = useState(0);

  // Ref for the Add Component button to position dropdown
  const addComponentButtonRef = useRef<HTMLButtonElement>(null);

  // Ref to track if we're currently syncing from pattern to avoid auto-save loop
  const isSyncingFromPattern = useRef(false);

  // Ref to track the last saved instances to prevent redundant saves
  const lastSavedInstances = useRef<ComponentInstance[]>([]);

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

  // Get reorderPatterns from store for drag-and-drop
  const reorderPatterns = usePatternStore(state => state.reorderPatterns);

  const {
    getComponent,
    incrementUsageCount,
    getRecentComponents,
    userComponents,
    systemComponents,
  } = useComponentLibrary();

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
    // Set flag to indicate we're syncing from pattern (to prevent auto-save loop)
    isSyncingFromPattern.current = true;

    if (activePattern?.components) {
      // Load instances from pattern components
      const loadedInstances: ComponentInstance[] = activePattern.components.map(component => {
        // Check if it's already a ComponentInstance
        if ('definitionId' in component) {
          return component as ComponentInstance;
        }
        // Legacy RenameComponent - convert to instance format
        return {
          id: component.id,
          definitionId: component.id,
          name: component.name || 'Unknown',
          type: component.type,
          value: undefined,
          overrides: {},
        } as ComponentInstance;
      });

      // Only update if instances actually changed to prevent infinite loop
      setInstances(prevInstances => {
        const hasChanged =
          prevInstances.length !== loadedInstances.length ||
          prevInstances.some((inst, idx) => inst.id !== loadedInstances[idx]?.id);

        if (hasChanged) {
          // Update last saved reference
          lastSavedInstances.current = loadedInstances;
        }

        return hasChanged ? loadedInstances : prevInstances;
      });
    } else {
      setInstances(prevInstances => {
        if (prevInstances.length > 0) {
          lastSavedInstances.current = [];
          return [];
        }
        return prevInstances;
      });
    }

    // Reset flag after a tick to allow auto-save to work on user changes
    setTimeout(() => {
      isSyncingFromPattern.current = false;
    }, 0);
  }, [activePattern]);

  // Notify parent of pattern changes for real-time preview
  useEffect(() => {
    onPatternChange?.(instances);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances]); // Exclude onPatternChange to avoid infinite loop

  // Auto-save instances to pattern whenever they change
  useEffect(() => {
    // Skip if we're currently syncing FROM the pattern (prevents loop)
    if (isSyncingFromPattern.current) {
      return;
    }

    if (activePattern && activePatternId) {
      // Check if instances have changed from last saved state
      const hasChanged =
        instances.length !== lastSavedInstances.current.length ||
        instances.some(
          (inst, idx) =>
            !lastSavedInstances.current[idx] ||
            inst.id !== lastSavedInstances.current[idx].id ||
            inst.value !== lastSavedInstances.current[idx].value
        );

      if (hasChanged) {
        // Update last saved reference BEFORE calling updatePattern
        lastSavedInstances.current = instances;

        // Debounce the actual save call
        const timeoutId = setTimeout(() => {
          updatePattern(activePatternId, { components: instances as any });
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, activePatternId]);

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
      // Check if maximum component limit is reached
      if (instances.length >= PATTERN_VALIDATION.MAX_COMPONENTS) {
        // Show dialog if user hasn't disabled it
        if (!dontShowLimitWarning) {
          setShowLimitWarning(true);
        } else {
          // Just show a brief toast if they've disabled the dialog
          toast.error('Component Limit Reached', 'Maximum 10 components per pattern');
        }
        return;
      }

      const definition = getComponent(componentId);
      if (!definition) {
        toast.error('Component not found', `Component ${componentId} does not exist`);
        return;
      }

      const newInstance: ComponentInstance = {
        id: generatePrefixedId('instance'),
        definitionId: componentId,
        name: definition.name, // Cache name from definition
        type: definition.type, // Cache type from definition
        value: undefined,
        overrides: {},
      };

      setInstances(prev => [...prev, newInstance]);
      incrementUsageCount(componentId);
    },
    [instances.length, getComponent, incrementUsageCount, toast, dontShowLimitWarning]
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

  const handlePatternDrop = useCallback(
    (targetPatternId: string) => {
      if (draggedPatternId && draggedPatternId !== targetPatternId) {
        reorderPatterns(draggedPatternId, targetPatternId);
      }
      setDraggedPatternId(null);
    },
    [draggedPatternId, reorderPatterns]
  );

  const handleInstanceDragStart = useCallback((instanceId: string) => {
    setDraggedInstanceId(instanceId);
  }, []);

  const handleInstanceDragEnd = useCallback(() => {
    setDraggedInstanceId(null);
  }, []);

  const handleInstanceDragOver = useCallback((_instanceId: string, e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInstanceDrop = useCallback(
    (targetInstanceId: string) => {
      if (draggedInstanceId && draggedInstanceId !== targetInstanceId) {
        const fromIndex = instances.findIndex(inst => inst.id === draggedInstanceId);
        const toIndex = instances.findIndex(inst => inst.id === targetInstanceId);

        if (fromIndex !== -1 && toIndex !== -1) {
          // Reorder in local state
          const reordered = [...instances];
          const [removed] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, removed);
          setInstances(reordered);
        }
      }
      setDraggedInstanceId(null);
    },
    [draggedInstanceId, instances]
  );

  const handleToggleDropdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTypeDropdown(prev => !prev);
  }, []);

  const handleButtonMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
  }, []);

  const handleButtonMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  }, []);

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
              editable={true}
              isDragging={draggedPatternId === pattern.id}
              onClick={() => setActivePattern(pattern.id)}
              onClose={() => handleDeletePattern(pattern.id)}
              onRename={newName => handleRenamePattern(pattern.id, newName)}
              onDragStart={_e => setDraggedPatternId(pattern.id)}
              onDragEnd={() => setDraggedPatternId(null)}
              onDragOver={_e => _e.preventDefault()}
              onDrop={_e => {
                _e.preventDefault();
                handlePatternDrop(pattern.id);
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
            height: '168px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          onDragOver={e => {
            e.preventDefault();
            // Change cursor based on whether limit is reached
            if (instances.length >= PATTERN_VALIDATION.MAX_COMPONENTS) {
              e.dataTransfer.dropEffect = 'none';
            } else {
              e.dataTransfer.dropEffect = 'copy';
            }
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
              minHeight: '144px',
            }}
          >
            {instances.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No components yet"
                description="Click [+ Add Component] below to start building your pattern"
                compact={true}
                style={{ width: '100%' }}
              />
            ) : (
              instances.map((instance, index) => {
                const definition = getComponent(instance.definitionId);
                if (!definition) return null;

                return (
                  <React.Fragment key={instance.id}>
                    {index > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>_</span>}
                    <div
                      onDragOver={e => handleInstanceDragOver(instance.id, e)}
                      onDrop={e => {
                        e.preventDefault();
                        handleInstanceDrop(instance.id);
                      }}
                      style={{ display: 'inline-block' }}
                    >
                      <ComponentChip
                        instance={instance}
                        definition={definition}
                        onRemove={() => removeInstance(instance.id)}
                        onUpdateInstance={updates => updateInstance(instance.id, updates)}
                        canDrag={true}
                        onDragStart={() => handleInstanceDragStart(instance.id)}
                        onDragEnd={handleInstanceDragEnd}
                        isDragging={draggedInstanceId === instance.id}
                      />
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Add Component Button */}
        <div style={{ position: 'relative' }}>
          <button
            ref={addComponentButtonRef}
            onClick={handleToggleDropdown}
            aria-label="Add component to pattern"
            aria-expanded={showTypeDropdown}
            aria-haspopup="menu"
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            + Add Component ▼
          </button>

          <ComponentTypeDropdown
            isOpen={showTypeDropdown}
            onClose={() => setShowTypeDropdown(false)}
            onSelect={handleSelectType}
            anchorRef={addComponentButtonRef}
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
            File MetaData Components ({getRecentComponents(Infinity).length})
          </div>

          {/* Components grid */}
          <div
            className="component-grid-scrollable"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '252px',
              overflow: 'auto',
            }}
          >
            <MetadataComponentsGrid
              key={refreshKey}
              components={userComponents}
              systemComponents={systemComponents}
              onSelectComponent={addComponentInstance}
              onSettingsClick={componentId => {
                setEditComponentId(componentId);
              }}
              showTitle={false}
            />
          </div>
        </div>
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
          onClick={() => onRename(instances)}
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
        type={quickCreateType || 'text'}
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

      <ComponentEditDialog
        componentId={editComponentId}
        isOpen={!!editComponentId}
        onClose={() => setEditComponentId(null)}
        onUpdated={_componentId => {
          setEditComponentId(null);
          setRefreshKey(prev => prev + 1); // Refresh recent components list
          toast.success('Component Updated', 'Component has been updated successfully');
        }}
        onDeleted={_componentId => {
          setEditComponentId(null);
          setRefreshKey(prev => prev + 1); // Refresh recent components list
        }}
      />

      {/* Component Limit Warning Dialog */}
      {showLimitWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowLimitWarning(false)}
        >
          <div
            style={{
              background: 'linear-gradient(145deg, #1f1f1f 0%, #1a1a1a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '32px',
              width: '460px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header with icon and title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: 600,
                    margin: '0 0 8px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Component Limit Reached
                </h3>
                <p
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: 0,
                  }}
                >
                  You can only add up to{' '}
                  <span
                    style={{
                      color: '#3b82f6',
                      fontWeight: 600,
                    }}
                  >
                    {PATTERN_VALIDATION.MAX_COMPONENTS} components
                  </span>{' '}
                  per naming pattern. Please remove some components before adding more.
                </p>
              </div>
            </div>

            {/* Footer with checkbox and button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              {/* Don't show again checkbox - left side */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowLimitWarning}
                  onChange={e => {
                    const checked = e.target.checked;
                    setDontShowLimitWarning(checked);
                    setStorageBoolean('hideComponentLimitWarning', checked);
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer',
                    accentColor: '#3b82f6',
                  }}
                />
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
                  Don&apos;t show again
                </span>
              </label>

              {/* Got it button - right side */}
              <button
                onClick={() => setShowLimitWarning(false)}
                style={{
                  padding: '10px 24px',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
