/**
 * @file renameUtils.ts
 * @description Utility functions for file renaming operations.
 * Provides centralized logic for generating rename previews and executing renames.
 */

import { RenameComponent, ShelfItem, FileRenamePreview } from '@shared/types';
import type { ComponentInstance, ComponentDefinition } from '@shared/types/componentDefinition';
import { FILE_OPERATIONS } from '@renderer/constants/ui';
import { logger } from '@shared/logger';
import { resolveComponentValue, ComponentResolutionContext } from './componentValueResolver';

/**
 * Options for generating rename previews
 */
export interface GenerateRenamePreviewOptions {
  /**
   * Current date to use for date components (defaults to now)
   */
  currentDate?: Date;
  /**
   * Whether to preserve file extensions
   */
  preserveExtension?: boolean;
}

/**
 * Generates a preview of renamed files based on rename components.
 * Centralized logic extracted from FileRenameShelf to eliminate duplication.
 *
 * @param files - Array of ShelfItems to rename
 * @param components - Rename pattern components
 * @param options - Additional options for preview generation
 * @returns Array of FileRenamePreview objects
 */
export function generateRenamePreview(
  files: ShelfItem[],
  components: RenameComponent[],
  options: GenerateRenamePreviewOptions = {}
): FileRenamePreview[] {
  const { currentDate = new Date(), preserveExtension = true } = options;

  return files.map((file, fileIndex) => {
    let newName = '';

    components.forEach((component, index) => {
      if (index > 0) newName += '_'; // Add separator

      switch (component.type) {
        case 'date': {
          newName += formatDateComponent(currentDate, component.format);
          break;
        }
        case 'fileName': {
          const nameWithoutExt = removeFileExtension(file.name);
          newName += component.value || nameWithoutExt;
          break;
        }
        case 'text':
          newName += component.value || '';
          break;
        case 'counter':
          newName += String(fileIndex + 1).padStart(FILE_OPERATIONS.COUNTER_PADDING, '0');
          break;
        case 'project':
          newName += component.value || 'Project';
          break;
      }
    });

    // Add file extension (not for folders)
    // But only if it's not already included in the generated name
    if (preserveExtension && file.type !== 'folder') {
      const ext = getFileExtension(file.name);
      if (ext && !newName.endsWith(ext)) {
        newName += ext;
      }
    }

    return {
      originalName: file.name,
      newName,
      selected: true,
      type: file.type,
    };
  });
}

/**
 * Generates rename preview using the new ComponentInstance system.
 * This is the modern approach that replaces the legacy RenameComponent system.
 *
 * @param files - Array of ShelfItems to rename
 * @param instances - Component instances from the pattern builder
 * @param definitions - Map of component definitions (id -> definition)
 * @param options - Additional options for preview generation
 * @returns Array of FileRenamePreview objects
 */
export function generateRenamePreviewFromInstances(
  files: ShelfItem[],
  instances: ComponentInstance[],
  definitions: Map<string, ComponentDefinition>,
  options: GenerateRenamePreviewOptions = {}
): FileRenamePreview[] {
  const { preserveExtension = true } = options;

  // Determine if we should automatically append the extension
  // We should only auto-append if:
  // 1. Pattern includes fileExtension component (explicit extension control)
  // 2. Pattern includes fileNameWithExtension component (already has extension)
  // 3. Pattern has NO fileMetadata components AND user wants extension preserved

  const hasFileMetadataComponent = instances.some(instance => {
    const definition = definitions.get(instance.definitionId);
    return definition?.type === 'fileMetadata';
  });

  const hasExplicitExtension = instances.some(instance => {
    const definition = definitions.get(instance.definitionId);
    if (!definition || definition.type !== 'fileMetadata') {
      return false;
    }
    const selectedField = instance.value || definition.config.selectedField;
    return selectedField === 'fileExtension' || selectedField === 'fileNameWithExtension';
  });

  // Auto-append extension only if:
  // - No file metadata components at all (traditional text/date/number components)
  // - OR explicitly using fileExtension/fileNameWithExtension
  const shouldAutoAppendExtension = !hasFileMetadataComponent || hasExplicitExtension;

  return files.map((file, fileIndex) => {
    let newName = '';

    instances.forEach((instance, index) => {
      if (index > 0) newName += '_'; // Add separator

      const definition = definitions.get(instance.definitionId);
      if (!definition) {
        logger.warn(`Definition not found for instance: ${instance.definitionId}`);
        return;
      }

      // Create resolution context with file-specific data
      const context: ComponentResolutionContext = {
        fileIndex,
        fileName: file.name,
        fileCreatedDate: file.metadata?.birthtime,
        fileModifiedDate: file.metadata?.mtime,
        batchSize: files.length,
        fileItem: file, // Add the complete file item for metadata access
      };

      // Resolve the component value
      const value = resolveComponentValue(instance, definition, context);
      newName += value;
    });

    // Add file extension (not for folders)
    // Only auto-append if no file metadata OR if explicitly using extension fields
    if (preserveExtension && file.type !== 'folder' && shouldAutoAppendExtension) {
      const ext = getFileExtension(file.name);
      if (ext && !newName.endsWith(ext)) {
        newName += ext;
      }
    }

    return {
      originalName: file.name,
      newName,
      selected: true,
      type: file.type,
    };
  });
}

