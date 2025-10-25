/**
 * @file useAsyncOperation.ts
 * @description Custom hook for managing async operation states with loading indicators.
 * Provides a consistent pattern for handling loading, error, and success states.
 */

import { useState, useCallback } from 'react';
import { logger } from '@shared/logger';

/**
 * State of an async operation
 */
export interface AsyncOperationState<T> {
  /**
   * Whether the operation is currently running
   */
  isLoading: boolean;
  /**
   * Error from the last operation (if any)
   */
  error: Error | null;
  /**
   * Data from the last successful operation
   */
  data: T | null;
  /**
   * Whether the operation has completed at least once
   */
  hasCompleted: boolean;
}

/**
 * Options for async operation execution
 */
export interface ExecuteOptions {
  /**
   * Whether to log operation start/completion (default: true)
   */
  logOperation?: boolean;
  /**
   * Custom operation name for logging
   */
  operationName?: string;
  /**
   * Callback executed on success
   */
  onSuccess?: () => void;
  /**
   * Callback executed on error
   */
  onError?: (error: Error) => void;
}

/**
 * Result of the useAsyncOperation hook
 */
export interface UseAsyncOperationResult<T, Args extends unknown[]> {
  /**
   * Current state of the async operation
   */
  state: AsyncOperationState<T>;
  /**
   * Execute the async operation
   */
  execute: (...args: Args) => Promise<T | null>;
  /**
   * Reset the operation state
   */
  reset: () => void;
  /**
   * Convenience accessors
   */
  isLoading: boolean;
  error: Error | null;
  data: T | null;
}

/**
 * Hook for managing async operations with loading states.
 * Handles loading indicators, error states, and provides a clean API.
 *
 * @template T - Type of data returned by the operation
 * @template Args - Tuple type of arguments passed to the operation
 *
 * @param operation - The async function to execute
 * @param defaultOptions - Default options for all executions
 * @returns Object with operation state and execute function
 *
 * @example
 * ```typescript
 * const renameOp = useAsyncOperation(
 *   async (files: ShelfItem[]) => {
 *     return await executeRenames(files);
 *   },
 *   { operationName: 'File Rename' }
 * );
 *
 * // Execute the operation
 * await renameOp.execute(selectedFiles);
 *
 * // Check state
 * if (renameOp.isLoading) {
 *   // Show loading spinner
 * }
 * ```
 */
export function useAsyncOperation<T, Args extends unknown[]>(
  operation: (...args: Args) => Promise<T>,
  defaultOptions: ExecuteOptions = {}
): UseAsyncOperationResult<T, Args> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    isLoading: false,
    error: null,
    data: null,
    hasCompleted: false,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      const options = { ...defaultOptions };
      const { logOperation = true, operationName = 'Operation', onSuccess, onError } = options;

      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      if (logOperation) {
        logger.info(`🚀 Starting ${operationName}`);
      }

      try {
        const result = await operation(...args);

        setState({
          isLoading: false,
          error: null,
          data: result,
          hasCompleted: true,
        });

        if (logOperation) {
          logger.info(`✅ ${operationName} completed successfully`);
        }

        onSuccess?.();
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorObj,
          hasCompleted: true,
        }));

        if (logOperation) {
          logger.error(`❌ ${operationName} failed:`, errorObj);
        }

        onError?.(errorObj);
        return null;
      }
    },
    [operation, defaultOptions]
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      data: null,
      hasCompleted: false,
    });
  }, []);

  return {
    state,
    execute,
    reset,
    // Convenience accessors
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
  };
}
