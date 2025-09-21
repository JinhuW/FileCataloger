import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
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
    immer((set, get) => ({
      // Initial state
      shelves: new Map(),
      activeShelfId: null,
      dragOverShelfId: null,

      // Shelf Management
      addShelf: config =>
        set(
          state => {
            state.shelves.set(config.id, config);
            logger.debug('Added shelf:', config.id);
          },
          false,
          'addShelf'
        ),

      updateShelf: (id, updates) =>
        set(
          state => {
            const shelf = state.shelves.get(id);
            if (shelf) {
              state.shelves.set(id, { ...shelf, ...updates });
              logger.debug('Updated shelf:', id, updates);
            } else {
              logger.warn('Shelf not found for update:', id);
            }
          },
          false,
          'updateShelf'
        ),

      removeShelf: id =>
        set(
          state => {
            const deleted = state.shelves.delete(id);
            if (deleted) {
              logger.debug('Removed shelf:', id);
              if (state.activeShelfId === id) {
                state.activeShelfId = null;
              }
              if (state.dragOverShelfId === id) {
                state.dragOverShelfId = null;
              }
            }
          },
          false,
          'removeShelf'
        ),

      setActiveShelf: id =>
        set(
          state => {
            state.activeShelfId = id;
          },
          false,
          'setActiveShelf'
        ),

      // Item Management
      addItemToShelf: (shelfId, item) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.items.push(item);
              logger.debug('Added item to shelf:', shelfId, item.id);
            }
          },
          false,
          'addItemToShelf'
        ),

      addItemsToShelf: (shelfId, items) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.items.push(...items);
              logger.debug('Added', items.length, 'items to shelf:', shelfId);
            }
          },
          false,
          'addItemsToShelf'
        ),

      removeItemFromShelf: (shelfId, itemId) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              const index = shelf.items.findIndex(item => item.id === itemId);
              if (index !== -1) {
                shelf.items.splice(index, 1);
                logger.debug('Removed item from shelf:', shelfId, itemId);
              }
            }
          },
          false,
          'removeItemFromShelf'
        ),

      updateItemInShelf: (shelfId, itemId, updates) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              const item = shelf.items.find(item => item.id === itemId);
              if (item) {
                Object.assign(item, updates);
                logger.debug('Updated item in shelf:', shelfId, itemId);
              }
            }
          },
          false,
          'updateItemInShelf'
        ),

      clearShelfItems: shelfId =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.items.length = 0;
              logger.debug('Cleared items from shelf:', shelfId);
            }
          },
          false,
          'clearShelfItems'
        ),

      // Shelf Properties
      setShelfVisibility: (shelfId, isVisible) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.isVisible = isVisible;
            }
          },
          false,
          'setShelfVisibility'
        ),

      setShelfPosition: (shelfId, position) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.position = position;
            }
          },
          false,
          'setShelfPosition'
        ),

      setShelfDockPosition: (shelfId, dockPosition) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.dockPosition = dockPosition;
            }
          },
          false,
          'setShelfDockPosition'
        ),

      setShelfPinned: (shelfId, isPinned) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.isPinned = isPinned;
            }
          },
          false,
          'setShelfPinned'
        ),

      setShelfMode: (shelfId, mode) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.mode = mode;
            }
          },
          false,
          'setShelfMode'
        ),

      setShelfOpacity: (shelfId, opacity) =>
        set(
          state => {
            const shelf = state.shelves.get(shelfId);
            if (shelf) {
              shelf.opacity = opacity;
            }
          },
          false,
          'setShelfOpacity'
        ),

      // Drag State
      setDragOverShelf: shelfId =>
        set(
          state => {
            state.dragOverShelfId = shelfId;
          },
          false,
          'setDragOverShelf'
        ),

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
    })),
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
