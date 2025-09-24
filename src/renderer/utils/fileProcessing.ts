/**
 * @file fileProcessing.ts
 * @description Utility functions for processing files in drag-and-drop operations.
 * Provides centralized logic for creating ShelfItems from various data sources,
 * eliminating code duplication across components.
 *
 * @features
 * - Create ShelfItems from File objects
 * - Determine file types based on MIME types and extensions
 * - Process DataTransfer objects from drag events
 * - Generate unique IDs using crypto.randomUUID()
 * - Handle text and URL drops
 *
 * @usage
 * ```typescript
 * const items = await processDroppedFiles(event.dataTransfer);
 * items.forEach(item => shelf.addItem(item));
 * ```
 */

import { ShelfItem, ShelfItemType } from '@shared/types';
import { SHELF_CONSTANTS, isImageTypeSupported, isTextFileExtension } from '../constants/shelf';
import { logger } from '@shared/logger';

/**
 * Generate a unique ID for a shelf item
 */
const generateItemId = (type: string | ShelfItemType, index: number): string => {
  // Use crypto.randomUUID for better uniqueness and security
  const typeStr = typeof type === 'string' ? type : type.toLowerCase();
  return `${typeStr}-${Date.now()}-${index}-${crypto.randomUUID()}`;
};

/**
 * Determine the type of a file based on MIME type and extension
 */
export function determineFileType(file: File): ShelfItem['type'] {
  // Check for image types first (most specific)
  if (isImageTypeSupported(file.type)) {
    return ShelfItemType.IMAGE;
  }

  // Check for text MIME types
  if (file.type.startsWith('text/')) {
    return ShelfItemType.TEXT;
  }

  // Check for specific text file extensions
  if (isTextFileExtension(file.name)) {
    return ShelfItemType.TEXT;
  }

  // Default to generic file type
  return ShelfItemType.FILE;
}

/**
 * Create a ShelfItem from a File object
 */
export function createShelfItem(
  file: File,
  index: number,
  baseType: ShelfItemType = ShelfItemType.FILE
): ShelfItem {
  const type = baseType === ShelfItemType.FILE ? determineFileType(file) : baseType;
  const id = generateItemId(type, index);

  // Extract file path if available (Electron-specific)
  interface ElectronFile extends File {
    path?: string;
    filepath?: string;
  }
  const electronFile = file as ElectronFile;
  const path = electronFile.path || electronFile.filepath;

  const item: ShelfItem = {
    id,
    type,
    name: file.name,
    size: file.size,
    createdAt: Date.now(),
  };

  // Add optional properties
  if (path) {
    item.path = path;
  }

  // Create thumbnail for images
  if (type === ShelfItemType.IMAGE && file.size < SHELF_CONSTANTS.MAX_FILE_SIZE) {
    try {
      item.thumbnail = URL.createObjectURL(file);
    } catch (error) {
      logger.warn('Failed to create thumbnail:', error);
    }
  }

  return item;
}

/**
 * Create a ShelfItem from text content
 */
export function createTextItem(text: string, index: number = 0): ShelfItem {
  const isUrl = /^https?:\/\//i.test(text);
  const truncatedText = text.length > 100 ? text.substring(0, 97) + '...' : text;
  const type = isUrl ? ShelfItemType.URL : ShelfItemType.TEXT;

  return {
    id: generateItemId(type, index),
    type,
    name: isUrl ? new URL(text).hostname : truncatedText,
    content: text.substring(0, SHELF_CONSTANTS.MAX_TEXT_LENGTH),
    createdAt: Date.now(),
  };
}

/**
 * Process files from a DataTransfer object
 */
export async function processDroppedFiles(dataTransfer: DataTransfer): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];

  // Process files first
  const files = Array.from(dataTransfer.files);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Skip files that are too large
    if (file.size > SHELF_CONSTANTS.MAX_FILE_SIZE) {
      logger.warn(`File ${file.name} exceeds maximum size limit`);
      continue;
    }

    items.push(createShelfItem(file, i));
  }

  // If no files, check for text/URL drops
  if (files.length === 0) {
    const text = dataTransfer.getData('text/plain');
    const html = dataTransfer.getData('text/html');

    if (text) {
      items.push(createTextItem(text));
    } else if (html) {
      // Extract text from HTML if no plain text available
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const extractedText = doc.body.textContent || '';
      if (extractedText.trim()) {
        items.push(createTextItem(extractedText.trim()));
      }
    }
  }

  return items;
}

/**
 * Process items from various drag sources
 */
export async function processDragItems(dataTransfer: DataTransfer): Promise<{
  items: ShelfItem[];
  types: string[];
}> {
  const items = await processDroppedFiles(dataTransfer);
  const types = Array.from(dataTransfer.types);

  return { items, types };
}

/**
 * Clean up object URLs created for thumbnails
 */
export function cleanupItemThumbnails(items: ShelfItem[]): void {
  items.forEach(item => {
    if (item.thumbnail && item.thumbnail.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(item.thumbnail);
      } catch (error) {
        logger.warn('Failed to revoke thumbnail URL:', error);
      }
    }
  });
}

/**
 * Validate if a drop event contains supported content
 */
export function hasValidDropData(dataTransfer: DataTransfer): boolean {
  // Check for files
  if (dataTransfer.files.length > 0) {
    return true;
  }

  // Check for text or URL data
  const types = Array.from(dataTransfer.types);
  return types.includes('text/plain') || types.includes('text/html');
}

/**
 * Get a human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
}