/**
 * Formats a date according to the specified format string.
 * Supports: YYYY, MM, DD, HH, mm, ss
 *
 * @param date - The date to format
 * @param format - Format string (e.g., 'YYYYMMDD', 'YYYY-MM-DD')
 * @returns Formatted date string
 */
export function formatDateComponent(date: Date, format: string = 'YYYYMMDD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Removes the file extension from a filename.
 *
 * @param filename - The filename to process
 * @returns Filename without extension
 */
export function removeFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Gets the file extension including the dot (e.g., '.txt').
 *
 * @param filename - The filename to process
 * @returns File extension with dot, or empty string if none
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^/.]+$/);
  return match ? match[0] : '';
}

/**
 * Result of a file rename operation
 */
export interface RenameResult {
  /**
   * Whether the rename was successful
   */
  success: boolean;
  /**
   * Original file name
   */
  originalName: string;
  /**
   * New file name
   */
  newName: string;
  /**
   * Original file path
   */
  oldPath: string;
  /**
   * New file path
   */
  newPath: string;
  /**
   * Error message if rename failed
   */
  error?: string;
}

/**
 * Options for executing batch file renames
 */
export interface ExecuteRenameOptions {
  /**
   * Maximum number of concurrent rename operations
   */
  maxConcurrent?: number;
  /**
   * Callback for progress updates
   */
  onProgress?: (completed: number, total: number) => void;
  /**
   * Callback for individual file completion
   */
  onFileComplete?: (result: RenameResult) => void;
}

/**
 * Executes batch file rename operations.
 * Processes files in batches to avoid overwhelming the filesystem.
 *
 * @param files - Array of ShelfItems to rename
 * @param previews - Array of rename previews with new names
 * @param options - Execution options
 * @returns Array of RenameResult objects
 */
export async function executeFileRenames(
  files: ShelfItem[],
  previews: FileRenamePreview[],
  options: ExecuteRenameOptions = {}
): Promise<RenameResult[]> {
  const {
    maxConcurrent = FILE_OPERATIONS.MAX_CONCURRENT_RENAMES,
    onProgress,
    onFileComplete,
  } = options;

  const results: RenameResult[] = [];
  const total = files.length;

  logger.info(`🔧 executeFileRenames: Starting rename of ${total} files`);

  // Process files in batches
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, Math.min(i + maxConcurrent, files.length));
    const batchPreviews = previews.slice(i, Math.min(i + maxConcurrent, files.length));

    const batchPromises = batch.map(async (file, batchIndex) => {
      const preview = batchPreviews[batchIndex];
      return renameFile(file, preview);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Report progress
    const completed = Math.min(i + maxConcurrent, files.length);
    onProgress?.(completed, total);

    // Report individual file completions
    batchResults.forEach(result => onFileComplete?.(result));
  }

  const successCount = results.filter(r => r.success).length;
  logger.info(`✅ executeFileRenames: Completed ${successCount}/${total} successful renames`);

  return results;
}

/**
 * Renames a single file via IPC.
 *
 * @param file - The ShelfItem to rename
 * @param preview - The rename preview with new name
 * @returns RenameResult object
 */
async function renameFile(file: ShelfItem, preview: FileRenamePreview): Promise<RenameResult> {
  // Validate that the file has a valid path
  if (!file.path || !file.path.includes('/')) {
    const error = 'No valid file path available';
    logger.error(`❌ Cannot rename ${file.name}: ${error}`);
    return {
      success: false,
      originalName: file.name,
      newName: preview.newName,
      oldPath: file.path || '',
      newPath: '',
      error,
    };
  }

  const oldPath = file.path;
  const directory = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newPath = directory + '/' + preview.newName;

  try {
    const result = await window.api.invoke('fs:rename-file', oldPath, newPath);
    if (result.success) {
      logger.info(`✅ File renamed: ${file.name} → ${preview.newName}`);
      return {
        success: true,
        originalName: file.name,
        newName: preview.newName,
        oldPath,
        newPath,
      };
    } else {
      logger.error(`❌ Failed to rename ${file.name}:`, result.error);
      return {
        success: false,
        originalName: file.name,
        newName: preview.newName,
        oldPath,
        newPath,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Rename failed for ${file.name}:`, error);
    return {
      success: false,
      originalName: file.name,
      newName: preview.newName,
      oldPath,
      newPath,
      error: errorMessage,
    };
  }
}
