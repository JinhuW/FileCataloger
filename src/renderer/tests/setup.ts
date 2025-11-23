/**
 * Vitest Test Setup
 *
 * Global setup for all test files. This file is run before tests execute.
 */

import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup();
});

// Global test utilities
globalThis.expect = expect;

// Mock Electron APIs if needed in tests
globalThis.window = globalThis.window || ({} as any);

if (typeof window !== 'undefined') {
  // Mock window.api for Electron IPC
  (window as any).api = {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
