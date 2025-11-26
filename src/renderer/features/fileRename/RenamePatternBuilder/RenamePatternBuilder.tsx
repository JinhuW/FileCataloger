/**
 * @file RenamePatternBuilder.tsx
 * @description Simplified Notion-style pattern builder using meta-component system.
 * This is the main orchestrator component that composes sub-components for a
 * streamlined component creation and pattern building experience.
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

import React, { useCallback } from 'react';
import { ShelfItem } from '@shared/types';
import { ComponentInstance } from '@shared/types/componentDefinition';
import { PatternBuilderSkeleton } from '@renderer/components/primitives';
import { QuickCreatePopover } from './QuickCreatePopover';
import { ComponentEditDialog } from './ComponentEditDialog';
import { ComponentBrowserDialog } from '../ComponentLibrary/ComponentBrowserDialog';
import { usePatternBuilder } from './usePatternBuilder';
import { PatternTabSection } from './PatternTabSection';
import { PatternBuilderCanvas } from './PatternBuilderCanvas';
import { PatternActionFooter } from './PatternActionFooter';
import { NewPatternDialog, ComponentLimitWarningDialog } from './PatternDialogs';

export interface RenamePatternBuilderProps {
  hasFiles: boolean;
  selectedFiles?: ShelfItem[];
  onDestinationChange?: (path: string) => void;
  onRename: (instances: ComponentInstance[]) => void;
  onPatternChange?: (instances: ComponentInstance[]) => void;
}

export const RenamePatternBuilder: React.FC<RenamePatternBuilderProps> = ({
  hasFiles,
  selectedFiles = [],
  onDestinationChange,
  onRename,
  onPatternChange,
}) => {
  const {
    // State
    destinationPath,
    showNewPatternDialog,
    newPatternName,
    draggedPatternId,
    draggedInstanceId,
    isLoading,
    isSaving,
    showTypeDropdown,
    quickCreateType,
    showLibraryBrowser,
    editComponentId,
    showLimitWarning,
    dontShowLimitWarning,
    instances,
    refreshKey,

    // Pattern manager state
    patterns,
    activePatternId,
    patternCount,

    // Component library state
    getComponent,
    getRecentComponents,
    userComponents,
    systemComponents,

    // Setters
    setShowNewPatternDialog,
    setNewPatternName,
    setDraggedPatternId,
    setShowTypeDropdown,
    setQuickCreateType,
    setShowLibraryBrowser,
    setEditComponentId,
    setShowLimitWarning,
    setRefreshKey,

    // Handlers
    handlePathEdit,
    addComponentInstance,
    handleSelectType,
    handleQuickCreateComplete,
    removeInstance,
    updateInstance,
    handleCreatePattern,
    handleRenamePattern,
    handleDeletePattern,
    handlePatternDrop,
    handleInstanceDragStart,
    handleInstanceDragEnd,
    handleInstanceDragOver,
    handleInstanceDrop,
    setActivePattern,
    saveLimitWarningPreference,

    // Toast
    toast,
  } = usePatternBuilder({
    selectedFiles,
    onDestinationChange,
    onPatternChange,
  });

  const handleToggleDropdown = useCallback(() => {
    setShowTypeDropdown(prev => !prev);
  }, [setShowTypeDropdown]);

  const handleCloseDropdown = useCallback(() => {
    setShowTypeDropdown(false);
  }, [setShowTypeDropdown]);

  const handleRenameClick = useCallback(() => {
    onRename(instances);
  }, [onRename, instances]);

  const handleAddPattern = useCallback(() => {
    setShowNewPatternDialog(true);
  }, [setShowNewPatternDialog]);

  const handleCloseNewPatternDialog = useCallback(() => {
    setShowNewPatternDialog(false);
    setNewPatternName('');
  }, [setShowNewPatternDialog, setNewPatternName]);

  const handleLibrarySelect = useCallback(
    (componentId: string) => {
      addComponentInstance(componentId);
      setShowLibraryBrowser(false);
    },
    [addComponentInstance, setShowLibraryBrowser]
  );

  const handleLibraryCreateNew = useCallback(() => {
    setShowLibraryBrowser(false);
    toast.info('Create new component', 'Full creation modal coming soon!');
  }, [setShowLibraryBrowser, toast]);

  const handleComponentUpdated = useCallback(
    (_componentId: string) => {
      setEditComponentId(null);
      setRefreshKey(prev => prev + 1);
      toast.success('Component Updated', 'Component has been updated successfully');
    },
    [setEditComponentId, setRefreshKey, toast]
  );

  const handleComponentDeleted = useCallback(
    (_componentId: string) => {
      setEditComponentId(null);
      setRefreshKey(prev => prev + 1);
    },
    [setEditComponentId, setRefreshKey]
  );

  const handleSettingsClick = useCallback(
    (componentId: string) => {
      setEditComponentId(componentId);
    },
    [setEditComponentId]
  );

  const handleCloseLimitWarning = useCallback(() => {
    setShowLimitWarning(false);
  }, [setShowLimitWarning]);

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
      <PatternTabSection
        patterns={patterns}
        activePatternId={activePatternId}
        patternCount={patternCount}
        draggedPatternId={draggedPatternId}
        isSaving={isSaving}
        onPatternSelect={setActivePattern}
        onPatternDelete={handleDeletePattern}
        onPatternRename={handleRenamePattern}
        onPatternDragStart={setDraggedPatternId}
        onPatternDragEnd={() => setDraggedPatternId(null)}
        onPatternDrop={handlePatternDrop}
        onAddPattern={handleAddPattern}
      />

      {/* Pattern Builder Area */}
      <PatternBuilderCanvas
        instances={instances}
        draggedInstanceId={draggedInstanceId}
        showTypeDropdown={showTypeDropdown}
        refreshKey={refreshKey}
        userComponents={userComponents}
        systemComponents={systemComponents}
        recentComponentsCount={getRecentComponents(Infinity).length}
        getComponent={getComponent}
        onRemoveInstance={removeInstance}
        onUpdateInstance={updateInstance}
        onInstanceDragStart={handleInstanceDragStart}
        onInstanceDragEnd={handleInstanceDragEnd}
        onInstanceDragOver={handleInstanceDragOver}
        onInstanceDrop={handleInstanceDrop}
        onAddComponentFromDrop={addComponentInstance}
        onToggleDropdown={handleToggleDropdown}
        onCloseDropdown={handleCloseDropdown}
        onSelectType={handleSelectType}
        onSelectComponent={addComponentInstance}
        onSettingsClick={handleSettingsClick}
      />

      {/* Action Buttons */}
      <PatternActionFooter
        destinationPath={destinationPath}
        hasFiles={hasFiles}
        instanceCount={instances.length}
        onPathEdit={handlePathEdit}
        onRename={handleRenameClick}
      />

      {/* Modals */}
      <NewPatternDialog
        isOpen={showNewPatternDialog}
        patternName={newPatternName}
        onPatternNameChange={setNewPatternName}
        onClose={handleCloseNewPatternDialog}
        onCreate={handleCreatePattern}
      />

      <QuickCreatePopover
        type={quickCreateType || 'text'}
        isOpen={!!quickCreateType}
        onClose={() => setQuickCreateType(null)}
        onCreated={handleQuickCreateComplete}
      />

      <ComponentBrowserDialog
        isOpen={showLibraryBrowser}
        onClose={() => setShowLibraryBrowser(false)}
        onSelect={handleLibrarySelect}
        onCreateNew={handleLibraryCreateNew}
      />

      <ComponentEditDialog
        componentId={editComponentId}
        isOpen={!!editComponentId}
        onClose={() => setEditComponentId(null)}
        onUpdated={handleComponentUpdated}
        onDeleted={handleComponentDeleted}
      />

      <ComponentLimitWarningDialog
        isOpen={showLimitWarning}
        dontShowAgain={dontShowLimitWarning}
        onDontShowAgainChange={saveLimitWarningPreference}
        onClose={handleCloseLimitWarning}
      />
    </div>
  );
};
