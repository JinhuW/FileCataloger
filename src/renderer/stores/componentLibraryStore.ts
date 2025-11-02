/**
 * Component Library Store
 *
 * Zustand store for managing component definitions in the meta-component system.
 * Uses Immer for immutable state updates and Map for O(1) component lookups.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ComponentDefinition,
  SelectOption,
  ComponentType,
} from '../../shared/types/componentDefinition';
import { isSelectComponent } from '../../shared/types/componentDefinition';

// ============================================================================
// State Interface
// ============================================================================

interface ComponentLibraryState {
  components: Map<string, ComponentDefinition>;
  isLoading: boolean;
  error: string | null;

  // Component CRUD Actions
  addComponent: (definition: ComponentDefinition) => void;
  updateComponent: (id: string, updates: Partial<ComponentDefinition>) => void;
  deleteComponent: (id: string) => void;
  duplicateComponent: (id: string, newName: string) => ComponentDefinition | null;

  // Option Management (for Select components)
  addOptionToComponent: (componentId: string, option: SelectOption) => void;
  updateOptionInComponent: (
    componentId: string,
    optionId: string,
    updates: Partial<SelectOption>
  ) => void;
  removeOptionFromComponent: (componentId: string, optionId: string) => void;
  reorderOptionsInComponent: (componentId: string, fromIndex: number, toIndex: number) => void;

  // Bulk Operations
  setComponentsFromStorage: (components: ComponentDefinition[]) => void;
  importComponents: (components: ComponentDefinition[]) => void;
  exportComponent: (id: string) => ComponentDefinition | null;
  clearAllComponents: () => void;

  // Getters
  getComponent: (id: string) => ComponentDefinition | undefined;
  getAllComponents: () => ComponentDefinition[];
  getComponentsByType: (type: ComponentType) => ComponentDefinition[];
  getFavoriteComponents: () => ComponentDefinition[];
  getRecentComponents: (limit: number) => ComponentDefinition[];
  getComponentCount: () => number;

  // Utility Actions
  toggleFavorite: (id: string) => void;
  incrementUsageCount: (id: string) => void;
  searchComponents: (query: string) => ComponentDefinition[];

  // State Management
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useComponentLibraryStore = create<ComponentLibraryState>()(
  immer((set, get) => ({
    // Initial State
    components: new Map(),
    isLoading: false,
    error: null,

    // ========================================================================
    // Component CRUD Actions
    // ========================================================================

    addComponent: definition => {
      set(state => {
        state.components.set(definition.id, definition);
        state.error = null;
      });
    },

    updateComponent: (id, updates) => {
      set(state => {
        const component = state.components.get(id);
        if (component) {
          const updated = {
            ...component,
            ...updates,
            metadata: {
              ...component.metadata,
              updatedAt: Date.now(),
            },
          };
          state.components.set(id, updated);
          state.error = null;
        } else {
          state.error = `Component with id ${id} not found`;
        }
      });
    },

    deleteComponent: id => {
      set(state => {
        const deleted = state.components.delete(id);
        if (!deleted) {
          state.error = `Component with id ${id} not found`;
        } else {
          state.error = null;
        }
      });
    },

    duplicateComponent: (id, newName) => {
      const component = get().getComponent(id);
      if (!component) {
        set(state => {
          state.error = `Component with id ${id} not found`;
        });
        return null;
      }

      const now = Date.now();
      const duplicated: ComponentDefinition = {
        ...component,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Simple UUID alternative
        name: newName,
        metadata: {
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
          lastUsed: undefined,
          isTemplate: false,
          favorite: false,
        },
      };

      set(state => {
        state.components.set(duplicated.id, duplicated);
        state.error = null;
      });

      return duplicated;
    },

    // ========================================================================
    // Option Management (for Select Components)
    // ========================================================================

    addOptionToComponent: (componentId, option) => {
      set(state => {
        const component = state.components.get(componentId);
        if (component && isSelectComponent(component)) {
          const updatedConfig = {
            ...component.config,
            options: [...component.config.options, option],
          };
          state.components.set(componentId, {
            ...component,
            config: updatedConfig,
            metadata: {
              ...component.metadata,
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Select component with id ${componentId} not found`;
        }
      });
    },

    updateOptionInComponent: (componentId, optionId, updates) => {
      set(state => {
        const component = state.components.get(componentId);
        if (component && isSelectComponent(component)) {
          const updatedOptions = component.config.options.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
          );
          state.components.set(componentId, {
            ...component,
            config: {
              ...component.config,
              options: updatedOptions,
            },
            metadata: {
              ...component.metadata,
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Select component with id ${componentId} not found`;
        }
      });
    },

    removeOptionFromComponent: (componentId, optionId) => {
      set(state => {
        const component = state.components.get(componentId);
        if (component && isSelectComponent(component)) {
          const updatedOptions = component.config.options.filter(opt => opt.id !== optionId);
          state.components.set(componentId, {
            ...component,
            config: {
              ...component.config,
              options: updatedOptions,
            },
            metadata: {
              ...component.metadata,
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Select component with id ${componentId} not found`;
        }
      });
    },

    reorderOptionsInComponent: (componentId, fromIndex, toIndex) => {
      set(state => {
        const component = state.components.get(componentId);
        if (component && isSelectComponent(component)) {
          const options = [...component.config.options];
          const [movedOption] = options.splice(fromIndex, 1);
          options.splice(toIndex, 0, movedOption);

          state.components.set(componentId, {
            ...component,
            config: {
              ...component.config,
              options,
            },
            metadata: {
              ...component.metadata,
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Select component with id ${componentId} not found`;
        }
      });
    },

    // ========================================================================
    // Bulk Operations
    // ========================================================================

    setComponentsFromStorage: components => {
      set(state => {
        state.components = new Map(components.map(c => [c.id, c]));
        state.error = null;
      });
    },

    importComponents: components => {
      set(state => {
        components.forEach(component => {
          state.components.set(component.id, component);
        });
        state.error = null;
      });
    },

    exportComponent: id => {
      const component = get().getComponent(id);
      if (!component) {
        set(state => {
          state.error = `Component with id ${id} not found`;
        });
        return null;
      }
      return component;
    },

    clearAllComponents: () => {
      set(state => {
        state.components.clear();
        state.error = null;
      });
    },

    // ========================================================================
    // Getters
    // ========================================================================

    getComponent: id => {
      return get().components.get(id);
    },

    getAllComponents: () => {
      return Array.from(get().components.values());
    },

    getComponentsByType: type => {
      return Array.from(get().components.values()).filter(c => c.type === type);
    },

    getFavoriteComponents: () => {
      return Array.from(get().components.values()).filter(c => c.metadata.favorite === true);
    },

    getRecentComponents: limit => {
      const components = Array.from(get().components.values());
      // Sort by lastUsed if available, otherwise by createdAt
      // This ensures newly created components show up even if not used yet
      return components
        .sort((a, b) => {
          const aTime = a.metadata.lastUsed || a.metadata.createdAt;
          const bTime = b.metadata.lastUsed || b.metadata.createdAt;
          return bTime - aTime;
        })
        .slice(0, limit);
    },

    getComponentCount: () => {
      return get().components.size;
    },

    // ========================================================================
    // Utility Actions
    // ========================================================================

    toggleFavorite: id => {
      set(state => {
        const component = state.components.get(id);
        if (component) {
          state.components.set(id, {
            ...component,
            metadata: {
              ...component.metadata,
              favorite: !component.metadata.favorite,
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Component with id ${id} not found`;
        }
      });
    },

    incrementUsageCount: id => {
      set(state => {
        const component = state.components.get(id);
        if (component) {
          state.components.set(id, {
            ...component,
            metadata: {
              ...component.metadata,
              usageCount: component.metadata.usageCount + 1,
              lastUsed: Date.now(),
              updatedAt: Date.now(),
            },
          });
          state.error = null;
        } else {
          state.error = `Component with id ${id} not found`;
        }
      });
    },

    searchComponents: query => {
      const lowerQuery = query.toLowerCase();
      return Array.from(get().components.values()).filter(
        c => c.name.toLowerCase().includes(lowerQuery) || c.type.toLowerCase().includes(lowerQuery)
      );
    },

    // ========================================================================
    // State Management
    // ========================================================================

    setLoading: isLoading => {
      set(state => {
        state.isLoading = isLoading;
      });
    },

    setError: error => {
      set(state => {
        state.error = error;
      });
    },
  }))
);

// ============================================================================
// Selector Hooks (for optimized subscriptions)
// ============================================================================

/**
 * Subscribe to specific component by ID
 */
export const useComponent = (id: string) =>
  useComponentLibraryStore(state => state.getComponent(id));

/**
 * Subscribe to all components
 */
export const useAllComponents = () => useComponentLibraryStore(state => state.getAllComponents());

/**
 * Subscribe to components by type
 */
export const useComponentsByType = (type: ComponentType) =>
  useComponentLibraryStore(state => state.getComponentsByType(type));

/**
 * Subscribe to favorite components
 */
export const useFavoriteComponents = () =>
  useComponentLibraryStore(state => state.getFavoriteComponents());

/**
 * Subscribe to component count
 */
export const useComponentCount = () => useComponentLibraryStore(state => state.getComponentCount());

/**
 * Subscribe to loading state
 */
export const useComponentLibraryLoading = () => useComponentLibraryStore(state => state.isLoading);

/**
 * Subscribe to error state
 */
export const useComponentLibraryError = () => useComponentLibraryStore(state => state.error);
