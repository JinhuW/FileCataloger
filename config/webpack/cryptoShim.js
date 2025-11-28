/**
 * Crypto shim for renderer process
 * Provides the browser's Web Crypto API when code tries to import 'crypto' or 'node:crypto'
 */

// Export the browser's global crypto object
export default (typeof window !== 'undefined' && window.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto) || {};

// Also export as named export for compatibility
export const crypto = (typeof window !== 'undefined' && window.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto) || {};
