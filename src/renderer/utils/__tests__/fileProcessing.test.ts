/**
 * @file fileProcessing.test.ts
 * @description Unit tests for file processing utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  determineFileType,
  createShelfItem,
  createTextItem,
  processDroppedFiles,
  processDragItems,
  cleanupItemThumbnails,
  hasValidDropData,
  formatFileSize,
  getFileExtension,
} from '../fileProcessing';
import { SHELF_CONSTANTS } from '../../constants/shelf';

describe('fileProcessing', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('determineFileType', () => {
    it('should identify image files by MIME type', () => {
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(determineFileType(imageFile)).toBe('image');

      const pngFile = new File([''], 'test.png', { type: 'image/png' });
      expect(determineFileType(pngFile)).toBe('image');

      const webpFile = new File([''], 'test.webp', { type: 'image/webp' });
      expect(determineFileType(webpFile)).toBe('image');
    });

    it('should identify text files by MIME type', () => {
      const textFile = new File([''], 'test.txt', { type: 'text/plain' });
      expect(determineFileType(textFile)).toBe('text');

      const htmlFile = new File([''], 'test.html', { type: 'text/html' });
      expect(determineFileType(htmlFile)).toBe('text');
    });

    it('should identify text files by extension when MIME type is not text', () => {
      const jsFile = new File([''], 'test.js', { type: 'application/javascript' });
      expect(determineFileType(jsFile)).toBe('text');

      const mdFile = new File([''], 'README.md', { type: 'application/octet-stream' });
      expect(determineFileType(mdFile)).toBe('text');

      const jsonFile = new File([''], 'config.json', { type: 'application/json' });
      expect(determineFileType(jsonFile)).toBe('text');
    });

    it('should default to file for unrecognized types', () => {
      const zipFile = new File([''], 'archive.zip', { type: 'application/zip' });
      expect(determineFileType(zipFile)).toBe('file');

      const exeFile = new File([''], 'app.exe', { type: 'application/octet-stream' });
      expect(determineFileType(exeFile)).toBe('file');
    });
  });

  describe('createShelfItem', () => {
    it('should create a valid shelf item from a file', () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const item = createShelfItem(file, 0);

      expect(item.id).toMatch(/^text-\d+-0-test-[a-z0-9]+-uuid-uuid-uuid-uuid$/);
      expect(item.type).toBe('text');
      expect(item.name).toBe('test.txt');
      expect(item.size).toBe(12); // 'test content' is 12 bytes
      expect(item.createdAt).toBeLessThanOrEqual(Date.now());
      expect(item.createdAt).toBeGreaterThan(Date.now() - 1000);
    });

    it('should include path if available on file object', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      (file as any).path = '/path/to/test.txt';

      const item = createShelfItem(file, 0);
      expect(item.path).toBe('/path/to/test.txt');
    });

    it('should create thumbnail for small image files', () => {
      const imageFile = new File(['small image'], 'test.jpg', { type: 'image/jpeg' });
      const item = createShelfItem(imageFile, 0);

      expect(item.thumbnail).toBe('blob:mock-url');
      expect(URL.createObjectURL).toHaveBeenCalledWith(imageFile);
    });

    it('should not create thumbnail for large image files', () => {
      // Create a mock large file
      const largeContent = new Array(SHELF_CONSTANTS.MAX_FILE_SIZE + 1).join('a');
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });

      const item = createShelfItem(largeFile, 0);
      expect(item.thumbnail).toBeUndefined();
    });

    it('should handle createObjectURL errors gracefully', () => {
      URL.createObjectURL = vi.fn().mockImplementation(() => {
        throw new Error('Failed to create object URL');
      });

      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const item = createShelfItem(imageFile, 0);

      expect(item.thumbnail).toBeUndefined();
    });

    it('should respect custom base type', () => {
      const file = new File([''], 'data.bin', { type: 'application/octet-stream' });
      const item = createShelfItem(file, 0, 'url');

      expect(item.type).toBe('url');
      expect(item.id).toMatch(/^url-/);
    });
  });

  describe('createTextItem', () => {
    it('should create text item for plain text', () => {
      const text = 'Hello, world!';
      const item = createTextItem(text);

      expect(item.id).toMatch(/^text-\d+-0-test-[a-z0-9]+-uuid-uuid-uuid-uuid$/);
      expect(item.type).toBe('text');
      expect(item.name).toBe('Hello, world!');
      expect(item.content).toBe('Hello, world!');
    });

    it('should create URL item for URLs', () => {
      const url = 'https://example.com/page';
      const item = createTextItem(url);

      expect(item.id).toMatch(/^url-\d+-0-test-[a-z0-9]+-uuid-uuid-uuid-uuid$/);
      expect(item.type).toBe('url');
      expect(item.name).toBe('example.com');
      expect(item.content).toBe(url);
    });

    it('should truncate long text in name', () => {
      const longText = 'a'.repeat(150);
      const item = createTextItem(longText);

      expect(item.name).toBe('a'.repeat(97) + '...');
      expect(item.content).toBe('a'.repeat(150)); // Content not truncated yet
    });

    it('should limit content to max text length', () => {
      const veryLongText = 'a'.repeat(SHELF_CONSTANTS.MAX_TEXT_LENGTH + 100);
      const item = createTextItem(veryLongText);

      expect(item.content).toHaveLength(SHELF_CONSTANTS.MAX_TEXT_LENGTH);
    });

    it('should handle URLs with different protocols', () => {
      const httpUrl = 'http://example.com';
      const httpItem = createTextItem(httpUrl);
      expect(httpItem.type).toBe('url');

      const httpsUrl = 'https://example.com';
      const httpsItem = createTextItem(httpsUrl);
      expect(httpsItem.type).toBe('url');

      const ftpUrl = 'ftp://example.com';
      const ftpItem = createTextItem(ftpUrl);
      expect(ftpItem.type).toBe('text'); // Only http/https are recognized as URLs
    });
  });

  describe('processDroppedFiles', () => {
    it('should process multiple files from DataTransfer', async () => {
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.jpg', { type: 'image/jpeg' });

      const dataTransfer = {
        files: [file1, file2],
        getData: vi.fn().mockReturnValue(''),
        types: [],
      } as unknown as DataTransfer;

      const items = await processDroppedFiles(dataTransfer);

      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('file1.txt');
      expect(items[0].type).toBe('text');
      expect(items[1].name).toBe('file2.jpg');
      expect(items[1].type).toBe('image');
    });

    it('should skip files that exceed max size', async () => {
      const smallFile = new File(['small'], 'small.txt', { type: 'text/plain' });
      // Create content that is actually larger than MAX_FILE_SIZE
      // Array.join creates string of length n-1, so we need +2
      const largeContent = new Array(SHELF_CONSTANTS.MAX_FILE_SIZE + 2).join('a');
      const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dataTransfer = {
        files: [smallFile, largeFile],
        getData: vi.fn().mockReturnValue(''),
        types: [],
      } as unknown as DataTransfer;

      const items = await processDroppedFiles(dataTransfer);

      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('small.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith('File large.txt exceeds maximum size limit');

      consoleWarnSpy.mockRestore();
    });

    it('should process text drops when no files present', async () => {
      const dataTransfer = {
        files: [],
        getData: vi.fn().mockImplementation(type => {
          if (type === 'text/plain') return 'Dropped text';
          return '';
        }),
        types: ['text/plain'],
      } as unknown as DataTransfer;

      const items = await processDroppedFiles(dataTransfer);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('text');
      expect(items[0].content).toBe('Dropped text');
    });

    it('should process HTML drops and extract text', async () => {
      const dataTransfer = {
        files: [],
        getData: vi.fn().mockImplementation(type => {
          if (type === 'text/html') return '<p>Hello <strong>world</strong>!</p>';
          return '';
        }),
        types: ['text/html'],
      } as unknown as DataTransfer;

      const items = await processDroppedFiles(dataTransfer);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('text');
      expect(items[0].content).toBe('Hello world!');
    });

    it('should handle empty drops', async () => {
      const dataTransfer = {
        files: [],
        getData: vi.fn().mockReturnValue(''),
        types: [],
      } as unknown as DataTransfer;

      const items = await processDroppedFiles(dataTransfer);

      expect(items).toHaveLength(0);
    });
  });

  describe('processDragItems', () => {
    it('should return items and types from DataTransfer', async () => {
      const file = new File(['content'], 'file.txt', { type: 'text/plain' });
      const dataTransfer = {
        files: [file],
        getData: vi.fn().mockReturnValue(''),
        types: ['Files', 'text/plain'],
      } as unknown as DataTransfer;

      const result = await processDragItems(dataTransfer);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('file.txt');
      expect(result.types).toEqual(['Files', 'text/plain']);
    });
  });

  describe('cleanupItemThumbnails', () => {
    it('should revoke blob URLs for thumbnails', () => {
      const items = [
        {
          id: '1',
          type: 'image' as const,
          name: 'img1.jpg',
          thumbnail: 'blob:http://example.com/123',
          createdAt: Date.now(),
        },
        {
          id: '2',
          type: 'image' as const,
          name: 'img2.jpg',
          thumbnail: 'data:image/png;base64,...',
          createdAt: Date.now(),
        },
        { id: '3', type: 'file' as const, name: 'file.txt', createdAt: Date.now() },
        {
          id: '4',
          type: 'image' as const,
          name: 'img3.jpg',
          thumbnail: 'blob:http://example.com/456',
          createdAt: Date.now(),
        },
      ];

      cleanupItemThumbnails(items);

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://example.com/123');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://example.com/456');
    });

    it('should handle revokeObjectURL errors gracefully', () => {
      URL.revokeObjectURL = vi.fn().mockImplementation(() => {
        throw new Error('Failed to revoke URL');
      });

      const items = [
        {
          id: '1',
          type: 'image' as const,
          name: 'img.jpg',
          thumbnail: 'blob:http://example.com/123',
          createdAt: Date.now(),
        },
      ];

      // Should not throw
      expect(() => cleanupItemThumbnails(items)).not.toThrow();
    });
  });

  describe('hasValidDropData', () => {
    it('should return true when files are present', () => {
      const dataTransfer = {
        files: [new File([''], 'test.txt')],
        types: [],
      } as unknown as DataTransfer;

      expect(hasValidDropData(dataTransfer)).toBe(true);
    });

    it('should return true when text/plain is in types', () => {
      const dataTransfer = {
        files: [],
        types: ['text/plain'],
      } as unknown as DataTransfer;

      expect(hasValidDropData(dataTransfer)).toBe(true);
    });

    it('should return true when text/html is in types', () => {
      const dataTransfer = {
        files: [],
        types: ['text/html'],
      } as unknown as DataTransfer;

      expect(hasValidDropData(dataTransfer)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      const dataTransfer = {
        files: [],
        types: ['application/json', 'custom/type'],
      } as unknown as DataTransfer;

      expect(hasValidDropData(dataTransfer)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1)).toBe('1 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
    });

    it('should handle decimal places', () => {
      expect(formatFileSize(1234)).toBe('1.21 KB');
      expect(formatFileSize(1234567)).toBe('1.18 MB');
      expect(formatFileSize(1234567890)).toBe('1.15 GB');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extensions correctly', () => {
      expect(getFileExtension('file.txt')).toBe('txt');
      expect(getFileExtension('document.PDF')).toBe('pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
      expect(getFileExtension('image.jpeg')).toBe('jpeg');
    });

    it('should handle files without extensions', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
      expect(getFileExtension('.gitignore')).toBe('');
    });

    it('should handle edge cases', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension('.')).toBe('');
      expect(getFileExtension('file.')).toBe('');
      expect(getFileExtension('file..txt')).toBe('txt');
    });
  });
});
