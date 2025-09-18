/**
 * @file window.d.ts
 * @description TypeScript type definitions for the window.api interface.
 * This file defines the API exposed by the preload script to the renderer process,
 * providing type safety for IPC communication between renderer and main processes.
 *
 * @api-methods
 * - send: Send one-way messages to main process
 * - on: Listen for events from main process
 * - removeAllListeners: Clean up event listeners
 * - invoke: Send request and await response from main process
 * - getShelfId: Get the current shelf window ID
 * - showItemInFolder: Reveal file in system file explorer
 * - openPath: Open file with default system application
 * - getFilePath: Convert file path for platform compatibility
 *
 * @usage
 * ```typescript
 * // Send message
 * window.api.send('shelf:close', shelfId);
 *
 * // Invoke with response
 * const status = await window.api.invoke('app:get-status');
 *
 * // Listen for events
 * window.api.on('shelf:config', (config) => { ... });
 * ```
 */

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
