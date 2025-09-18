/**
 * @file ShelfDragHandler.tsx
 * @description Handles drag and drop functionality for the shelf component.
 * Extracts complex drag/drop logic into a focused component.
 *
 * @features
 * - Drag over/enter/leave event handling
 * - Drop processing with file validation
 * - Visual feedback during drag operations
 * - IPC communication for drag events
 */

import React, { ReactNode, useCallback } from 'react';
import { logger } from '@shared/logger';
import { processDroppedFiles } from '@renderer/utils/fileProcessing';
import { ShelfItem } from '@shared/types';

interface ShelfDragHandlerProps {
  children: ReactNode;
  shelfId: string;
  isDragOver: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  onDrop: (items: ShelfItem[]) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const ShelfDragHandler: React.FC<ShelfDragHandlerProps> = ({
  children,
  shelfId,
  onDragStateChange,
  onDrop,
  style,
  className,
}) => {
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      onDragStateChange(true);
    },
    [onDragStateChange]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only set drag over to false if we're leaving the shelf entirely
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        onDragStateChange(false);

        // Notify main process that drop operation ended
        if (window.api) {
          window.api.send('shelf:drop-end', shelfId);
          logger.debug('Drop operation ended on shelf:', shelfId);
        }
      }
    },
    [onDragStateChange, shelfId]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragStateChange(true);

      // Notify main process that drop operation started
      if (window.api) {
        window.api.send('shelf:drop-start', shelfId);
        logger.debug('Drop operation started on shelf:', shelfId);
      }
    },
    [onDragStateChange, shelfId]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragStateChange(false);

      // Notify main process that drop is being processed
      if (window.api) {
        window.api.send('shelf:drop-end', shelfId);
        logger.debug('Processing drop on shelf:', shelfId);
      }

      // Process dropped items using utility function
      try {
        const items = await processDroppedFiles(e.dataTransfer);
        if (items.length > 0) {
          logger.debug('Dropping', items.length, 'items on shelf', shelfId);
          logger.debug('Items:', items);

          // Notify main process about dropped files
          if (window.api) {
            const filePaths = items
              .filter(item => item.type === 'file' && item.path)
              .map(item => item.path as string);

            if (filePaths.length > 0) {
              logger.debug('Notifying main process about', filePaths.length, 'dropped files');
              window.api.send('shelf:files-dropped', {
                shelfId,
                files: filePaths,
              });
            }
          }

          onDrop(items);
        } else {
          logger.debug('No valid items to drop');
        }
      } catch (error) {
        logger.error('Error processing drop:', error);
      }
    },
    [onDragStateChange, onDrop, shelfId]
  );

  return (
    <div
      className={className}
      style={style}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
};
