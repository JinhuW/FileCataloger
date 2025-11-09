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
 * Type guard for native file response from IPC
 */
interface NativeFile {
  path: string;
  name: string;
}

function isNativeFileArray(value: unknown): value is NativeFile[] {
  if (!Array.isArray(value)) return false;

  return value.every(
    item =>
      typeof item === 'object' &&
      item !== null &&
      'path' in item &&
      'name' in item &&
      typeof item.path === 'string' &&
      typeof item.name === 'string'
  );
}

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

/**
 * Result of processing dropped/selected files with duplicate detection
 */
export interface ProcessFilesResult {
  /**
   * Successfully processed items
   */
  items: ShelfItem[];
  /**
   * Number of duplicate files that were skipped
   */
  duplicateCount: number;
  /**
   * Whether the filesystem type check failed (using heuristic fallback)
   */
  pathTypeCheckFailed?: boolean;
}

/**
 * Options for processing file lists
 */
export interface ProcessFileListOptions {
  /**
   * Set of existing file paths to check for duplicates
   */
  existingPaths?: Set<string>;
  /**
   * Source of the files (for logging)
   */
  source?: 'drag' | 'input';
  /**
   * Pre-captured native file paths (bypasses IPC call to prevent race conditions)
   * Map of filename → full path from native drag monitor
   * If provided, this will be used instead of making an IPC call to drag:get-native-files
   */
  nativePathMap?: Map<string, string>;
}

/**
 * Retrieves file paths from the native drag monitor module.
 * The native module captures paths from NSPasteboard during drag operations.
 * Returns a map of filename → full path for matching with File objects.
 *
 * @returns Map of filename to full path, or empty map if native paths unavailable
 */
async function getNativeFilePaths(): Promise<Map<string, string>> {
  const pathMap = new Map<string, string>();

  try {
    const response = await window.api.invoke('drag:get-native-files');

    // Validate IPC response instead of using type assertion
    if (!isNativeFileArray(response)) {
      logger.warn('Invalid native files response from IPC:', response);
      return pathMap;
    }

    if (response.length > 0) {
      logger.info(`📋 Retrieved ${response.length} file paths from native drag monitor`);

      for (const nativeFile of response) {
        if (nativeFile.path && nativeFile.name) {
          // Extract filename from path as fallback if name is not provided
          const filename = nativeFile.name || nativeFile.path.split('/').pop() || '';
          if (filename) {
            pathMap.set(filename, nativeFile.path);
            logger.debug(`  ✓ ${filename} → ${nativeFile.path}`);
          }
        }
      }
    } else {
      logger.debug('📋 No native file paths available (empty or invalid response)');
    }
  } catch (error) {
    logger.warn('Failed to retrieve native file paths:', error);
    logger.debug('Will fall back to Electron File.path property');
  }

  return pathMap;
}

/**
 * Processes a FileList and converts it to ShelfItems with type detection.
 * Handles duplicate detection and file type classification via IPC.
 * This function is optimized for batch processing with a single IPC call.
 *
 * ENHANCED: Now retrieves file paths from native drag monitor for complete path information.
 *
 * @param files - The FileList to process
 * @param options - Processing options including duplicate detection
 * @returns ProcessFilesResult containing items and duplicate count
 */
