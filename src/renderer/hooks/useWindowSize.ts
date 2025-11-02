import { useState, useEffect, useCallback } from 'react';
import { useIPC } from './useIPC';

interface WindowSize {
  width: number;
  height: number;
}

interface UseWindowSizeReturn {
  size: WindowSize;
  requestResize: (width: number, height: number) => Promise<boolean>;
  isResizing: boolean;
}

/**
 * Hook to manage window size with main process synchronization
 * Ensures the invisible Electron window matches the React UI bounds
 */
export function useWindowSize(
  defaultWidth: number = 900,
  defaultHeight: number = 600
): UseWindowSizeReturn {
  const { invoke, on } = useIPC();
  const [size, setSize] = useState<WindowSize>({
    width: defaultWidth,
    height: defaultHeight,
  });
  const [isResizing, setIsResizing] = useState(false);

  // Listen for resize events from main process
  useEffect(() => {
    const cleanup = on('window:resized', (newSize: WindowSize) => {
      setSize(newSize);
      setIsResizing(false);
    });

    return cleanup;
  }, [on]);

  // Query initial window size on mount
  useEffect(() => {
    invoke('window:get-bounds')
      .then((bounds: { width: number; height: number } | null) => {
        if (bounds) {
          setSize({ width: bounds.width, height: bounds.height });
        }
      })
      .catch(() => {
        // Silently fail - will use default size
      });
  }, [invoke]);

  // Note: We rely on 'window:resized' IPC events from main process
  // instead of native window resize events to avoid feedback loops

  // Request resize from main process
  const requestResize = useCallback(
    async (width: number, height: number): Promise<boolean> => {
      setIsResizing(true);
      try {
        const result = (await invoke('window:resize', width, height)) as {
          success: boolean;
          width?: number;
          height?: number;
        };
        if (result?.success && result.width && result.height) {
          setSize({ width: result.width, height: result.height });
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsResizing(false);
      }
    },
    [invoke]
  );

  return { size, requestResize, isResizing };
}
