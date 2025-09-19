import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ShelfConfig, ShelfItem, ShelfMode, DockPosition } from '@shared/types';
import { logger } from '@shared/logger';

interface ShelfStore {
  // State
  shelves: Map<string, ShelfConfig>;
  activeShelfId: string | null;
  dragOverShelfId: string | null;

  // Actions - Shelf Management
  addShelf: (config: ShelfConfig) => void;
  updateShelf: (id: string, updates: Partial<ShelfConfig>) => void;
  removeShelf: (id: string) => void;
  setActiveShelf: (id: string | null) => void;

  // Actions - Item Management
  addItemToShelf: (shelfId: string, item: ShelfItem) => void;
  addItemsToShelf: (shelfId: string, items: ShelfItem[]) => void;
  removeItemFromShelf: (shelfId: string, itemId: string) => void;
  updateItemInShelf: (shelfId: string, itemId: string, updates: Partial<ShelfItem>) => void;
  clearShelfItems: (shelfId: string) => void;

  // Actions - Shelf Properties
  setShelfVisibility: (shelfId: string, isVisible: boolean) => void;
  setShelfPosition: (shelfId: string, position: { x: number; y: number }) => void;
  setShelfDockPosition: (shelfId: string, dockPosition: DockPosition | null) => void;
  setShelfPinned: (shelfId: string, isPinned: boolean) => void;
  setShelfMode: (shelfId: string, mode: ShelfMode) => void;
  setShelfOpacity: (shelfId: string, opacity: number) => void;

  // Actions - Drag State
  setDragOverShelf: (shelfId: string | null) => void;

  // Getters
  getShelf: (id: string) => ShelfConfig | undefined;
  getActiveShelf: () => ShelfConfig | undefined;
  getAllShelves: () => ShelfConfig[];
  getVisibleShelves: () => ShelfConfig[];
  getShelfItemCount: (shelfId: string) => number;
}

export const useShelfStore = create<ShelfStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      shelves: new Map(),
      activeShelfId: null,
      dragOverShelfId: null,

      // Shelf Management
      addShelf: config =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            newShelves.set(config.id, config);
            logger.debug('Added shelf:', config.id);
            return { shelves: newShelves };
          },
          false,
          'addShelf'
        ),

      updateShelf: (id, updates) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(id);
            if (shelf) {
              newShelves.set(id, { ...shelf, ...updates });
              logger.debug('Updated shelf:', id, updates);
            } else {
              logger.warn('Shelf not found for update:', id);
            }
            return { shelves: newShelves };
          },
          false,
          'updateShelf'
        ),

      removeShelf: id =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const deleted = newShelves.delete(id);
            if (deleted) {
              logger.debug('Removed shelf:', id);
            }
            return {
              shelves: newShelves,
              activeShelfId: state.activeShelfId === id ? null : state.activeShelfId,
              dragOverShelfId: state.dragOverShelfId === id ? null : state.dragOverShelfId,
            };
          },
          false,
          'removeShelf'
        ),

      setActiveShelf: id => set({ activeShelfId: id }, false, 'setActiveShelf'),

      // Item Management
      addItemToShelf: (shelfId, item) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, {
                ...shelf,
                items: [...shelf.items, item],
              });
              logger.debug('Added item to shelf:', shelfId, item.id);
            }
            return { shelves: newShelves };
          },
          false,
          'addItemToShelf'
        ),

      addItemsToShelf: (shelfId, items) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, {
                ...shelf,
                items: [...shelf.items, ...items],
              });
              logger.debug('Added', items.length, 'items to shelf:', shelfId);
            }
            return { shelves: newShelves };
          },
          false,
          'addItemsToShelf'
        ),

      removeItemFromShelf: (shelfId, itemId) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, {
                ...shelf,
                items: shelf.items.filter(item => item.id !== itemId),
              });
              logger.debug('Removed item from shelf:', shelfId, itemId);
            }
            return { shelves: newShelves };
          },
          false,
          'removeItemFromShelf'
        ),

      updateItemInShelf: (shelfId, itemId, updates) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, {
                ...shelf,
                items: shelf.items.map(item =>
                  item.id === itemId ? { ...item, ...updates } : item
                ),
              });
              logger.debug('Updated item in shelf:', shelfId, itemId);
            }
            return { shelves: newShelves };
          },
          false,
          'updateItemInShelf'
        ),

      clearShelfItems: shelfId =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, {
                ...shelf,
                items: [],
              });
              logger.debug('Cleared items from shelf:', shelfId);
            }
            return { shelves: newShelves };
          },
          false,
          'clearShelfItems'
        ),

      // Shelf Properties
      setShelfVisibility: (shelfId, isVisible) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, isVisible });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfVisibility'
        ),

      setShelfPosition: (shelfId, position) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, position });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfPosition'
        ),

      setShelfDockPosition: (shelfId, dockPosition) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, dockPosition });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfDockPosition'
        ),

      setShelfPinned: (shelfId, isPinned) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, isPinned });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfPinned'
        ),

      setShelfMode: (shelfId, mode) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, mode });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfMode'
        ),

      setShelfOpacity: (shelfId, opacity) =>
        set(
          state => {
            const newShelves = new Map(state.shelves);
            const shelf = newShelves.get(shelfId);
            if (shelf) {
              newShelves.set(shelfId, { ...shelf, opacity });
            }
            return { shelves: newShelves };
          },
          false,
          'setShelfOpacity'
        ),

      // Drag State
      setDragOverShelf: shelfId => set({ dragOverShelfId: shelfId }, false, 'setDragOverShelf'),

      // Getters
      getShelf: id => get().shelves.get(id),

      getActiveShelf: () => {
        const { activeShelfId, shelves } = get();
        return activeShelfId ? shelves.get(activeShelfId) : undefined;
      },

      getAllShelves: () => Array.from(get().shelves.values()),

      getVisibleShelves: () => Array.from(get().shelves.values()).filter(shelf => shelf.isVisible),

      getShelfItemCount: shelfId => {
        const shelf = get().shelves.get(shelfId);
        return shelf ? shelf.items.length : 0;
      },
    }),
    {
      name: 'shelf-store',
    }
  )
);

// Selectors for common queries
export const useShelf = (id: string) => useShelfStore(state => state.getShelf(id));
export const useActiveShelf = () => useShelfStore(state => state.getActiveShelf());
export const useVisibleShelves = () => useShelfStore(state => state.getVisibleShelves());
export const useShelfItemCount = (shelfId: string) =>
  useShelfStore(state => state.getShelfItemCount(shelfId));
