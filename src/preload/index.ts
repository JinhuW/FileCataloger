/**
 * @fileoverview Preload script for FileCataloger Electron application
 *
 * This script acts as a secure bridge between the main process and renderer process,
 * exposing a limited API via contextBridge to maintain security through context isolation.
 *
 * Key responsibilities:
 * - Expose safe IPC communication methods (send, on, invoke, removeAllListeners)
 * - Validate all IPC channels against a whitelist to prevent unauthorized access
 * - Provide logging capabilities back to the main process
 * - Maintain compatibility by exposing both window.api and window.electronAPI
 *
 * Security notes:
 * - Only whitelisted channels in validChannels array can be used
 * - No direct Node.js API access is exposed to the renderer
 * - All errors are logged to the main process for debugging
 *
 * @see src/renderer/window.d.ts for TypeScript type definitions
 * @see src/shared/ipc-schema.ts for IPC message schemas
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Provide a minimal require shim for the renderer process
// This handles webpack externals that try to require('node:crypto')
// We redirect those to use the browser's Web Crypto API instead
(globalThis as any).require = function (moduleName: string) {
  if (moduleName === 'node:crypto' || moduleName === 'crypto') {
    // Return browser's crypto object for Web Crypto API
    return (globalThis as any).crypto || (typeof window !== 'undefined' ? window.crypto : {});
  }
  // For any other module, throw an error - renderer should not require Node modules
  throw new Error(`require() is not available in renderer process. Attempted to require: ${moduleName}`);
};

// Helper function to log messages via IPC
function logToMain(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  try {
    ipcRenderer.send('logger:log', {
      level: level === 'INFO' ? 1 : level === 'WARN' ? 2 : 3,
      levelName: level,
      message,
      timestamp: new Date().toISOString(),
      processType: 'preload',
    });
  } catch (error) {
    // If IPC fails, we can't do anything about it in preload
    // Silently fail to avoid exposing errors to renderer
  }
}

// Send startup log via IPC if in development
if (process.env.NODE_ENV === 'development') {
  // Defer sending until main process is ready
  setTimeout(() => {
    logToMain('INFO', '🔌 Preload script starting...');
  }, 100);
}

// Define valid IPC channels - expand this as needed
const validChannels = [
  'app:ready',
  'app:status',
  'app:get-status',
  'app:create-shelf',
  'app:update-config',
  'shelf:create',
  'shelf:destroy',
  'shelf:ready',
  'shelf:config',
  'shelf:items-updated',
  'shelf:toggle-pin',
  'shelf:close',
  'shelf:open-item',
  'shelf:add-files',
  'shelf:show-menu',
  'shelf:drop-start',
  'shelf:drop-end',
  'shelf:files-dropped',
  'shelf:add-item',
  'shelf:remove-item',
  'shelf:update-config',
  'shelf:debug',
  'settings:get',
  'settings:set',
  'logger:log',
  'logger:set-level',
  'preferences:get',
  'preferences:update',
  'preferences:reset',
  'preferences:export',
  'preferences:import',
  'dialog:select-folder',
  'dialog:show-message-box',
  'fs:check-path-type',
  'fs:rename-file',
  'fs:rename-files',
  'fs:test-rename',
  'drag:get-native-files',
  // Pattern channels
  'pattern:save',
  'pattern:load',
  'pattern:update',
  'pattern:delete',
  'pattern:list',
  'pattern:search',
  'pattern:get-by-tag',
  'pattern:get-recent',
  'pattern:get-favorites',
  'pattern:increment-usage',
  'pattern:get-stats',
  'pattern:save-multiple',
  'pattern:delete-multiple',
  'pattern:export',
  'pattern:export-all',
  'pattern:export-to-file',
  'pattern:export-all-to-file',
  'pattern:import',
  'pattern:import-multiple',
  'pattern:import-from-file',
  'pattern:vacuum',
  'pattern:backup',
  'pattern:restore',
  'pattern:backup-to-file',
  'pattern:restore-from-file',
  // Component Library channels
  'component:save-library',
  'component:load-library',
  'component:export',
  'component:export-multiple',
  'component:import',
  'component:get-stats',
  'component:backup',
  'component:clear-all',
  // Window resize channels
  'window:resize',
  'window:resized',
  'window:get-bounds',
  // File metadata channels
  'file:get-metadata',
  'file:get-metadata-batch',
] as const;

// Export the type for use in other files
export type ValidChannel = (typeof validChannels)[number];

// Type for the cleanup function returned by 'on' method
type CleanupFunction = () => void;

// Create API implementation factory to avoid code duplication
function createElectronAPI() {
  // Track active listeners for cleanup
  const activeListeners = new Map<
    string,
    Set<(event: IpcRendererEvent, ...args: unknown[]) => void>
  >();

  return {
    // Send message to main process
    send: (channel: ValidChannel, data: unknown): void => {
      if (!validChannels.includes(channel)) {
        logToMain('ERROR', `Invalid IPC channel: ${channel}`);
        return;
      }

      try {
        ipcRenderer.send(channel, data);
      } catch (error) {
        logToMain(
          'ERROR',
          `Failed to send on channel ${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    // Listen for messages from main process
    on: (channel: ValidChannel, func: (...args: unknown[]) => void): CleanupFunction => {
      if (!validChannels.includes(channel)) {
        logToMain('ERROR', `Invalid IPC channel: ${channel}`);
        return () => {}; // Return no-op cleanup function
      }

      // Wrap the function to remove the event parameter
      const wrappedFunc = (event: IpcRendererEvent, ...args: unknown[]) => {
        try {
          func(...args);
        } catch (error) {
          logToMain(
            'ERROR',
            `Error in listener for ${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      };

      // Track the listener
      if (!activeListeners.has(channel)) {
        activeListeners.set(channel, new Set());
      }
      const listeners = activeListeners.get(channel);
      if (listeners) {
        listeners.add(wrappedFunc);
      }

      // Add the listener
      ipcRenderer.on(channel, wrappedFunc);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, wrappedFunc);
        const listeners = activeListeners.get(channel);
        if (listeners) {
          listeners.delete(wrappedFunc);
          if (listeners.size === 0) {
            activeListeners.delete(channel);
          }
        }
      };
    },

    // Remove all listeners for a channel
    removeAllListeners: (channel: ValidChannel): void => {
      if (!validChannels.includes(channel)) {
        logToMain('ERROR', `Invalid IPC channel: ${channel}`);
        return;
      }

      try {
        ipcRenderer.removeAllListeners(channel);
        activeListeners.delete(channel);
      } catch (error) {
        logToMain(
          'ERROR',
          `Failed to remove listeners for ${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    // Invoke main process and wait for response
    invoke: async (channel: ValidChannel, ...args: unknown[]): Promise<unknown> => {
      if (!validChannels.includes(channel)) {
        logToMain('ERROR', `Invalid IPC channel: ${channel}`);
        throw new Error(`Invalid IPC channel: ${channel}`);
      }

      try {
        return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        logToMain(
          'ERROR',
          `Failed to invoke ${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error; // Re-throw to allow renderer to handle
      }
    },
  };
}

// Create a single instance of the API
const electronAPI = createElectronAPI();

// Expose API to renderer process
contextBridge.exposeInMainWorld('api', electronAPI);

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Send completion log via IPC if in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    logToMain(
      'INFO',
      '🎉 Preload script completed - window.api and window.electronAPI should be available'
    );
  }, 200);
}

// Type definitions for the exposed API
export interface IElectronAPI {
  send: (channel: ValidChannel, data: unknown) => void;
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => CleanupFunction;
  removeAllListeners: (channel: ValidChannel) => void;
  invoke: (channel: ValidChannel, ...args: unknown[]) => Promise<unknown>;
}

// Type declarations for window object are in src/renderer/window.d.ts
