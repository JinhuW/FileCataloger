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
import { generateUniqueId } from '@renderer/utils/idGenerator';
import { DEFAULT_FILE_METADATA_CONFIG } from '@renderer/constants/componentTypes';

// ============================================================================
// System Components
// ============================================================================

/**
 * System File Metadata Component
 * Always appears first in the library, unremovable
 */
export const SYSTEM_FILE_METADATA_COMPONENT: ComponentDefinition = {
  id: 'system-file-metadata',
  name: 'File Metadata',
  description: 'Extract file information and properties',
  type: 'fileMetadata',
  icon: '📋',
  color: '#f59e0b', // amber
  scope: 'global',
  config: DEFAULT_FILE_METADATA_CONFIG,
  metadata: {
    createdAt: 0, // System component
    updatedAt: 0,
    usageCount: 0,
    isTemplate: false,
    favorite: false,
  },
};

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
  getUserComponents: () => ComponentDefinition[]; // User components only (excluding system)
  getSystemComponents: () => ComponentDefinition[]; // System components only
  getComponentsByType: (type: ComponentType) => ComponentDefinition[];
  getFavoriteComponents: () => ComponentDefinition[];
  getRecentComponents: (limit: number) => ComponentDefinition[];
  getComponentCount: () => number;
  isSystemComponent: (id: string) => boolean;

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
    components: new Map([[SYSTEM_FILE_METADATA_COMPONENT.id, SYSTEM_FILE_METADATA_COMPONENT]]),
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
        // Prevent deletion of system components
        if (id === SYSTEM_FILE_METADATA_COMPONENT.id) {
          state.error = 'System components cannot be deleted';
          return;
        }

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
        id: generateUniqueId(),
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
        // Always include system components
        state.components = new Map([
          [SYSTEM_FILE_METADATA_COMPONENT.id, SYSTEM_FILE_METADATA_COMPONENT],
          ...components.map(c => [c.id, c] as [string, ComponentDefinition]),
        ]);
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

    getUserComponents: () => {
      return Array.from(get().components.values()).filter(
        c => c.id !== SYSTEM_FILE_METADATA_COMPONENT.id
      );
    },

    getSystemComponents: () => {
      return [SYSTEM_FILE_METADATA_COMPONENT];
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

    isSystemComponent: id => {
      return id === SYSTEM_FILE_METADATA_COMPONENT.id;
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
