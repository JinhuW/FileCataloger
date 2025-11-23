import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { SavedPattern, RenameComponent, ComponentInstance } from '@shared/types';
import { logger } from '@shared/logger';
import { generatePrefixedId } from '@renderer/utils/idGenerator';

// Enable MapSet plugin for Immer to work with Map and Set
enableMapSet();

interface PatternState {
  // State
  patterns: Map<string, SavedPattern>;
  activePatternId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  addPattern: (pattern: SavedPattern) => void;
  updatePattern: (id: string, updates: Partial<SavedPattern>) => void;
  deletePattern: (id: string) => void;
  setActivePattern: (id: string | null) => void;
  duplicatePattern: (id: string, newName: string) => string | null;
  reorderPatterns: (fromId: string, toId: string) => void;

  // Bulk actions
  setPatternsFromStorage: (patterns: SavedPattern[]) => void;

  // Component management (legacy - supports both RenameComponent and ComponentInstance)
  addComponentToPattern: (
    patternId: string,
    component: RenameComponent | ComponentInstance
  ) => void;
  updateComponentInPattern: (
    patternId: string,
    componentId: string,
    updates: Partial<RenameComponent | ComponentInstance>
  ) => void;
  removeComponentFromPattern: (patternId: string, componentId: string) => void;
  reorderComponentsInPattern: (patternId: string, fromIndex: number, toIndex: number) => void;

  // Component instance management (new meta-component system)
  addComponentInstance: (patternId: string, definitionId: string) => void;
  updateComponentInstance: (
    patternId: string,
    instanceId: string,
    updates: Partial<ComponentInstance>
  ) => void;
  removeComponentInstance: (patternId: string, instanceId: string) => void;
  reorderComponentInstances: (patternId: string, fromIndex: number, toIndex: number) => void;

  // Getters
  getPattern: (id: string) => SavedPattern | undefined;
  getActivePattern: () => SavedPattern | undefined;
  getAllPatterns: () => SavedPattern[];
  getPatternCount: () => number;
}

