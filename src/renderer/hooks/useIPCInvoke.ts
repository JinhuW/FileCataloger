/**
 * @file useIPCInvoke.ts
 * @description Custom hook for handling IPC communication with proper error handling,
 * loading states, and TypeScript support.
 *
 * @features
 * - Type-safe IPC invocation
 * - Automatic loading state management
 * - Comprehensive error handling
 * - Retry capability
 * - Abort support for cleanup
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@shared/logger';

interface UseIPCInvokeOptions {
  /**
   * Whether to retry on failure
   */
  retry?: boolean;
  /**
   * Number of retry attempts
   */
  retryCount?: number;
  /**
   * Delay between retries in milliseconds
   */
  retryDelay?: number;
  /**
   * Callback when operation succeeds
   */
  onSuccess?: <T>(data: T) => void;
  /**
   * Callback when operation fails
   */
  onError?: (error: Error) => void;
}

interface UseIPCInvokeResult<T> {
  /**
   * The data returned from the IPC call
   */
  data: T | null;
  /**
   * Any error that occurred during the IPC call
   */
  error: Error | null;
  /**
   * Whether the IPC call is in progress
   */
  loading: boolean;
  /**
   * Function to invoke the IPC call
   */
  invoke: (...args: any[]) => Promise<T | null>;
  /**
   * Function to reset the state
   */
  reset: () => void;
  /**
   * Function to abort the operation
   */
  abort: () => void;
}

/**
 * Custom hook for IPC communication with proper error handling and loading states
 *
 * @param channel - The IPC channel to invoke
 * @param options - Optional configuration for the hook
 * @returns An object with data, error, loading state, and control functions
 *
 * @example
 * ```typescript
 * const { data, error, loading, invoke } = useIPCInvoke<UserPreferences>('preferences:get');
 *
 * // Use in component
 * useEffect(() => {
 *   invoke();
 * }, []);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * if (data) return <PreferencesForm data={data} />;
 * ```
 */
export function useIPCInvoke<T = any>(
  channel: string,
  options: UseIPCInvokeOptions = {}
): UseIPCInvokeResult<T> {
  const { retry = false, retryCount = 3, retryDelay = 1000, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Track if component is mounted
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    abortRef.current = false;
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
    setLoading(false);
  }, []);

  const invoke = useCallback(
    async (...args: any[]): Promise<T | null> => {
      // Check if window.api is available
      if (!window.api) {
        const err = new Error('Electron API not available');
        setError(err);
        logger.error('IPC invoke failed - API not available:', channel);
        return null;
      }

      // Reset state
      setLoading(true);
      setError(null);
      abortRef.current = false;

      let attempts = 0;
      const maxAttempts = retry ? retryCount : 1;

      while (attempts < maxAttempts && !abortRef.current) {
        try {
          attempts++;

          logger.debug(`IPC invoke [${channel}]`, { attempt: attempts, args });

          const result = await window.api.invoke<T>(channel, ...args);

          if (abortRef.current || !mountedRef.current) {
            return null;
          }

          setData(result);
          setLoading(false);

          if (onSuccess) {
            onSuccess(result);
          }

          logger.debug(`IPC invoke succeeded [${channel}]`, { result });
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));

          logger.error(`IPC invoke failed [${channel}]`, {
            attempt: attempts,
            error: error.message,
            args,
          });

          if (attempts >= maxAttempts || abortRef.current) {
            if (!abortRef.current && mountedRef.current) {
              setError(error);
              setLoading(false);

              if (onError) {
                onError(error);
              }
            }
            return null;
          }

          // Wait before retry
          if (retry && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      return null;
    },
    [channel, retry, retryCount, retryDelay, onSuccess, onError]
  );

  return {
    data,
    error,
    loading,
    invoke,
    reset,
    abort,
  };
}

/**
 * Hook for IPC calls that should be invoked immediately on mount
 *
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the IPC call
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * const { data, error, loading } = useIPCInvokeOnMount<AppStatus>('app:get-status');
 * ```
 */
export function useIPCInvokeOnMount<T = any>(
  channel: string,
  args: any[] = [],
  options: UseIPCInvokeOptions = {}
): Omit<UseIPCInvokeResult<T>, 'invoke'> {
  const { data, error, loading, invoke, reset, abort } = useIPCInvoke<T>(channel, options);

  useEffect(() => {
    invoke(...args);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error, loading, reset, abort };
}

/**
 * Hook for IPC subscriptions (listening to events from main process)
 *
 * @param channel - The IPC channel to subscribe to
 * @param callback - Callback function when event is received
 *
 * @example
 * ```typescript
 * useIPCSubscription('app:status', (status: AppStatus) => {
 *   console.log('Received status update:', status);
 * });
 * ```
 */
export function useIPCSubscription<T = any>(channel: string, callback: (data: T) => void): void {
  useEffect(() => {
    if (!window.api) {
      logger.warn('Cannot subscribe to IPC - Electron API not available');
      return;
    }

    const cleanup = window.api.on(channel, (data: unknown) => {
      logger.debug(`IPC event received [${channel}]`, data);
      callback(data as T);
    });

    return cleanup;
  }, [channel, callback]);
}
