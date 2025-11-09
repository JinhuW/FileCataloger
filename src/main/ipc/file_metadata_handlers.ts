import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { extname } from 'path';
import { logger } from '../modules/utils/logger';

// IPC Response type for consistent error handling
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// File metadata interface matching ShelfItem.metadata
interface FileMetadata {
  extension?: string;
  birthtime?: number;
  mtime?: number;
  atime?: number;
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

/**
 * Extract file system metadata (stats) for a given file path
 */
async function extractFileStats(filePath: string): Promise<Partial<FileMetadata>> {
  try {
    const stats = await fs.stat(filePath);
    const extension = extname(filePath).slice(1); // Remove the leading dot

    return {
      extension: extension || undefined,
      birthtime: stats.birthtimeMs,
      mtime: stats.mtimeMs,
      atime: stats.atimeMs,
    };
  } catch (error) {
    logger.error(`Failed to extract file stats for ${filePath}:`, error);
    return {};
  }
}

/**
 * Extract complete file metadata (basic file stats only)
 */
async function extractFileMetadata(filePath: string): Promise<FileMetadata> {
  // Extract basic file stats
  const metadata = await extractFileStats(filePath);
  return metadata;
}

/**
 * Register file metadata IPC handlers
 */
export function registerFileMetadataHandlers(): void {
  // Get file metadata
  ipcMain.handle(
    'file:get-metadata',
    async (event, filePath: string): Promise<IPCResponse<FileMetadata>> => {
      return handleAsyncIPC(async () => {
        if (!filePath) {
          throw new Error('File path is required');
        }

        return await extractFileMetadata(filePath);
      }, 'file:get-metadata');
    }
  );

  // Batch get metadata for multiple files
  ipcMain.handle(
    'file:get-metadata-batch',
    async (event, filePaths: string[]): Promise<IPCResponse<Record<string, FileMetadata>>> => {
      return handleAsyncIPC(async () => {
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          throw new Error('File paths array is required');
        }

        const results: Record<string, FileMetadata> = {};

        // Process files in parallel for better performance
        await Promise.all(
          filePaths.map(async filePath => {
            try {
              results[filePath] = await extractFileMetadata(filePath);
            } catch (error) {
              logger.error(`Failed to get metadata for ${filePath}:`, error);
              // Still include in results with empty metadata
              results[filePath] = {};
            }
          })
        );

        return results;
      }, 'file:get-metadata-batch');
    }
  );

  logger.info('File metadata IPC handlers registered successfully');
}

/**
 * Clean up function to remove handlers
 */
export function unregisterFileMetadataHandlers(): void {
  const channels = ['file:get-metadata', 'file:get-metadata-batch'];

  channels.forEach(channel => {
    ipcMain.removeAllListeners(channel);
  });

  logger.info('File metadata IPC handlers unregistered');
}