export async function processFileList(
  files: FileList,
  options: ProcessFileListOptions = {}
): Promise<ProcessFilesResult> {
  const {
    existingPaths = new Set<string>(),
    source = 'drag',
    nativePathMap: providedPathMap,
  } = options;

  const items: ShelfItem[] = [];
  const duplicatePaths = new Set<string>();
  let duplicateCount = 0;

  logger.info(`📦 processFileList: Processing ${files.length} files from ${source}`);

  // Step 1: Get native file paths from drag monitor (for drag operations)
  // Use provided map to avoid race conditions, otherwise fetch via IPC
  const nativePathMap =
    providedPathMap ?? (source === 'drag' ? await getNativeFilePaths() : new Map<string, string>());

  if (providedPathMap) {
    logger.debug(`Using pre-captured native paths (${providedPathMap.size} files)`);
  }

  // Step 2: Collect paths for batch type checking
  const pathsToCheck: string[] = [];
  const fileMap: Map<string, { file: File; index: number }> = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Try to get path from multiple sources (priority order):
    // 1. Native drag monitor (most reliable for drag operations)
    // 2. Electron File.path property (fallback)
    const filePath = nativePathMap.get(file.name) || getElectronFilePath(file);

    if (filePath) {
      pathsToCheck.push(filePath);
      fileMap.set(filePath, { file, index: i });
    } else {
      logger.warn(`⚠️ No path available for file: ${file.name}`);
    }
  }

  logger.debug(`Resolved ${pathsToCheck.length} file paths out of ${files.length} files`);

  // Step 3: Batch check path types via IPC
  let pathTypes: Record<string, 'file' | 'folder' | 'unknown'> = {};
  let pathTypeCheckFailed = false;

  if (pathsToCheck.length > 0) {
    try {
      logger.debug(`Checking ${pathsToCheck.length} path types`);
      pathTypes = (await window.api.invoke('fs:check-path-type', pathsToCheck)) as Record<
        string,
        'file' | 'folder' | 'unknown'
      >;
      logger.debug('Path types received', pathTypes);
    } catch (error) {
      pathTypeCheckFailed = true;
      logger.error('Failed to check path types via IPC:', error);
      logger.warn(
        '⚠️ Falling back to heuristic file type detection. Folder detection may be inaccurate.'
      );
      // Continue processing with empty pathTypes - will use heuristic fallback
    }
  }

  // Step 4: Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Get path using same priority order as Step 2
    const filePath = nativePathMap.get(file.name) || getElectronFilePath(file);

    // Skip duplicates (both from existing paths and within current batch)
    if (filePath) {
      if (existingPaths.has(filePath) || duplicatePaths.has(filePath)) {
        logger.debug(`Skipping duplicate file: ${file.name} (${filePath})`);
        duplicateCount++;
        continue;
      }
      duplicatePaths.add(filePath);
    }

    // Determine file type with filesystem check
    const type = determineFileTypeWithPath(file, filePath, pathTypes);

    logger.debug(`Processed file ${i}:`, {
      name: file.name,
      path: filePath,
      pathSource: nativePathMap.has(file.name) ? 'native' : 'electron',
      type,
      size: file.size,
    });

    const item: ShelfItem = {
      id: generateItemId(type, i),
      type,
      name: file.name,
      path: filePath || undefined,
      size: file.size,
      createdAt: Date.now(),
    };
    items.push(item);
  }

  // Step 5: Fetch metadata for items with paths (batch request for efficiency)
  const itemsWithPaths = items.filter((item): item is ShelfItem & { path: string } => !!item.path);
  if (itemsWithPaths.length > 0) {
    try {
      const paths = itemsWithPaths.map(item => item.path);
      logger.debug(`Fetching metadata for ${paths.length} files`);

      const metadataResponse = (await window.api.invoke('file:get-metadata-batch', paths)) as {
        success: boolean;
        data?: Record<
          string,
          {
            extension?: string;
            birthtime?: number;
            mtime?: number;
            atime?: number;
          }
        >;
        error?: string;
      };

      if (metadataResponse.success && metadataResponse.data) {
        // Apply metadata to items
        for (const item of itemsWithPaths) {
          const metadata = metadataResponse.data[item.path];
          if (metadata && Object.keys(metadata).length > 0) {
            item.metadata = metadata;
            logger.debug(`Applied metadata to ${item.name}:`, metadata);
          }
        }
        logger.info(`✅ Successfully fetched metadata for ${itemsWithPaths.length} files`);
      } else {
        logger.warn('Failed to fetch file metadata:', metadataResponse.error);
      }
    } catch (error) {
      logger.error('Error fetching file metadata:', error);
      // Continue without metadata - not critical for basic functionality
    }
  }

  logger.info(
    `📦 processFileList: Processed ${items.length} items, skipped ${duplicateCount} duplicates`
  );

  return { items, duplicateCount, pathTypeCheckFailed };
}

/**
 * Gets the Electron file path from a File object.
 * Electron exposes the native path on the File object.
 *
 * @param file - The File object
 * @returns The file path or undefined
 */
export function getElectronFilePath(file: File): string | undefined {
  return (file as unknown as { path?: string }).path;
}

/**
 * Determines the ShelfItemType for a file based on filesystem checks and heuristics.
 * This function uses IPC results to accurately determine if a path is a folder.
 *
 * @param file - The File object
 * @param filePath - The file path (if available)
 * @param pathTypes - Map of paths to their filesystem types
 * @returns The determined ShelfItemType
 */
export function determineFileTypeWithPath(
  file: File,
  filePath: string | undefined,
  pathTypes: Record<string, 'file' | 'folder' | 'unknown'>
): ShelfItemType {
  // Primary: Use filesystem type if available
  if (filePath && pathTypes[filePath]) {
    if (pathTypes[filePath] === 'folder') {
      return ShelfItemType.FOLDER;
    }
    // For files, check if it's an image
    if (file.type.startsWith('image/')) {
      return ShelfItemType.IMAGE;
    }
    return ShelfItemType.FILE;
  }

  // Fallback: Heuristic detection
  const hasExtension = file.name.includes('.') && !file.name.endsWith('.app');
  const isFolder = (!hasExtension && file.size === 0) || (!file.type && !hasExtension);

  if (isFolder) {
    return ShelfItemType.FOLDER;
  }
  if (file.type.startsWith('image/')) {
    return ShelfItemType.IMAGE;
  }
  return ShelfItemType.FILE;
}

/**
 * Checks if an array of files contains duplicates based on their paths.
 *
 * @param items - Array of ShelfItems to check
 * @returns Set of duplicate paths found
 */
export function findDuplicatePaths(items: ShelfItem[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (item.path) {
      if (seen.has(item.path)) {
        duplicates.add(item.path);
      } else {
        seen.add(item.path);
      }
    }
  }

  return duplicates;
}
