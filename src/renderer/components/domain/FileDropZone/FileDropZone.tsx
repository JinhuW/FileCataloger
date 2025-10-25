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
import { ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';
import { useToast } from '@renderer/stores/toastStore';
import { processFileList } from '@renderer/utils/fileProcessing';
import { DROP_ZONE } from '@renderer/constants/ui';

export interface FileDropZoneProps {
  isDragOver: boolean;
  onDrop: (items: ShelfItem[]) => void;
  onDragOver: (over: boolean) => void;
  compact?: boolean;
  existingPaths?: Set<string>;
}

export const FileDropZone = React.memo<FileDropZoneProps>(
  ({ isDragOver, onDrop, onDragOver, compact = false, existingPaths = new Set<string>() }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();
    const handleDrop = useCallback(
      async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(false);

        logger.info(`📦 FileDropZone.handleDrop: Drop event received`);

        const dataTransfer = e.dataTransfer;
        logger.info(
          `📦 FileDropZone: dataTransfer.files.length = ${dataTransfer.files?.length || 0}`
        );

        if (dataTransfer.files && dataTransfer.files.length > 0) {
          // Use the centralized file processing utility
          const { items, duplicateCount, pathTypeCheckFailed } = await processFileList(
            dataTransfer.files,
            {
              existingPaths,
              source: 'drag',
            }
          );

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
              `${duplicateCount} file${duplicateCount === 1 ? '' : 's'} already exist${duplicateCount === 1 ? 's' : ''} on this shelf and ${duplicateCount === 1 ? 'was' : 'were'} skipped.`
            );
          }

          // Show warning if path type detection failed
          if (pathTypeCheckFailed) {
            toast.warning(
              'File Type Detection Limited',
              'Unable to verify file types. Folder detection may be inaccurate.'
            );
          }
        }
      },
      [onDrop, onDragOver, toast, existingPaths]
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

        // Use the centralized file processing utility
        const { items, duplicateCount, pathTypeCheckFailed } = await processFileList(files, {
          existingPaths,
          source: 'input',
        });

        if (items.length > 0) {
          logger.info(
            `📦 FileDropZone: Calling onDrop with ${items.length} items (from file input):`,
            items.map(i => i.name)
          );
          onDrop(items);
        } else {
          logger.warn('📦 FileDropZone: No items to drop from file input!');
        }

        // Show toast notification for duplicates
        if (duplicateCount > 0) {
          toast.warning(
            'Duplicate Files Skipped',
            `${duplicateCount} file${duplicateCount === 1 ? '' : 's'} already exist${duplicateCount === 1 ? 's' : ''} in your selection and ${duplicateCount === 1 ? 'was' : 'were'} skipped.`
          );
        }

        // Show warning if path type detection failed
        if (pathTypeCheckFailed) {
          toast.warning(
            'File Type Detection Limited',
            'Unable to verify file types. Folder detection may be inaccurate.'
          );
        }

        // Reset file input
        e.target.value = '';
      },
      [onDrop, toast, existingPaths]
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
            padding: compact ? DROP_ZONE.PADDING_COMPACT : DROP_ZONE.PADDING_NORMAL,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: compact ? '12px' : '0',
            flexDirection: compact ? 'row' : 'column',
          }}
        >
          <div
            style={{
              width: compact
                ? `${DROP_ZONE.ICON_SIZE_COMPACT}px`
                : `${DROP_ZONE.ICON_SIZE_NORMAL}px`,
              height: compact
                ? `${DROP_ZONE.ICON_SIZE_COMPACT}px`
                : `${DROP_ZONE.ICON_SIZE_NORMAL}px`,
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
  }
);

FileDropZone.displayName = 'FileDropZone';
