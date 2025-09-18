import { contextBridge, ipcRenderer } from 'electron';

// Debug log to verify preload is running
console.log('🔌 Preload script starting...');

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
  'logger:set-level'
] as const;

type ValidChannel = typeof validChannels[number];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Send message to main process
  send: (channel: ValidChannel, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Listen for messages from main process
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      // Remove all listeners for this channel first
      ipcRenderer.removeAllListeners(channel);
      // Add the new listener
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: ValidChannel) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Invoke main process and wait for response
  invoke: async (channel: ValidChannel, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
      return null;
    }
  }
});

// Also expose as electronAPI for compatibility with shelf.html
contextBridge.exposeInMainWorld('electronAPI', {
  // Send message to main process
  send: (channel: ValidChannel, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Listen for messages from main process
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      // Remove all listeners for this channel first
      ipcRenderer.removeAllListeners(channel);
      // Add the new listener
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: ValidChannel) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
    }
  },

  // Invoke main process and wait for response
  invoke: async (channel: ValidChannel, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      console.error(`Invalid IPC channel: ${channel}`);
      return null;
    }
  }
});

console.log('🎉 Preload script completed - window.api and window.electronAPI should be available');

// Type definitions for the exposed API
export interface IElectronAPI {
  send: (channel: ValidChannel, data: unknown) => void;
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: ValidChannel) => void;
  invoke: (channel: ValidChannel, ...args: unknown[]) => Promise<unknown>;
}

declare global {
  interface Window {
    api: IElectronAPI;
    electronAPI: IElectronAPI;
  }
}
