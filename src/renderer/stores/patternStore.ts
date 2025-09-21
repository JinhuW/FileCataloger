import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { SavedPattern, RenameComponent } from '@shared/types';
import { logger } from '@shared/logger';

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

  // Component management
  addComponentToPattern: (patternId: string, component: RenameComponent) => void;
  updateComponentInPattern: (
    patternId: string,
    componentId: string,
    updates: Partial<RenameComponent>
  ) => void;
  removeComponentFromPattern: (patternId: string, componentId: string) => void;
  reorderComponentsInPattern: (patternId: string, fromIndex: number, toIndex: number) => void;

  // Getters
  getPattern: (id: string) => SavedPattern | undefined;
  getActivePattern: () => SavedPattern | undefined;
  getAllPatterns: () => SavedPattern[];
  getPatternCount: () => number;
}

// Default patterns
const DEFAULT_PATTERNS: SavedPattern[] = [
  {
    id: 'default-pattern',
    name: 'Default Pattern',
    components: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: true,
    isDefault: true,
  },
  {
    id: 'custom-pattern',
    name: 'Custom Pattern',
    components: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: false,
    isDefault: false,
  },
];

export const usePatternStore = create<PatternState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      patterns: new Map(DEFAULT_PATTERNS.map(p => [p.id, p])),
      activePatternId: 'default-pattern',
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

            // Don't allow updating built-in patterns' core properties
            if (pattern.isBuiltIn && (updates.name || updates.isBuiltIn !== undefined)) {
              logger.warn('Cannot update built-in pattern core properties');
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
            if (!pattern) return state;

            if (pattern.isBuiltIn) {
              logger.warn('Cannot delete built-in pattern');
              return { error: 'Cannot delete built-in patterns' };
            }

            const newPatterns = new Map(state.patterns);
            newPatterns.delete(id);
            logger.debug('Deleted pattern:', id);

            return {
              patterns: newPatterns,
              activePatternId:
                state.activePatternId === id ? 'default-pattern' : state.activePatternId,
              error: null,
            };
          },
          false,
          'deletePattern'
        ),

      setActivePattern: id =>
        set(
          state => {
            if (id && !state.patterns.has(id)) {
              logger.warn('Pattern not found:', id);
              return state;
            }

            return { activePatternId: id };
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
          set({ error: 'Maximum of 20 patterns allowed' });
          return null;
        }

        const newId = `pattern-${Date.now()}`;
        const duplicatedPattern: SavedPattern = {
          ...pattern,
          id: newId,
          name: newName,
          isBuiltIn: false,
          isDefault: false,
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

            if (fromIndex === -1 || toIndex === -1) return state;

            // Reorder array
            const [removed] = patternsArray.splice(fromIndex, 1);
            patternsArray.splice(toIndex, 0, removed);

            // Convert back to Map
            const newPatterns = new Map(patternsArray);

            return { patterns: newPatterns };
          },
          false,
          'reorderPatterns'
        ),

      // Bulk actions
      setPatternsFromStorage: patterns =>
        set(
          () => {
            const newPatterns = new Map<string, SavedPattern>();

            // Always include default patterns
            DEFAULT_PATTERNS.forEach(p => newPatterns.set(p.id, p));

            // Add stored patterns
            patterns.forEach(p => {
              if (!p.isBuiltIn) {
                newPatterns.set(p.id, p);
              }
            });

            logger.debug('Loaded patterns from storage:', newPatterns.size);

            return {
              patterns: newPatterns,
              isLoading: false,
            };
          },
          false,
          'setPatternsFromStorage'
        ),

      // Component management
      addComponentToPattern: (patternId, component) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern || pattern.isBuiltIn) return state;

            const updatedPattern = {
              ...pattern,
              components: [...pattern.components, component],
              updatedAt: Date.now(),
            };

            const newPatterns = new Map(state.patterns);
            newPatterns.set(patternId, updatedPattern);

            return { patterns: newPatterns };
          },
          false,
          'addComponentToPattern'
        ),

      updateComponentInPattern: (patternId, componentId, updates) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern) return state;

            const updatedPattern = {
              ...pattern,
              components: pattern.components.map(c =>
                c.id === componentId ? { ...c, ...updates } : c
              ),
              updatedAt: Date.now(),
            };

            const newPatterns = new Map(state.patterns);
            newPatterns.set(patternId, updatedPattern);

            return { patterns: newPatterns };
          },
          false,
          'updateComponentInPattern'
        ),

      removeComponentFromPattern: (patternId, componentId) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern || pattern.isBuiltIn) return state;

            const updatedPattern = {
              ...pattern,
              components: pattern.components.filter(c => c.id !== componentId),
              updatedAt: Date.now(),
            };

            const newPatterns = new Map(state.patterns);
            newPatterns.set(patternId, updatedPattern);

            return { patterns: newPatterns };
          },
          false,
          'removeComponentFromPattern'
        ),

      reorderComponentsInPattern: (patternId, fromIndex, toIndex) =>
        set(
          state => {
            const pattern = state.patterns.get(patternId);
            if (!pattern || pattern.isBuiltIn) return state;

            const components = [...pattern.components];
            const [removed] = components.splice(fromIndex, 1);
            components.splice(toIndex, 0, removed);

            const updatedPattern = {
              ...pattern,
              components,
              updatedAt: Date.now(),
            };

            const newPatterns = new Map(state.patterns);
            newPatterns.set(patternId, updatedPattern);

            return { patterns: newPatterns };
          },
          false,
          'reorderComponentsInPattern'
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
