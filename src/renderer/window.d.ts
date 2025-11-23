/**
 * @file window.d.ts
 * @description TypeScript type definitions for the window.api interface.
 * This file defines the API exposed by the preload script to the renderer process,
 * providing type safety for IPC communication between renderer and main processes.
 *
 * @api-methods
 * - send: Send one-way messages to main process
 * - on: Listen for events from main process (returns cleanup function)
 * - removeAllListeners: Clean up all event listeners for a channel
 * - invoke: Send request and await response from main process
 *
 * @usage
 * ```typescript
 * // Send message
 * window.api.send('shelf:close', { shelfId });
 *
 * // Invoke with response
 * const status = await window.api.invoke('app:get-status');
 *
 * // Listen for events
 * const cleanup = window.api.on('shelf:config', (config) => {
 *   console.log(config);
 * });
 *
 * // Clean up listener later
 * cleanup();
 * ```
 */

// Import types from preload script
import type { ValidChannel, IElectronAPI } from '@preload/index';

declare global {
  interface Window {
    // Primary API exposed by preload script
    api: IElectronAPI;

    // Also exposed for compatibility
    electronAPI: IElectronAPI & {
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      off: (channel: string, callback: (...args: unknown[]) => void) => void;
      dialog: {
        showMessageBox: (options: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

// Re-export types for convenience
export type { ValidChannel, IElectronAPI };
export {};
