/**
 * @file useComponentInstances.ts
 * @description Custom hook for managing component instances in patterns.
 * Extracts instance management logic from RenamePatternBuilder for better maintainability.
 */

import { useState, useCallback } from 'react';
import { ComponentInstance } from '@shared/types/componentDefinition';
import { useToast } from '@renderer/stores';
import { useComponentLibrary } from './useComponentLibrary';
import { generatePrefixedId } from '@renderer/utils/idGenerator';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';

interface UseComponentInstancesOptions {
  dontShowLimitWarning: boolean;
  onLimitWarning?: () => void;
}

export function useComponentInstances(options: UseComponentInstancesOptions) {
  const { dontShowLimitWarning, onLimitWarning } = options;
  const [instances, setInstances] = useState<ComponentInstance[]>([]);
  const toast = useToast();
  const { getComponent, incrementUsageCount } = useComponentLibrary();

  /**
   * Add a new component instance to the pattern
   */
  const addInstance = useCallback(
    (componentId: string) => {
      // Check if maximum component limit is reached
      if (instances.length >= PATTERN_VALIDATION.MAX_COMPONENTS) {
        // Show dialog if user hasn't disabled it
        if (!dontShowLimitWarning && onLimitWarning) {
          onLimitWarning();
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
        name: definition.name,
        type: definition.type,
        value: undefined,
        overrides: {},
      };

      setInstances(prev => [...prev, newInstance]);
      incrementUsageCount(componentId);
    },
    [
      instances.length,
      getComponent,
      incrementUsageCount,
      toast,
      dontShowLimitWarning,
      onLimitWarning,
    ]
  );

  /**
   * Remove a component instance from the pattern
   */
  const removeInstance = useCallback((instanceId: string) => {
    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
  }, []);

  /**
   * Update a component instance with partial updates
   */
  const updateInstance = useCallback((instanceId: string, updates: Partial<ComponentInstance>) => {
    setInstances(prev =>
      prev.map(inst => (inst.id === instanceId ? { ...inst, ...updates } : inst))
    );
  }, []);

  /**
   * Clear all instances
   */
  const clearInstances = useCallback(() => {
    setInstances([]);
  }, []);

  /**
   * Set instances to a specific array (useful for syncing with active pattern)
   */
  const setInstancesArray = useCallback((newInstances: ComponentInstance[]) => {
    setInstances(newInstances);
  }, []);

  return {
    instances,
    addInstance,
    removeInstance,
    updateInstance,
    clearInstances,
    setInstances: setInstancesArray,
  };
}
