import { ipcMain, dialog, BrowserWindow } from 'electron';
import { SavedPattern } from '@shared/types';
import { patternPersistenceManager } from '../modules/storage/pattern_persistence_manager';
import { logger } from '../modules/utils/logger';

// IPC Response type for consistent error handling
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Options for listing patterns
interface ListPatternsOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
  includeBuiltIn?: boolean;
  favorite?: boolean;
  tags?: string[];
}

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

export function registerPatternHandlers(): void {
  // Save pattern
  ipcMain.handle(
    'pattern:save',
    async (event, pattern: SavedPattern): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        await patternPersistenceManager.savePattern(pattern);
      }, 'pattern:save');
    }
  );

  // Load pattern
  ipcMain.handle(
    'pattern:load',
    async (event, id: string): Promise<IPCResponse<SavedPattern | null>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.loadPattern(id);
      }, 'pattern:load');
    }
  );

  // Update pattern
  ipcMain.handle(
    'pattern:update',
    async (event, id: string, updates: Partial<SavedPattern>): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        await patternPersistenceManager.updatePattern(id, updates);
      }, 'pattern:update');
    }
  );

  // Delete pattern
  ipcMain.handle('pattern:delete', async (event, id: string): Promise<IPCResponse<boolean>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.deletePattern(id);
    }, 'pattern:delete');
  });

  // List patterns
  ipcMain.handle(
    'pattern:list',
    async (event, options?: ListPatternsOptions): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.listPatterns(options);
      }, 'pattern:list');
    }
  );

  // Search patterns
  ipcMain.handle(
    'pattern:search',
    async (event, query: string): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.searchPatterns(query);
      }, 'pattern:search');
    }
  );

  // Get patterns by tag
  ipcMain.handle(
    'pattern:get-by-tag',
    async (event, tag: string): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.getPatternsByTag(tag);
      }, 'pattern:get-by-tag');
    }
  );

  // Get recent patterns
  ipcMain.handle(
    'pattern:get-recent',
    async (event, limit?: number): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.getRecentPatterns(limit);
      }, 'pattern:get-recent');
    }
  );

  // Get favorite patterns
  ipcMain.handle('pattern:get-favorites', async (): Promise<IPCResponse<SavedPattern[]>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.getFavoritePatterns();
    }, 'pattern:get-favorites');
  });

  // Increment usage count
  ipcMain.handle(
    'pattern:increment-usage',
    async (event, id: string): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        await patternPersistenceManager.incrementUsageCount(id);
      }, 'pattern:increment-usage');
    }
  );

  // Get usage statistics
  ipcMain.handle('pattern:get-stats', async (): Promise<IPCResponse<unknown>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.getUsageStats();
    }, 'pattern:get-stats');
  });

  // Batch operations
  ipcMain.handle(
    'pattern:save-multiple',
    async (event, patterns: SavedPattern[]): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        await patternPersistenceManager.saveMultiplePatterns(patterns);
      }, 'pattern:save-multiple');
    }
  );

  ipcMain.handle(
    'pattern:delete-multiple',
    async (event, ids: string[]): Promise<IPCResponse<number>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.deleteMultiplePatterns(ids);
      }, 'pattern:delete-multiple');
    }
  );

  // Export operations
  ipcMain.handle('pattern:export', async (event, id: string): Promise<IPCResponse<string>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.exportPattern(id);
    }, 'pattern:export');
  });

  ipcMain.handle('pattern:export-all', async (): Promise<IPCResponse<string>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.exportAllPatterns();
    }, 'pattern:export-all');
  });

  // Export with file dialog
  ipcMain.handle(
    'pattern:export-to-file',
    async (event, id: string): Promise<IPCResponse<string>> => {
      return handleAsyncIPC(async () => {
        const pattern = await patternPersistenceManager.loadPattern(id);
        if (!pattern) {
          throw new Error('Pattern not found');
        }

        const result = await dialog.showSaveDialog({
          title: 'Export Pattern',
          defaultPath: `${pattern.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          throw new Error('Export canceled by user');
        }

        const exportData = await patternPersistenceManager.exportPattern(id);

        const fs = await import('fs/promises');
        await fs.writeFile(result.filePath, exportData, 'utf8');

        return result.filePath;
      }, 'pattern:export-to-file');
    }
  );

  ipcMain.handle('pattern:export-all-to-file', async (): Promise<IPCResponse<string>> => {
    return handleAsyncIPC(async () => {
      const result = await dialog.showSaveDialog({
        title: 'Export All Patterns',
        defaultPath: `patterns_export_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Export canceled by user');
      }

      const exportData = await patternPersistenceManager.exportAllPatterns();

      const fs = await import('fs/promises');
      await fs.writeFile(result.filePath, exportData, 'utf8');

      return result.filePath;
    }, 'pattern:export-all-to-file');
  });

  // Import operations
  ipcMain.handle(
    'pattern:import',
    async (event, data: string): Promise<IPCResponse<SavedPattern>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.importPattern(data);
      }, 'pattern:import');
    }
  );

  ipcMain.handle(
    'pattern:import-multiple',
    async (event, data: string): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        return await patternPersistenceManager.importPatterns(data);
      }, 'pattern:import-multiple');
    }
  );

  // Import from file dialog
  ipcMain.handle(
    'pattern:import-from-file',
    async (event): Promise<IPCResponse<SavedPattern[]>> => {
      return handleAsyncIPC(async () => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);

        if (!senderWindow) {
          logger.warn('Failed to find parent window for import dialog, using global dialog');
        }

        const dialogOptions = {
          title: 'Import Patterns',
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile' as const],
        };

        const result = senderWindow
          ? await dialog.showOpenDialog(senderWindow, dialogOptions)
          : await dialog.showOpenDialog(dialogOptions);

        if (result.canceled || result.filePaths.length === 0) {
          throw new Error('Import canceled by user');
        }

        const fs = await import('fs/promises');
        const data = await fs.readFile(result.filePaths[0], 'utf8');

        // Try to import as multiple patterns first, fallback to single pattern
        try {
          return await patternPersistenceManager.importPatterns(data);
        } catch (error) {
          // If multiple import fails, try single pattern import
          const singlePattern = await patternPersistenceManager.importPattern(data);
          return [singlePattern];
        }
      }, 'pattern:import-from-file');
    }
  );

  // Maintenance operations
  ipcMain.handle('pattern:vacuum', async (): Promise<IPCResponse<void>> => {
    return handleAsyncIPC(async () => {
      await patternPersistenceManager.vacuum();
    }, 'pattern:vacuum');
  });

  ipcMain.handle('pattern:backup', async (): Promise<IPCResponse<string>> => {
    return handleAsyncIPC(async () => {
      return await patternPersistenceManager.backup();
    }, 'pattern:backup');
  });

  ipcMain.handle(
    'pattern:restore',
    async (event, backupPath: string): Promise<IPCResponse<void>> => {
      return handleAsyncIPC(async () => {
        await patternPersistenceManager.restore(backupPath);
      }, 'pattern:restore');
    }
  );

  // Backup with file dialog
  ipcMain.handle('pattern:backup-to-file', async (): Promise<IPCResponse<string>> => {
    return handleAsyncIPC(async () => {
      const result = await dialog.showSaveDialog({
        title: 'Backup Patterns',
        defaultPath: `patterns_backup_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Backup canceled by user');
      }

      const exportData = await patternPersistenceManager.exportAllPatterns();

      const fs = await import('fs/promises');
      await fs.writeFile(result.filePath, exportData, 'utf8');

      return result.filePath;
    }, 'pattern:backup-to-file');
  });

  ipcMain.handle('pattern:restore-from-file', async (event): Promise<IPCResponse<void>> => {
    return handleAsyncIPC(async () => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (!senderWindow) {
        logger.warn('Failed to find parent window for restore dialog, using global dialog');
      }

      const dialogOptions = {
        title: 'Restore Patterns from Backup',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile' as const],
      };

      const result = senderWindow
        ? await dialog.showOpenDialog(senderWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Restore canceled by user');
      }

      await patternPersistenceManager.restore(result.filePaths[0]);
    }, 'pattern:restore-from-file');
  });

  logger.info('Pattern IPC handlers registered successfully');
}

// Clean up function to remove handlers
export function unregisterPatternHandlers(): void {
  const channels = [
    'pattern:save',
    'pattern:load',
    'pattern:update',
    'pattern:delete',
    'pattern:list',
    'pattern:search',
    'pattern:get-by-tag',
    'pattern:get-recent',
    'pattern:get-favorites',
    'pattern:increment-usage',
    'pattern:get-stats',
    'pattern:save-multiple',
    'pattern:delete-multiple',
    'pattern:export',
    'pattern:export-all',
    'pattern:export-to-file',
    'pattern:export-all-to-file',
    'pattern:import',
    'pattern:import-multiple',
    'pattern:import-from-file',
    'pattern:vacuum',
    'pattern:backup',
    'pattern:restore',
    'pattern:backup-to-file',
    'pattern:restore-from-file',
  ];

  channels.forEach(channel => {
    ipcMain.removeAllListeners(channel);
  });

  logger.info('Pattern IPC handlers unregistered');
}
