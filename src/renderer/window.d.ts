// Type definitions for the window.api exposed by preload script

import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      // Specific API methods
      getShelfId: () => Promise<string>;
      showItemInFolder: (path: string) => void;
      openPath: (path: string) => void;
      getFilePath: (filePath: string) => Promise<string>;
    };
    electronAPI?: ElectronAPI;
  }
}

export {};
