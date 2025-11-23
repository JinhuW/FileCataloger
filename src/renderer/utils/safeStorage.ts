/**
 * @file safeStorage.ts
 * @description Safe wrapper around localStorage with error handling and type safety.
 * Prevents crashes from localStorage quota exceeded or disabled storage.
 */

import { logger } from '@shared/logger';

/**
 * Safely get an item from localStorage
 * Returns null if the item doesn't exist or if an error occurs
 */
export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    logger.error('Failed to get localStorage item:', { key, error });
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * Returns true if successful, false otherwise
 */
export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    logger.error('Failed to set localStorage item:', { key, error });
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * Returns true if successful, false otherwise
 */
export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    logger.error('Failed to remove localStorage item:', { key, error });
    return false;
  }
}

/**
 * Safely clear all items from localStorage
 * Returns true if successful, false otherwise
 */
export function clearStorage(): boolean {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    logger.error('Failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Get a JSON-parsed item from localStorage with type safety
 * Returns the default value if parsing fails or item doesn't exist
 */
export function getStorageJSON<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    return JSON.parse(item) as T;
  } catch (error) {
    logger.error('Failed to parse localStorage JSON:', { key, error });
    return defaultValue;
  }
}

/**
 * Set a JSON-stringified item in localStorage
 * Returns true if successful, false otherwise
 */
export function setStorageJSON<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    logger.error('Failed to stringify and set localStorage item:', { key, error });
    return false;
  }
}

/**
 * Get a boolean value from localStorage
 * Returns the default value if the item doesn't exist or parsing fails
 */
export function getStorageBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    return item === 'true';
  } catch (error) {
    logger.error('Failed to get localStorage boolean:', { key, error });
    return defaultValue;
  }
}

/**
 * Set a boolean value in localStorage
 * Returns true if successful, false otherwise
 */
export function setStorageBoolean(key: string, value: boolean): boolean {
  return setStorageItem(key, value ? 'true' : 'false');
}

/**
 * Check if localStorage is available and working
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    logger.warn('localStorage is not available:', error);
    return false;
  }
}

/**
 * Get storage quota information (if available)
 */
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
} | null> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentUsed };
  } catch (error) {
    logger.error('Failed to get storage quota:', error);
    return null;
  }
}
