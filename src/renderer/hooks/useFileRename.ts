/**
 * @file useFileRename.ts
 * @description Custom hook for managing file rename operations.
 * Provides preview generation, validation, and execution of batch renames.
 */

import { useState, useMemo, useCallback } from 'react';
import { RenameComponent, ShelfItem, FileRenamePreview } from '@shared/types';
import {
  generateRenamePreview,
  executeFileRenames,
  RenameResult,
  ExecuteRenameOptions,
} from '@renderer/utils/renameUtils';
import { validateFileRenames, formatValidationWarning } from '@renderer/utils/fileValidation';
import { useAsyncOperation } from './useAsyncOperation';
import { logger } from '@shared/logger';

/**
 * Result of the useFileRename hook
 */
export interface UseFileRenameResult {
  /**
   * Current rename pattern components
   */
  components: RenameComponent[];
  /**
   * Update the rename pattern components
   */
  setComponents: (components: RenameComponent[]) => void;
  /**
   * Generated preview of renamed files
   */
  previews: FileRenamePreview[];
  /**
   * Execute the rename operation
   */
  executeRename: (files: ShelfItem[], destinationPath: string) => Promise<RenameResult[]>;
  /**
   * Validate rename operation
   */
  validate: (
    files: ShelfItem[],
    destinationPath: string
  ) => {
    isValid: boolean;
    warning?: { message: string; details: React.ReactNode };
  };
  /**
   * Whether rename is currently in progress
   */
  isRenaming: boolean;
  /**
   * Error from last rename operation
   */
  error: Error | null;
  /**
   * Results from last rename operation
   */
  results: RenameResult[] | null;
}

/**
 * Options for the useFileRename hook
 */
export interface UseFileRenameOptions {
  /**
   * Initial rename pattern components
   */
  initialComponents?: RenameComponent[];
  /**
   * Callback when rename completes successfully
   */
  onSuccess?: (results: RenameResult[]) => void;
  /**
   * Callback when rename fails
   */
  onError?: (error: Error) => void;
  /**
   * Callback for progress updates
   */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Hook for managing file rename operations.
 * Handles preview generation, validation, and execution with loading states.
 *
 * @param files - Array of ShelfItems to rename
 * @param options - Configuration options
 * @returns Object with rename state and operations
 *
 * @example
 * ```typescript
 * const {
 *   components,
 *   setComponents,
 *   previews,
 *   executeRename,
 *   validate,
 *   isRenaming
 * } = useFileRename(selectedFiles, {
 *   onSuccess: (results) => console.log('Renamed:', results),
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
 * });
 * ```
 */
export function useFileRename(
  files: ShelfItem[],
  options: UseFileRenameOptions = {}
): UseFileRenameResult {
  const {
    initialComponents = [
      { id: 'date-1', type: 'date', format: 'YYYYMMDD' },
      { id: 'fileName-1', type: 'fileName' },
    ],
    onSuccess,
    onError,
    onProgress,
  } = options;

  const [components, setComponents] = useState<RenameComponent[]>(initialComponents);

  // Generate previews whenever files or components change
  const previews = useMemo(() => {
    return generateRenamePreview(files, components);
  }, [files, components]);

  // Async operation for executing renames
  const renameOperation = useAsyncOperation(
    async (filesToRename: ShelfItem[], renameOptions: ExecuteRenameOptions) => {
      return executeFileRenames(filesToRename, previews, renameOptions);
    },
    {
      operationName: 'File Rename',
      onSuccess: () => {
        if (renameOperation.data) {
          onSuccess?.(renameOperation.data);
        }
      },
      onError,
    }
  );

  // Validate rename operation
  const validate = useCallback(
    (filesToValidate: ShelfItem[], destinationPath: string) => {
      // Create a map of file IDs to their new names
      const newNamesMap = new Map<string, string>();
      filesToValidate.forEach((file, index) => {
        const preview = previews[index];
        if (preview) {
          newNamesMap.set(file.id, preview.newName);
        }
      });

      // Validate the rename operations
      const validation = validateFileRenames(filesToValidate, newNamesMap, destinationPath);

      if (!validation.isValid) {
        const warning = formatValidationWarning(validation);
        return { isValid: false, warning };
      }

      return { isValid: true };
    },
    [previews]
  );

  // Execute rename operation
  const executeRename = useCallback(
    async (filesToRename: ShelfItem[], destinationPath: string): Promise<RenameResult[]> => {
      logger.info(`🚀 Starting rename of ${filesToRename.length} files`);

      // Validate first
      const validation = validate(filesToRename, destinationPath);
      if (!validation.isValid) {
        const error = new Error('Validation failed: ' + validation.warning?.message);
        logger.error('Rename validation failed:', error);
        throw error;
      }

      // Execute rename with progress tracking
      const results = await renameOperation.execute(filesToRename, {
        onProgress,
        onFileComplete: result => {
          logger.debug(
            `File rename ${result.success ? 'succeeded' : 'failed'}: ${result.originalName} → ${result.newName}`
          );
        },
      });

      return results || [];
    },
    [validate, renameOperation, onProgress]
  );

  return {
    components,
    setComponents,
    previews,
    executeRename,
    validate,
    isRenaming: renameOperation.isLoading,
    error: renameOperation.error,
    results: renameOperation.data,
  };
}
