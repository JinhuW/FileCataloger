import { contextBridge, ipcRenderer } from 'electron';

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
  } catch {
    // If IPC fails, we can't do anything about it in preload
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
] as const;

type ValidChannel = (typeof validChannels)[number];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Send message to main process
  send: (channel: ValidChannel, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
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
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: ValidChannel) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
    }
  },

  // Invoke main process and wait for response
  invoke: async (channel: ValidChannel, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
      return null;
    }
  },
});

// Also expose as electronAPI for compatibility with shelf.html
contextBridge.exposeInMainWorld('electronAPI', {
  // Send message to main process
  send: (channel: ValidChannel, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
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
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: ValidChannel) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
    }
  },

  // Invoke main process and wait for response
  invoke: async (channel: ValidChannel, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      logToMain('ERROR', `Invalid IPC channel: ${channel}`);
      return null;
    }
  },
});

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
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: ValidChannel) => void;
  invoke: (channel: ValidChannel, ...args: unknown[]) => Promise<unknown>;
}

// Type declarations moved to src/renderer/window.d.ts
