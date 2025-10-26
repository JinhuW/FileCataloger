/**
 * @file FileRenameShelf.tsx
 * @description Specialized shelf component for batch file renaming operations. Features a two-panel
 * layout with file preview on the left and pattern builder on the right.
 *
 * @props {ShelfConfig} config - Shelf configuration object
 * @props {function} onConfigChange - Callback for updating shelf configuration
 * @props {function} onItemAdd - Callback when files are added to the shelf
 * @props {function} onItemRemove - Callback when files are removed from the shelf
 * @props {function} onClose - Callback when shelf is closed
 *
 * @key-features
 * - Two-panel layout for file preview and pattern building
 * - Real-time preview of renamed file names
 * - Drag-and-drop file selection with compact mode when files exist
 * - Configurable rename pattern with multiple component types
 * - Default rename pattern with date and filename components
 * - File extension preservation during rename operations
 * - Batch rename execution with file cleanup
 *
 * @usage
 * ```tsx
 * <FileRenameShelf
 *   config={renameShelfConfig}
 *   onConfigChange={handleConfigChange}
 *   onItemAdd={handleItemAdd}
 *   onItemRemove={handleItemRemove}
 *   onClose={handleClose}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { ShelfHeader, ErrorBoundary, FileDropZone } from '@renderer/components/domain';
import { RenamePatternBuilder } from '../RenamePatternBuilder';
import { FileRenamePreviewList } from '../FileRenamePreviewList';
import { WarningDialog } from '@renderer/components/primitives';
import { useToast } from '@renderer/stores/toastStore';
import { useFileRename } from '@renderer/hooks/useFileRename';
import { SHELF_DIMENSIONS, ANIMATION } from '@renderer/constants/ui';
import { logger } from '@shared/logger';

export interface FileRenameShelfProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onItemAdd: (item: ShelfItem) => void;
  onItemRemove: (itemId: string) => void;
  onClose: () => void;
}

export const FileRenameShelf = React.memo<FileRenameShelfProps>(
  ({ config, onConfigChange: _onConfigChange, onItemAdd, onItemRemove, onClose }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [destinationPath, setDestinationPath] = useState('~/Downloads');
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [validationWarning, setValidationWarning] = useState<{
      message: string;
      details: React.ReactNode;
    } | null>(null);

    // Use config.items as the source of truth for selected files
    const selectedFiles = config.items;

    // Get toast notification system
    const toast = useToast();

    // Use the file rename hook for all rename operations
    const {
      components: renameComponents,
      setComponents: setRenameComponents,
      previews: filePreview,
      executeRename,
      validate,
      isRenaming,
    } = useFileRename(selectedFiles, {
      onSuccess: results => {
        const successCount = results.filter(r => r.success).length;
        toast.success(
          'Rename Complete',
          `Successfully renamed ${successCount} of ${results.length} files`
        );
        // Clear files after successful rename
        results.forEach(result => {
          if (result.success) {
            const file = selectedFiles.find(f => f.name === result.originalName);
            if (file) onItemRemove(file.id);
          }
        });
      },
      onError: error => {
        toast.error('Rename Failed', error.message);
      },
      onProgress: (completed, total) => {
        logger.info(`Rename progress: ${completed}/${total}`);
      },
    });

    // Handle file drop
    const handleFileDrop = useCallback(
      (items: ShelfItem[]) => {
        logger.info(
          `📦 FileRenameShelf.handleFileDrop: Received ${items.length} items:`,
          items.map(i => i.name)
        );

        // Check for duplicates against existing files
        const existingPaths = new Set(selectedFiles.map(file => file.path).filter(Boolean));
        const newItems = items.filter(item => {
          if (item.path && existingPaths.has(item.path)) {
            logger.info(`📋 Skipping duplicate file/folder: ${item.name} (${item.path})`);
            return false;
          }
          return true;
        });

        if (newItems.length < items.length) {
          const duplicateCount = items.length - newItems.length;
          logger.info(`📋 Filtered out ${duplicateCount} duplicate items from drop`);

          // Show user feedback about duplicates
          toast.warning(
            'Duplicate Files Skipped',
            `${duplicateCount} file${duplicateCount === 1 ? '' : 's'} already exist${duplicateCount === 1 ? 's' : ''} on this shelf and ${duplicateCount === 1 ? 'was' : 'were'} skipped.`,
            4000
          );
        }

        // Only add new (non-duplicate) items - state is managed by parent (ShelfPage)
        if (newItems.length > 0) {
          newItems.forEach(item => onItemAdd(item));
        }
      },
      [onItemAdd, selectedFiles, toast]
    );

    // Handle file removal
    const handleFileRemove = useCallback(
      (index: number) => {
        const file = selectedFiles[index];
        if (file) {
          onItemRemove(file.id);
        }
      },
      [selectedFiles, onItemRemove]
    );

    // Handle rename action
    const handleRename = useCallback(async () => {
      // Validate the rename operations
      const validation = validate(selectedFiles, destinationPath);

      if (!validation.isValid && validation.warning) {
        // Show warning dialog
        setValidationWarning(validation.warning);
        setShowWarningDialog(true);
        return;
      }

      // Execute rename
      try {
        await executeRename(selectedFiles, destinationPath);
      } catch (error) {
        logger.error('Rename operation failed:', error);
      }
    }, [selectedFiles, destinationPath, validate, executeRename]);

    // Perform rename (called from warning dialog)
    const performRename = useCallback(async () => {
      try {
        await executeRename(selectedFiles, destinationPath);
      } catch (error) {
        logger.error('Rename operation failed:', error);
      }
    }, [selectedFiles, destinationPath, executeRename]);

    return (
      <ErrorBoundary>
        <motion.div
          className="file-rename-shelf"
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={{
            opacity: config.isVisible ? config.opacity : 0,
            scale: config.isVisible ? 1 : 0.9,
          }}
          transition={{ duration: ANIMATION.DURATION, ease: ANIMATION.EASE }}
          style={{
            background: 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: `${SHELF_DIMENSIONS.WIDTH}px`,
            height: `${SHELF_DIMENSIONS.HEIGHT}px`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: isRenaming ? 'none' : 'auto',
            opacity: isRenaming ? 0.7 : 1,
          }}
        >
          {/* Header */}
          <div
            style={{
              flexShrink: 0,
              background: 'rgba(40, 40, 40, 0.8)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <ShelfHeader
              config={config}
              itemCount={selectedFiles.length}
              onClose={onClose}
              title="FileCataloger"
            />
          </div>

          {/* Main Content - Two Panel Layout */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {/* Left Panel - File Drop Zone */}
            <div
              style={{
                width: '40%',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(25, 25, 25, 0.5)',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <h3
                  style={{
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Preview
                </h3>
                <p
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '12px',
                    margin: '2px 0 0',
                  }}
                >
                  {selectedFiles.length} files selected
                </p>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {selectedFiles.length === 0 ? (
                  <FileDropZone
                    isDragOver={isDragOver}
                    onDrop={handleFileDrop}
                    onDragOver={over => setIsDragOver(over)}
                  />
                ) : (
                  <>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <FileRenamePreviewList previews={filePreview} onRemove={handleFileRemove} />
                    </div>
                    <div
                      style={{
                        padding: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(20, 20, 20, 0.5)',
                        flexShrink: 0,
                      }}
                    >
                      <FileDropZone
                        isDragOver={isDragOver}
                        onDrop={handleFileDrop}
                        onDragOver={over => setIsDragOver(over)}
                        compact={true}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Panel - Rename Pattern Builder */}
            <div
              style={{
                width: '60%',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(35, 35, 35, 0.3)',
              }}
            >
              <RenamePatternBuilder
                components={renameComponents}
                onChange={setRenameComponents}
                onRename={handleRename}
                hasFiles={selectedFiles.length > 0}
                selectedFiles={selectedFiles}
                onDestinationChange={setDestinationPath}
              />
            </div>
          </div>
        </motion.div>

        {/* Warning Dialog - Rendered via Portal to escape stacking context */}
        {validationWarning &&
          ReactDOM.createPortal(
            <WarningDialog
              isOpen={showWarningDialog}
              onClose={() => setShowWarningDialog(false)}
              title="File Path/Name Warning"
              message={validationWarning.message}
              details={validationWarning.details}
              onConfirm={performRename}
              confirmText="Continue Anyway"
              cancelText="Cancel"
            />,
            document.body
          )}
      </ErrorBoundary>
    );
  }
);

FileRenameShelf.displayName = 'FileRenameShelf';