export const usePatternStore = create<PatternState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      patterns: new Map(),
      activePatternId: null,
      isLoading: false,
      error: null,

      // Actions
      addPattern: pattern =>
        set(
          state => {
            if (state.patterns.size >= 20) {
              logger.warn('Maximum pattern limit reached');
              state.error = 'Maximum of 20 patterns allowed';
              return;
            }

            state.patterns.set(pattern.id, pattern);
            state.error = null;
            logger.debug('Added pattern:', pattern.id);
          },
          false,
          'addPattern'
        ),

      updatePattern: (id, updates) =>
        set(
          state => {
            const pattern = state.patterns.get(id);

            if (!pattern) {
              logger.warn('Pattern not found for update:', id);
              return;
            }

            const updatedPattern = {
              ...pattern,
              ...updates,
              updatedAt: Date.now(),
            };

            state.patterns.set(id, updatedPattern);
            logger.debug('Updated pattern:', id);
          },
          false,
          'updatePattern'
        ),

      deletePattern: id =>
        set(
          state => {
            const pattern = state.patterns.get(id);
            if (!pattern) return;

            state.patterns.delete(id);
            logger.debug('Deleted pattern:', id);

            if (state.activePatternId === id) {
              const remainingPatterns = Array.from(state.patterns.keys());
              state.activePatternId = remainingPatterns.length > 0 ? remainingPatterns[0] : null;
            }
            state.error = null;
          },
          false,
          'deletePattern'
        ),

      setActivePattern: id =>
        set(
          state => {
            if (id && !state.patterns.has(id)) {
              logger.warn('Pattern not found:', id);
              return;
            }

            state.activePatternId = id;
          },
          false,
          'setActivePattern'
        ),

      duplicatePattern: (id, newName) => {
        const state = get();
        const pattern = state.patterns.get(id);

        if (!pattern) {
          logger.warn('Pattern not found for duplication:', id);
          return null;
        }

        if (state.patterns.size >= 20) {
          logger.warn('Maximum pattern limit reached');
          set(draft => {
            draft.error = 'Maximum of 20 patterns allowed';
          });
          return null;
        }

        const newId = `pattern-${Date.now()}`;
        const duplicatedPattern: SavedPattern = {
          ...pattern,
          id: newId,
          name: newName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        state.addPattern(duplicatedPattern);
        return newId;
      },

      reorderPatterns: (fromId, toId) =>
        set(
          state => {
            // Convert to array for reordering
            const patternsArray = Array.from(state.patterns.entries());
            const fromIndex = patternsArray.findIndex(([id]) => id === fromId);
            const toIndex = patternsArray.findIndex(([id]) => id === toId);

            if (fromIndex === -1 || toIndex === -1) return;

            // Reorder array
            const [removed] = patternsArray.splice(fromIndex, 1);
            patternsArray.splice(toIndex, 0, removed);

            // Convert back to Map and update state
            state.patterns = new Map(patternsArray);
          },
          false,
          'reorderPatterns'
        ),

      // Bulk actions
      setPatternsFromStorage: patterns =>
        set(
          state => {
            const newPatterns = new Map<string, SavedPattern>();

            // Add stored patterns
            patterns.forEach(p => {
              newPatterns.set(p.id, p);
            });

            logger.debug('Loaded patterns from storage:', newPatterns.size);

            state.patterns = newPatterns;
            state.isLoading = false;
          },
          false,
          'setPatternsFromStorage'
        ),

      // Component management
      addComponentToPattern: (patternId, component) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const updatedPattern = {
              ...pattern,
              components: [...pattern.components, component],
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);
          },
          false,
          'addComponentToPattern'
        ),

      updateComponentInPattern: (patternId, componentId, updates) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const updatedPattern = {
              ...pattern,
              components: pattern.components.map(c =>
                c.id === componentId ? { ...c, ...updates } : c
              ),
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);
          },
          false,
          'updateComponentInPattern'
        ),

      removeComponentFromPattern: (patternId, componentId) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const updatedPattern = {
              ...pattern,
              components: pattern.components.filter(c => c.id !== componentId),
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);
          },
          false,
          'removeComponentFromPattern'
        ),

      reorderComponentsInPattern: (patternId, fromIndex, toIndex) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const components = [...pattern.components];
            const [removed] = components.splice(fromIndex, 1);
            components.splice(toIndex, 0, removed);

            const updatedPattern = {
              ...pattern,
              components,
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);
          },
          false,
          'reorderComponentsInPattern'
        ),

      // Component instance management (new meta-component system)
      addComponentInstance: (patternId, definitionId) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            // Create new component instance
            const instance: ComponentInstance = {
              id: generatePrefixedId('instance'),
              definitionId,
              name: '', // Will be populated from definition when resolving
              type: 'text', // Will be populated from definition when resolving
              value: undefined,
              overrides: undefined,
            };

            const updatedPattern = {
              ...pattern,
              components: [...(pattern.components as ComponentInstance[]), instance],
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);

            logger.debug('Added component instance to pattern:', { patternId, definitionId });
          },
          false,
          'addComponentInstance'
        ),

      updateComponentInstance: (patternId, instanceId, updates) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const updatedPattern = {
              ...pattern,
              components: (pattern.components as ComponentInstance[]).map(c =>
                c.id === instanceId ? { ...c, ...updates } : c
              ),
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);

            logger.debug('Updated component instance in pattern:', { patternId, instanceId });
          },
          false,
          'updateComponentInstance'
        ),

      removeComponentInstance: (patternId, instanceId) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const updatedPattern = {
              ...pattern,
              components: (pattern.components as ComponentInstance[]).filter(
                c => c.id !== instanceId
              ),
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);

            logger.debug('Removed component instance from pattern:', { patternId, instanceId });
          },
          false,
          'removeComponentInstance'
        ),

      reorderComponentInstances: (patternId, fromIndex, toIndex) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return;

            const components = [...(pattern.components as ComponentInstance[])];
            const [removed] = components.splice(fromIndex, 1);
            components.splice(toIndex, 0, removed);

            const updatedPattern = {
              ...pattern,
              components,
              updatedAt: Date.now(),
            };

            state.patterns.set(patternId, updatedPattern);

            logger.debug('Reordered component instances in pattern:', {
              patternId,
              fromIndex,
              toIndex,
            });
          },
          false,
          'reorderComponentInstances'
        ),

      // Getters
      getPattern: id => get().patterns.get(id),

      getActivePattern: () => {
        const state = get();
        return state.activePatternId ? state.patterns.get(state.activePatternId) : undefined;
      },

      getAllPatterns: () => Array.from(get().patterns.values()),

      getPatternCount: () => get().patterns.size,
    })),
    {
      name: 'pattern-store',
    }
  )
);

// Selector hooks for common use cases
export const useActivePattern = () => usePatternStore(state => state.getActivePattern());

export const usePattern = (id: string) => usePatternStore(state => state.getPattern(id));

export const useAllPatterns = () => usePatternStore(state => state.getAllPatterns());

export const usePatternCount = () => usePatternStore(state => state.getPatternCount());
