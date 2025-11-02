import { ipcMain } from 'electron';
import type { ComponentDefinition } from '../../shared/types/componentDefinition';
import { logger } from '../modules/utils/logger';
import Store from 'electron-store';

// IPC Response type for consistent error handling
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Storage schema for component library
interface ComponentLibraryStorage {
  version: string;
  components: Record<string, ComponentDefinition>;
  metadata: {
    lastUpdated: number;
    componentCount: number;
  };
}

// Initialize electron-store for component library persistence
const componentStore = new Store<{ componentLibrary: ComponentLibraryStorage }>({
  name: 'component-library',
  defaults: {
    componentLibrary: {
      version: '1.0',
      components: {},
      metadata: {
        lastUpdated: Date.now(),
        componentCount: 0,
      },
    },
  },
});

// Helper function to create response
function createResponse<T>(success: boolean, data?: T, error?: string): IPCResponse<T> {
  return { success, data, error };
}

// Helper function to handle async IPC calls with error handling
async function handleAsyncIPC<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<IPCResponse<T>> {
  try {
    const result = await operation();
    logger.debug(`IPC ${operationName} completed successfully`);
    return createResponse(true, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`IPC ${operationName} failed:`, error);
    return createResponse(false, undefined as T, errorMessage);
  }
}

/**
 * Register all component library IPC handlers
 */
export function registerComponentHandlers(): void {
  // Save component library
  ipcMain.handle(
    'component:save-library',
    async (event, components: ComponentDefinition[]): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        const componentsMap: Record<string, ComponentDefinition> = {};
        components.forEach(component => {
          componentsMap[component.id] = component;
        });

        const libraryData: ComponentLibraryStorage = {
          version: '1.0',
          components: componentsMap,
          metadata: {
            lastUpdated: Date.now(),
            componentCount: components.length,
          },
        };

        componentStore.set('componentLibrary', libraryData);
        logger.info(`Component library saved: ${components.length} components`);
      }, 'component:save-library');
    }
  );

  // Load component library
  ipcMain.handle(
    'component:load-library',
    async (): Promise<IPCResponse<ComponentDefinition[]>> => {
      return handleAsyncIPC(async () => {
        const libraryData = componentStore.get('componentLibrary');
        const components = Object.values(libraryData.components);
        logger.info(`Component library loaded: ${components.length} components`);
        return components;
      }, 'component:load-library');
    }
  );

  // Export component to file
  ipcMain.handle(
    'component:export',
    async (event, component: ComponentDefinition, filePath: string): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        const fs = await import('fs/promises');
        const exportData = {
          version: '1.0',
          component,
          exportedAt: Date.now(),
        };
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        logger.info(`Component exported to: ${filePath}`);
      }, 'component:export');
    }
  );

  // Export multiple components to file
  ipcMain.handle(
    'component:export-multiple',
    async (
      event,
      components: ComponentDefinition[],
      filePath: string
    ): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        const fs = await import('fs/promises');
        const exportData = {
          version: '1.0',
          components,
          exportedAt: Date.now(),
          count: components.length,
        };
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        logger.info(`${components.length} components exported to: ${filePath}`);
      }, 'component:export-multiple');
    }
  );

  // Import component from file
  ipcMain.handle(
    'component:import',
    async (
      event,
      filePath: string
    ): Promise<IPCResponse<ComponentDefinition | ComponentDefinition[]>> => {
      return handleAsyncIPC(async () => {
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const importData = JSON.parse(fileContent);

        // Support both single component and multiple components
        if (importData.component) {
          logger.info(`Component imported from: ${filePath}`);
          return importData.component as ComponentDefinition;
        } else if (importData.components) {
          logger.info(`${importData.components.length} components imported from: ${filePath}`);
          return importData.components as ComponentDefinition[];
        } else {
          throw new Error('Invalid component file format');
        }
      }, 'component:import');
    }
  );

  // Get component library stats
  ipcMain.handle(
    'component:get-stats',
    async (): Promise<
      IPCResponse<{ componentCount: number; lastUpdated: number; version: string }>
    > => {
      return handleAsyncIPC(async () => {
        const libraryData = componentStore.get('componentLibrary');
        return {
          componentCount: libraryData.metadata.componentCount,
          lastUpdated: libraryData.metadata.lastUpdated,
          version: libraryData.version,
        };
      }, 'component:get-stats');
    }
  );

  // Backup component library
  ipcMain.handle('component:backup', async (): Promise<IPCResponse<void>> => {
    return handleAsyncIPC(async () => {
      const libraryData = componentStore.get('componentLibrary');
      const backupKey = `componentLibrary_backup_${Date.now()}`;
      componentStore.set(backupKey as any, libraryData);
      logger.info(`Component library backed up: ${backupKey}`);
    }, 'component:backup');
  });

  // Clear all components (with confirmation required from renderer)
  ipcMain.handle('component:clear-all', async (): Promise<IPCResponse<void>> => {
    return handleAsyncIPC(async () => {
      componentStore.set('componentLibrary', {
        version: '1.0',
        components: {},
        metadata: {
          lastUpdated: Date.now(),
          componentCount: 0,
        },
      });
      logger.info('Component library cleared');
    }, 'component:clear-all');
  });

  logger.info('Component library IPC handlers registered');
}
