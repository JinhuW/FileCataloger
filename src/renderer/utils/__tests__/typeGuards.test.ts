/**
 * @file typeGuards.test.ts
 * @description Unit tests for type guard functions
 */

import { describe, it, expect } from 'vitest';
import {
  isVector2D,
  isDockPosition,
  isShelfItem,
  isShelfConfig,
  isAppStatus,
  isFileInfo,
  isRenamePattern,
  isArrayOf,
  safeParse,
} from '../typeGuards';
import type { ShelfConfig, ShelfItem, AppStatus } from '@shared/types';

describe('typeGuards', () => {
  describe('isVector2D', () => {
    it('should return true for valid Vector2D objects', () => {
      expect(isVector2D({ x: 0, y: 0 })).toBe(true);
      expect(isVector2D({ x: 100, y: 200 })).toBe(true);
      expect(isVector2D({ x: -50, y: -100 })).toBe(true);
      expect(isVector2D({ x: 3.14, y: 2.71 })).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isVector2D(null)).toBe(false);
      expect(isVector2D(undefined)).toBe(false);
      expect(isVector2D({})).toBe(false);
      expect(isVector2D({ x: 0 })).toBe(false);
      expect(isVector2D({ y: 0 })).toBe(false);
      expect(isVector2D({ x: '0', y: 0 })).toBe(false);
      expect(isVector2D({ x: 0, y: '0' })).toBe(false);
      expect(isVector2D('not an object')).toBe(false);
      expect(isVector2D(123)).toBe(false);
      expect(isVector2D([0, 0])).toBe(false);
    });
  });

  describe('isDockPosition', () => {
    it('should return true for valid dock positions', () => {
      expect(isDockPosition('top')).toBe(true);
      expect(isDockPosition('bottom')).toBe(true);
      expect(isDockPosition('left')).toBe(true);
      expect(isDockPosition('right')).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isDockPosition('center')).toBe(false);
      expect(isDockPosition('TOP')).toBe(false);
      expect(isDockPosition('')).toBe(false);
      expect(isDockPosition(null)).toBe(false);
      expect(isDockPosition(undefined)).toBe(false);
      expect(isDockPosition(123)).toBe(false);
      expect(isDockPosition({})).toBe(false);
    });
  });

  describe('isShelfItem', () => {
    const validShelfItem: ShelfItem = {
      id: 'test-id',
      type: 'file',
      name: 'test.txt',
      createdAt: Date.now(),
    };

    it('should return true for valid ShelfItem objects', () => {
      expect(isShelfItem(validShelfItem)).toBe(true);

      // With optional fields
      expect(
        isShelfItem({
          ...validShelfItem,
          path: '/path/to/file',
          size: 1024,
          content: 'text content',
          thumbnail: 'data:image/png;base64,...',
        })
      ).toBe(true);

      // All valid types
      expect(isShelfItem({ ...validShelfItem, type: 'text' })).toBe(true);
      expect(isShelfItem({ ...validShelfItem, type: 'url' })).toBe(true);
      expect(isShelfItem({ ...validShelfItem, type: 'image' })).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isShelfItem(null)).toBe(false);
      expect(isShelfItem(undefined)).toBe(false);
      expect(isShelfItem({})).toBe(false);

      // Missing required fields
      expect(isShelfItem({ type: 'file', name: 'test', createdAt: Date.now() })).toBe(false);
      expect(isShelfItem({ id: 'test', name: 'test', createdAt: Date.now() })).toBe(false);
      expect(isShelfItem({ id: 'test', type: 'file', createdAt: Date.now() })).toBe(false);
      expect(isShelfItem({ id: 'test', type: 'file', name: 'test' })).toBe(false);

      // Invalid type
      expect(isShelfItem({ ...validShelfItem, type: 'invalid' })).toBe(false);

      // Wrong field types
      expect(isShelfItem({ ...validShelfItem, id: 123 })).toBe(false);
      expect(isShelfItem({ ...validShelfItem, name: null })).toBe(false);
      expect(isShelfItem({ ...validShelfItem, createdAt: '2024-01-01' })).toBe(false);
      expect(isShelfItem({ ...validShelfItem, path: 123 })).toBe(false);
      expect(isShelfItem({ ...validShelfItem, size: '1024' })).toBe(false);
    });
  });

  describe('isShelfConfig', () => {
    const validShelfConfig: ShelfConfig = {
      id: 'test-shelf',
      position: { x: 100, y: 200 },
      dockPosition: null,
      isPinned: false,
      items: [],
      isVisible: true,
      opacity: 0.8,
    };

    it('should return true for valid ShelfConfig objects', () => {
      expect(isShelfConfig(validShelfConfig)).toBe(true);

      // With dock position
      expect(
        isShelfConfig({
          ...validShelfConfig,
          dockPosition: 'top',
        })
      ).toBe(true);

      // With items
      expect(
        isShelfConfig({
          ...validShelfConfig,
          items: [
            {
              id: 'item-1',
              type: 'file',
              name: 'test.txt',
              createdAt: Date.now(),
            },
          ],
        })
      ).toBe(true);

      // With rename mode
      expect(
        isShelfConfig({
          ...validShelfConfig,
          mode: 'rename',
        })
      ).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isShelfConfig(null)).toBe(false);
      expect(isShelfConfig(undefined)).toBe(false);
      expect(isShelfConfig({})).toBe(false);

      // Missing required fields
      expect(isShelfConfig({ ...validShelfConfig, id: undefined })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, position: undefined })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, isPinned: undefined })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, items: undefined })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, isVisible: undefined })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, opacity: undefined })).toBe(false);

      // Invalid position
      expect(isShelfConfig({ ...validShelfConfig, position: { x: 100 } })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, position: null })).toBe(false);

      // Invalid dock position
      expect(isShelfConfig({ ...validShelfConfig, dockPosition: 'center' })).toBe(false);

      // Invalid opacity
      expect(isShelfConfig({ ...validShelfConfig, opacity: -0.5 })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, opacity: 1.5 })).toBe(false);
      expect(isShelfConfig({ ...validShelfConfig, opacity: '0.8' })).toBe(false);

      // Invalid mode
      expect(isShelfConfig({ ...validShelfConfig, mode: 'invalid' })).toBe(false);

      // Invalid items
      expect(isShelfConfig({ ...validShelfConfig, items: 'not an array' })).toBe(false);
      expect(
        isShelfConfig({
          ...validShelfConfig,
          items: [{ invalid: 'item' }],
        })
      ).toBe(false);
    });
  });

  describe('isAppStatus', () => {
    const validAppStatus: AppStatus = {
      isRunning: true,
      activeShelves: 2,
      modules: {
        mouseTracker: true,
        shakeDetector: true,
        dragDetector: true,
      },
      analytics: {
        mouseTracker: {
          eventsPerSecond: 100,
          cpuUsage: 5.5,
          memoryUsage: 128,
        },
        shakeDetector: {
          shakesDetected: 10,
          lastShakeTime: Date.now(),
        },
        dragDetector: {
          dragsDetected: 20,
          filesDropped: 15,
        },
      },
    };

    it('should return true for valid AppStatus objects', () => {
      expect(isAppStatus(validAppStatus)).toBe(true);

      // With zero values
      expect(
        isAppStatus({
          ...validAppStatus,
          activeShelves: 0,
          modules: {
            mouseTracker: false,
            shakeDetector: false,
            dragDetector: false,
          },
        })
      ).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isAppStatus(null)).toBe(false);
      expect(isAppStatus(undefined)).toBe(false);
      expect(isAppStatus({})).toBe(false);

      // Missing required fields
      expect(isAppStatus({ ...validAppStatus, isRunning: undefined })).toBe(false);
      expect(isAppStatus({ ...validAppStatus, activeShelves: undefined })).toBe(false);
      expect(isAppStatus({ ...validAppStatus, modules: undefined })).toBe(false);
      expect(isAppStatus({ ...validAppStatus, analytics: undefined })).toBe(false);

      // Invalid modules
      expect(
        isAppStatus({
          ...validAppStatus,
          modules: {},
        })
      ).toBe(false);
      expect(
        isAppStatus({
          ...validAppStatus,
          modules: {
            mouseTracker: 'yes',
            shakeDetector: true,
            dragDetector: true,
          },
        })
      ).toBe(false);

      // Invalid analytics
      expect(
        isAppStatus({
          ...validAppStatus,
          analytics: {},
        })
      ).toBe(false);
      expect(
        isAppStatus({
          ...validAppStatus,
          analytics: {
            ...validAppStatus.analytics,
            mouseTracker: null,
          },
        })
      ).toBe(false);
    });
  });

  describe('isFileInfo', () => {
    it('should return true for valid FileInfo objects', () => {
      expect(
        isFileInfo({
          path: '/path/to/file.txt',
          name: 'file.txt',
          newName: 'renamed.txt',
        })
      ).toBe(true);

      expect(
        isFileInfo({
          path: '/path/to/file.txt',
          name: 'file.txt',
          newName: 'renamed.txt',
          error: 'Permission denied',
        })
      ).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isFileInfo(null)).toBe(false);
      expect(isFileInfo({})).toBe(false);
      expect(
        isFileInfo({
          path: '/path/to/file.txt',
          name: 'file.txt',
        })
      ).toBe(false);
      expect(
        isFileInfo({
          path: '/path/to/file.txt',
          name: 'file.txt',
          newName: 123,
        })
      ).toBe(false);
    });
  });

  describe('isRenamePattern', () => {
    it('should return true for valid RenamePattern objects', () => {
      expect(
        isRenamePattern({
          id: 'pattern-1',
          type: 'text',
          value: 'prefix_',
        })
      ).toBe(true);

      expect(
        isRenamePattern({
          id: 'pattern-2',
          type: 'date',
          format: 'YYYY-MM-DD',
        })
      ).toBe(true);

      expect(
        isRenamePattern({
          id: 'pattern-3',
          type: 'counter',
          startValue: 1,
          padding: 3,
        })
      ).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isRenamePattern(null)).toBe(false);
      expect(isRenamePattern({})).toBe(false);
      expect(
        isRenamePattern({
          id: 'pattern-1',
          type: 'invalid',
        })
      ).toBe(false);
      expect(
        isRenamePattern({
          id: 'pattern-1',
          type: 'text',
          value: 123,
        })
      ).toBe(false);
    });
  });

  describe('isArrayOf', () => {
    it('should return true for arrays matching the guard', () => {
      expect(isArrayOf([], isShelfItem)).toBe(true);
      expect(
        isArrayOf(
          [
            { id: 'item-1', type: 'file', name: 'test.txt', createdAt: Date.now() },
            { id: 'item-2', type: 'text', name: 'text', createdAt: Date.now() },
          ],
          isShelfItem
        )
      ).toBe(true);
    });

    it('should return false when any item fails the guard', () => {
      expect(
        isArrayOf(
          [
            { id: 'item-1', type: 'file', name: 'test.txt', createdAt: Date.now() },
            { invalid: 'item' },
          ],
          isShelfItem
        )
      ).toBe(false);

      expect(isArrayOf('not an array', isShelfItem)).toBe(false);
      expect(isArrayOf(null, isShelfItem)).toBe(false);
    });
  });

  describe('safeParse', () => {
    const mockGuard = (data: unknown): data is string => typeof data === 'string';

    it('should return data when guard passes', () => {
      expect(safeParse('valid string', mockGuard, 'test context')).toBe('valid string');
    });

    it('should return null when guard fails', () => {
      expect(safeParse(123, mockGuard, 'test context')).toBe(null);
      expect(safeParse(null, mockGuard, 'test context')).toBe(null);
      expect(safeParse(undefined, mockGuard, 'test context')).toBe(null);
    });

    it('should log error in development mode', () => {
      // Mock process.env.NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeParse(123, mockGuard, 'test context');

      expect(consoleSpy).toHaveBeenCalledWith('Type guard failed for test context:', 123);

      consoleSpy.mockRestore();

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });
  });
});
