/**
 * Component Library Hook
 *
 * Custom hook for managing component library with persistence.
 */

import { useEffect, useCallback } from 'react';
import { useComponentLibraryStore } from '../stores/componentLibraryStore';
import type { ComponentDefinition } from '../../shared/types/componentDefinition';
import { logger } from '@shared/logger';

export function useComponentLibrary() {
  const store = useComponentLibraryStore();

  // Load components from preferences
  const loadFromPreferences = useCallback(async () => {
    store.setLoading(true);
    try {
      const result = await window.electronAPI.invoke('component:load-library');
      if (result.success && result.data) {
        store.setComponentsFromStorage(result.data);
        logger.debug(`Component library loaded: ${result.data.length} components`);
      } else {
        throw new Error(result.error || 'Failed to load component library');
      }
    } catch (error) {
      logger.error('Failed to load component library:', error);
      store.setError('Failed to load component library');
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  // Save components to preferences (debounced in real implementation)
  const saveToPreferences = useCallback(
    async (components: ComponentDefinition[]) => {
      try {
        const result = await window.electronAPI.invoke('component:save-library', components);
        if (result.success) {
          logger.debug(`Component library saved: ${components.length} components`);
        } else {
          throw new Error(result.error || 'Failed to save component library');
        }
      } catch (error) {
        logger.error('Failed to save component library:', error);
        store.setError('Failed to save component library');
      }
    },
    [store]
  );

  // Create component
  const createComponent = useCallback(
    (definition: ComponentDefinition) => {
      store.addComponent(definition);
      const allComponents = store.getAllComponents();
      saveToPreferences(allComponents);
      return definition.id;
    },
    [store, saveToPreferences]
  );

  // Update component
  const updateComponent = useCallback(
    (id: string, updates: Partial<ComponentDefinition>) => {
      store.updateComponent(id, updates);
      const allComponents = store.getAllComponents();
      saveToPreferences(allComponents);
    },
    [store, saveToPreferences]
  );

  // Delete component
  const deleteComponent = useCallback(
    (id: string) => {
      store.deleteComponent(id);
      const allComponents = store.getAllComponents();
      saveToPreferences(allComponents);
    },
    [store, saveToPreferences]
  );

  // Duplicate component
  const duplicateComponent = useCallback(
    (id: string, newName: string) => {
      const duplicated = store.duplicateComponent(id, newName);
      if (duplicated) {
        const allComponents = store.getAllComponents();
        saveToPreferences(allComponents);
        return duplicated.id;
      }
      return null;
    },
    [store, saveToPreferences]
  );

  // Load components from storage on mount (only once)
  useEffect(() => {
    loadFromPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only load once on mount

  return {
    // State
    components: store.getAllComponents(),
    userComponents: store.getUserComponents(),
    systemComponents: store.getSystemComponents(),
    favoriteComponents: store.getFavoriteComponents(),
    componentCount: store.getComponentCount(),
    isLoading: store.isLoading,
    error: store.error,

    // Actions
    createComponent,
    updateComponent,
    deleteComponent,
    duplicateComponent,
    toggleFavorite: store.toggleFavorite,
    incrementUsageCount: store.incrementUsageCount,

    // Queries
    getComponent: store.getComponent,
    getComponentsByType: store.getComponentsByType,
    searchComponents: store.searchComponents,
    getRecentComponents: store.getRecentComponents,
    isSystemComponent: store.isSystemComponent,

    // Utility
    reloadComponents: loadFromPreferences,
  };
}
