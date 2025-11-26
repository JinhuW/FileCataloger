/**
 * @file usePatternBuilder.ts
 * @description Custom hook that encapsulates all state management and logic
 * for the RenamePatternBuilder component.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ShelfItem } from '@shared/types';
import { ComponentType, ComponentInstance } from '@shared/types/componentDefinition';
import { usePatternManager } from '@renderer/hooks/usePatternManager';
import { usePatternStore, useToast } from '@renderer/stores';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';
import { generatePrefixedId } from '@renderer/utils/idGenerator';
import { getStorageBoolean, setStorageBoolean } from '@renderer/utils/safeStorage';

export interface UsePatternBuilderOptions {
  selectedFiles?: ShelfItem[];
  onDestinationChange?: (path: string) => void;
  onPatternChange?: (instances: ComponentInstance[]) => void;
}

export interface UsePatternBuilderReturn {
  // State
  destinationPath: string;
  showNewPatternDialog: boolean;
  newPatternName: string;
  draggedPatternId: string | null;
  draggedInstanceId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  showTypeDropdown: boolean;
  quickCreateType: ComponentType | null;
  showLibraryBrowser: boolean;
  editComponentId: string | null;
  showLimitWarning: boolean;
  dontShowLimitWarning: boolean;
  instances: ComponentInstance[];
  refreshKey: number;

  // Pattern manager state
  patterns: ReturnType<typeof usePatternManager>['patterns'];
  activePattern: ReturnType<typeof usePatternManager>['activePattern'];
  activePatternId: ReturnType<typeof usePatternManager>['activePatternId'];
  patternCount: ReturnType<typeof usePatternManager>['patternCount'];
  error: ReturnType<typeof usePatternManager>['error'];

  // Component library state
  getComponent: ReturnType<typeof useComponentLibrary>['getComponent'];
  getRecentComponents: ReturnType<typeof useComponentLibrary>['getRecentComponents'];
  userComponents: ReturnType<typeof useComponentLibrary>['userComponents'];
  systemComponents: ReturnType<typeof useComponentLibrary>['systemComponents'];

  // Setters
  setShowNewPatternDialog: (show: boolean) => void;
  setNewPatternName: (name: string) => void;
  setDraggedPatternId: (id: string | null) => void;
  setShowTypeDropdown: (show: boolean) => void;
  setQuickCreateType: (type: ComponentType | null) => void;
  setShowLibraryBrowser: (show: boolean) => void;
  setEditComponentId: (id: string | null) => void;
  setShowLimitWarning: (show: boolean) => void;
  setDontShowLimitWarning: (value: boolean) => void;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;

  // Handlers
  handlePathEdit: () => Promise<void>;
  addComponentInstance: (componentId: string) => void;
  handleSelectType: (selection: ComponentType | string) => void;
  handleQuickCreateComplete: (componentId: string) => void;
  removeInstance: (instanceId: string) => void;
  updateInstance: (instanceId: string, updates: Partial<ComponentInstance>) => void;
  handleCreatePattern: () => Promise<void>;
  handleRenamePattern: (patternId: string, newName: string) => Promise<void>;
  handleDeletePattern: (patternId: string) => Promise<void>;
  handlePatternDrop: (targetPatternId: string) => void;
  handleInstanceDragStart: (instanceId: string) => void;
  handleInstanceDragEnd: () => void;
  handleInstanceDragOver: (instanceId: string, e: React.DragEvent) => void;
  handleInstanceDrop: (targetInstanceId: string) => void;
  setActivePattern: (id: string) => void;
  reorderPatterns: (fromId: string, toId: string) => void;
  saveLimitWarningPreference: (checked: boolean) => void;

  // Toast
  toast: ReturnType<typeof useToast>;
}

export function usePatternBuilder({
  selectedFiles = [],
  onDestinationChange,
  onPatternChange,
}: UsePatternBuilderOptions): UsePatternBuilderReturn {
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
          updatePattern(activePatternId, { components: instances });
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
      toast.error('Failed to Open Dialog', 'Could not open folder selection dialog');
    }
  }, [destinationPath, onDestinationChange, toast]);

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
      } catch {
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
      } catch {
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
        } catch {
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

  const saveLimitWarningPreference = useCallback((checked: boolean) => {
    setDontShowLimitWarning(checked);
    setStorageBoolean('hideComponentLimitWarning', checked);
  }, []);

  return {
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
    activePattern,
    activePatternId,
    patternCount,
    error,

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
    setDontShowLimitWarning,
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
    reorderPatterns,
    saveLimitWarningPreference,

    // Toast
    toast,
  };
}
