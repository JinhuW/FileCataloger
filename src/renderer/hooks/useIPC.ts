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
    return window.api.on(channel, handler);
  }, []);

  return { invoke, send, on, isConnected };
};
