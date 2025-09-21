import { useCallback, useEffect, useState } from 'react';

type IPCHandler = (...args: unknown[]) => void;

export const useIPC = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(!!window.api);
  }, []);

  const invoke = useCallback(async (channel: string, ...args: unknown[]) => {
    if (!window.api) {
      throw new Error('IPC not available');
    }
    return window.api.invoke(channel, ...args);
  }, []);

  const send = useCallback((channel: string, ...args: unknown[]) => {
    if (!window.api) {
      throw new Error('IPC not available');
    }
    window.api.send(channel, ...args);
  }, []);

  const on = useCallback((channel: string, handler: IPCHandler) => {
    if (!window.api) {
      return () => {};
    }

    const cleanup = window.api.on(channel, handler);

    // Return cleanup function that properly removes the listener
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      } else if (window.api?.off) {
        window.api.off(channel, handler);
      }
    };
  }, []);

  // Helper for creating IPC listener with cleanup - to be used in components
  const createIPCListener = useCallback(
    (channel: string, handler: IPCHandler) => {
      if (!window.api || !handler) return () => {};

      const cleanup = on(channel, handler);
      return cleanup;
    },
    [on]
  );

  return { invoke, send, on, createIPCListener, isConnected };
};
