/**
 * @file FileDropZone.tsx
 * @description Versatile file drop zone component that handles both drag-and-drop operations and
 * click-to-browse functionality. Supports compact and normal display modes.
 *
 * @props {boolean} isDragOver - Whether files are currently being dragged over the zone
 * @props {function} onDrop - Callback when files are dropped (receives ShelfItem[])
 * @props {function} onDragOver - Callback for drag state changes
 * @props {boolean} compact - Whether to render in compact mode (default: false)
 *
 * @features
 * - Drag-and-drop file upload with visual feedback
 * - Click-to-browse file selection via hidden input
 * - Automatic file type detection (image vs generic file)
 * - Animated visual states during drag operations
 * - Responsive design with compact and normal modes
 * - Multiple file selection support
 * - Cross-platform file path handling for Electron
 *
 * @usage
 * ```tsx
 * <FileDropZone
 *   isDragOver={dragState}
 *   onDrop={handleFileDrop}
 *   onDragOver={setDragState}
 *   compact={true}
 * />
 * ```
 */

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ShelfItem, ShelfItemType } from '@shared/types';
import { logger } from '@shared/logger';
import { useToast } from '@renderer/stores/toastStore';

export interface FileDropZoneProps {
  isDragOver: boolean;
  onDrop: (items: ShelfItem[]) => void;
  onDragOver: (over: boolean) => void;
  compact?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  isDragOver,
  onDrop,
  onDragOver,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onDragOver(false);

      logger.info(`📦 FileDropZone.handleDrop: Drop event received`);

      const items: ShelfItem[] = [];
      const duplicatePaths = new Set<string>();
      const dataTransfer = e.dataTransfer;
      let duplicateCount = 0;

      logger.info(
        `📦 FileDropZone: dataTransfer.files.length = ${dataTransfer.files?.length || 0}`
      );

      // Process ONLY files from dataTransfer (the actual dropped files from the drop event)
      // Do NOT use cached native files as they may be stale from previous drag operations
      if (dataTransfer.files && dataTransfer.files.length > 0) {
        // Collect paths for type checking
        const pathsToCheck: string[] = [];

        for (let i = 0; i < dataTransfer.files.length; i++) {
          const file = dataTransfer.files[i];
          // Get file path from Electron's exposed path property
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            pathsToCheck.push(filePath);
          }
        }

        // Check path types if we have paths
        let pathTypes: Record<string, 'file' | 'folder' | 'unknown'> = {};
        if (pathsToCheck.length > 0) {
          try {
            logger.debug('Checking path types for dataTransfer files', { paths: pathsToCheck });
            pathTypes = (await window.api.invoke('fs:check-path-type', pathsToCheck)) as Record<
              string,
              'file' | 'folder' | 'unknown'
            >;
            logger.debug('Path types result for dataTransfer files', pathTypes);
          } catch (error) {
            logger.error('Failed to check path types for dataTransfer files:', error);
          }
        }

