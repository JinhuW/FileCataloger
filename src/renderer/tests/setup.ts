/**
 * @file setup.ts
 * @description Test setup and configuration for Vitest
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.api for all tests
beforeAll(() => {
  // Mock window event listeners
  const listeners = new Map();

  // Mock the Electron API
  global.window = {
    ...global.window,
    addEventListener: vi.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (listeners.has(event)) {
        const handlers = listeners.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }),
    api: {
      send: vi.fn(),
      on: vi.fn(() => vi.fn()), // Return cleanup function
      removeAllListeners: vi.fn(),
      invoke: vi.fn(),
      getShelfId: vi.fn().mockResolvedValue('test-shelf-id'),
      showItemInFolder: vi.fn(),
      openPath: vi.fn(),
      getFilePath: vi.fn(path => Promise.resolve(path)),
    },
    electronAPI: {
      send: vi.fn(),
      on: vi.fn(() => vi.fn()),
      removeAllListeners: vi.fn(),
      invoke: vi.fn(),
    },
  } as any;

  // Mock crypto.randomUUID
  Object.defineProperty(global, 'crypto', {
    value: {
      ...global.crypto,
      randomUUID: vi.fn(
        () => `test-${Math.random().toString(36).slice(2)}-uuid-uuid-uuid-uuid`
      ) as () => `${string}-${string}-${string}-${string}-${string}`,
    },
    writable: true,
  });

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock console methods to reduce noise in tests
  global.console = {
    ...global.console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