        // Process each dropped file
        for (let i = 0; i < dataTransfer.files.length; i++) {
          const file = dataTransfer.files[i];
          const filePath = (file as unknown as { path?: string }).path;

          // Skip if we've already processed this path (prevents duplicates)
          if (filePath && duplicatePaths.has(filePath)) {
            logger.debug('Skipping duplicate file path:', filePath);
            duplicateCount++;
            continue;
          }
          if (filePath) {
            duplicatePaths.add(filePath);
          }

          // Determine type based on file system check or fallback to heuristics
          let type: ShelfItem['type'] = ShelfItemType.FILE;
          logger.debug('Processing dataTransfer file', {
            name: file.name,
            path: filePath,
            pathType: pathTypes[filePath] || 'not found',
            size: file.size,
          });

          if (filePath && pathTypes[filePath]) {
            type =
              pathTypes[filePath] === 'folder'
                ? ShelfItemType.FOLDER
                : file.type.startsWith('image/')
                  ? ShelfItemType.IMAGE
                  : ShelfItemType.FILE;
          } else {
            // Fallback to heuristic detection
            const hasExtension = file.name.includes('.') && !file.name.endsWith('.app');
            const isFolder = (!hasExtension && file.size === 0) || (!file.type && !hasExtension);
            logger.debug('Fallback detection', {
              fileName: file.name,
              hasExtension,
              size: file.size,
              isFolder,
            });
            type = isFolder
              ? ShelfItemType.FOLDER
              : file.type.startsWith('image/')
                ? ShelfItemType.IMAGE
                : ShelfItemType.FILE;
          }

          const item: ShelfItem = {
            id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`,
            type,
            name: file.name,
            path: filePath || undefined,
            size: file.size,
            createdAt: Date.now(),
          };
          items.push(item);
        }
      }

      if (items.length > 0) {
        logger.info(
          `📦 FileDropZone: Calling onDrop with ${items.length} items (from drag):`,
          items.map(i => i.name)
        );
        onDrop(items);
      } else {
        logger.warn('📦 FileDropZone: No items to drop from drag!');
      }

      // Show toast notification for duplicates
      if (duplicateCount > 0) {
        toast.warning(
          'Duplicate Files Skipped',
          `${duplicateCount} file${duplicateCount === 1 ? '' : 's'} already exist${duplicateCount === 1 ? 's' : ''} on this shelf and ${duplicateCount === 1 ? 'was' : 'were'} skipped.`,
          4000
        );
      }
    },
    [onDrop, onDragOver, toast]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      onDragOver(true);
    },
    [onDragOver]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        onDragOver(false);
      }
    },
    [onDragOver]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const items: ShelfItem[] = [];
      const duplicatePaths = new Set<string>();
      let duplicateCount = 0;

      // Collect paths for type checking
      const pathsToCheck: string[] = [];
      const fileMap: Map<string, { file: File; index: number }> = new Map();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = (file as unknown as { path?: string }).path;
        if (filePath) {
          pathsToCheck.push(filePath);
          fileMap.set(filePath, { file, index: i });
        }
      }

      // Check path types if we have paths
      let pathTypes: Record<string, 'file' | 'folder' | 'unknown'> = {};
      if (pathsToCheck.length > 0) {
        try {
          pathTypes = (await window.api.invoke('fs:check-path-type', pathsToCheck)) as Record<
            string,
            'file' | 'folder' | 'unknown'
          >;
        } catch (error) {
          logger.error('Failed to check path types:', error);
        }
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = (file as unknown as { path?: string }).path;

        // Skip if we've already processed this path (prevents duplicates)
        if (filePath && duplicatePaths.has(filePath)) {
          logger.debug('Skipping duplicate file path in file selection:', filePath);
          duplicateCount++;
          continue;
        }
        if (filePath) {
          duplicatePaths.add(filePath);
        }

        // Determine type based on file system check or fallback to heuristics
        let type: ShelfItem['type'] = ShelfItemType.FILE;
        if (filePath && pathTypes[filePath]) {
          type =
            pathTypes[filePath] === 'folder'
              ? ShelfItemType.FOLDER
              : file.type.startsWith('image/')
                ? ShelfItemType.IMAGE
                : ShelfItemType.FILE;
        } else {
          // Fallback to heuristic detection
          const hasExtension = file.name.includes('.') && !file.name.endsWith('.app');
          const isFolder = (!hasExtension && file.size === 0) || (!file.type && !hasExtension);
          type = isFolder
            ? ShelfItemType.FOLDER
            : file.type.startsWith('image/')
              ? ShelfItemType.IMAGE
              : ShelfItemType.FILE;
        }

        const item: ShelfItem = {
          id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`,
          type,
          name: file.name,
          path: filePath || undefined,
          size: file.size,
          createdAt: Date.now(),
        };
        items.push(item);
      }

      if (items.length > 0) {
        logger.info(
          `📦 FileDropZone: Calling onDrop with ${items.length} items (from drag):`,
          items.map(i => i.name)
        );
        onDrop(items);
      } else {
        logger.warn('📦 FileDropZone: No items to drop from drag!');
      }

      // Show toast notification for duplicates
      if (duplicateCount > 0) {
        toast.warning(
          'Duplicate Files Skipped',
          `${duplicateCount} file${duplicateCount === 1 ? '' : 's'} already exist${duplicateCount === 1 ? 's' : ''} in your selection and ${duplicateCount === 1 ? 'was' : 'were'} skipped.`,
          4000
        );
      }
    },
    [onDrop, toast]
  );

  return (
    <div
      className="file-drop-zone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnter={e => {
        e.preventDefault();
        onDragOver(true);
      }}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <motion.div
        animate={isDragOver ? { scale: 1.05 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          textAlign: 'center',
          padding: compact ? '12px' : '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? '12px' : '0',
          flexDirection: compact ? 'row' : 'column',
        }}
      >
        <div
          style={{
            width: compact ? '32px' : '80px',
            height: compact ? '32px' : '80px',
            margin: compact ? '0' : '0 auto 16px',
            borderRadius: compact ? '6px' : '50%',
            background: isDragOver ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `2px dashed ${isDragOver ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          <svg
            width={compact ? '16' : '32'}
            height={compact ? '16' : '32'}
            viewBox="0 0 24 24"
            fill="none"
            stroke={isDragOver ? '#3b82f6' : 'rgba(255, 255, 255, 0.4)'}
            strokeWidth="2"
            style={{ transition: 'stroke 0.2s' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <h4
            style={{
              color: isDragOver ? '#3b82f6' : 'rgba(255, 255, 255, 0.8)',
              fontSize: compact ? '13px' : '16px',
              fontWeight: 600,
              margin: compact ? '0' : '0 0 8px',
              transition: 'color 0.2s',
            }}
          >
            Drop Files Here
          </h4>
          {!compact && (
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '14px',
                margin: 0,
              }}
            >
              or click to browse
            </p>
          )}
        </div>
      </motion.div>

      {isDragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '2px dashed rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            pointerEvents: 'none',
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
};
