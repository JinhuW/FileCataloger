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

import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ShelfConfig, ShelfItem } from '@shared/types';
import type { ComponentInstance } from '@shared/types/componentDefinition';
import { SHELF_CONSTANTS } from '@shared/constants';
import { ShelfHeader, ErrorBoundary, FileDropZone } from '@renderer/components/domain';
import { ResizableShelfContainer } from '@renderer/components/layout/ResizableShelfContainer';
import { RenamePatternBuilder } from '../RenamePatternBuilder';
import { FileRenamePreviewList } from '../FileRenamePreviewList';
import { WarningDialog } from '@renderer/components/primitives';
import { useToast } from '@renderer/stores/toastStore';
import { useWindowSize } from '@renderer/hooks/useWindowSize';
import { useComponentLibraryStore } from '@renderer/stores/componentLibraryStore';
import {
  generateRenamePreviewFromInstances,
  executeFileRenames,
} from '@renderer/utils/renameUtils';
import { validateFileRenames, formatValidationWarning } from '@renderer/utils/fileValidation';
import { logger } from '@shared/logger';
import { filterDuplicates, getDuplicateMessage } from '@renderer/utils/duplicateDetection';

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
    const [patternInstances, setPatternInstances] = useState<ComponentInstance[]>([]);

    // Use window size management with main process sync
    const { size, isResizing } = useWindowSize(
      config.size?.width || SHELF_CONSTANTS.DEFAULT_WIDTH,
      config.size?.height || SHELF_CONSTANTS.DEFAULT_HEIGHT
    );

    const [validationWarning, setValidationWarning] = useState<{
      message: string;
      details: React.ReactNode;
    } | null>(null);

    // Use config.items as the source of truth for selected files
    const selectedFiles = config.items;

    // Get toast notification system
    const toast = useToast();

    // Get component library for resolving component definitions
    const componentLibrary = useComponentLibraryStore(state => state.components);

    // Generate previews from pattern instances
    const filePreview = useMemo(() => {
      if (selectedFiles.length === 0) {
        return [];
      }

      // If no pattern is built yet, show original filenames
      if (patternInstances.length === 0) {
        return selectedFiles.map(file => ({
          originalName: file.name,
          newName: file.name, // Show original name as "preview"
          selected: true,
          type: file.type,
        }));
      }

      return generateRenamePreviewFromInstances(selectedFiles, patternInstances, componentLibrary);
    }, [selectedFiles, patternInstances, componentLibrary]);

    // Renaming state
    const [isRenaming, setIsRenaming] = useState(false);

    // Handle file drop
    const handleFileDrop = useCallback(
      (items: ShelfItem[]) => {
        logger.info(
          `📦 FileRenameShelf.handleFileDrop: Received ${items.length} items:`,
          items.map(i => i.name)
        );

        // Use centralized duplicate detection
        const { items: newItems, duplicateCount } = filterDuplicates(items, selectedFiles, {
          logDuplicates: true,
        });

        // Show user feedback about duplicates using centralized utility
        if (duplicateCount > 0) {
          const message = getDuplicateMessage(duplicateCount, 'rename');
          if (message) {
            toast.warning(message.title, message.message, 4000);
          }
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

    // Handle pattern change for real-time preview updates
    const handlePatternChange = useCallback((instances: ComponentInstance[]) => {
      setPatternInstances(instances);
    }, []);

    // Handle rename action - receives instances from pattern builder
    const handleRename = useCallback(
      async (instances: ComponentInstance[]) => {
        // Store the instances for preview generation
        setPatternInstances(instances);

        // Generate previews with the new instances
        const previews = generateRenamePreviewFromInstances(
          selectedFiles,
          instances,
          componentLibrary
        );

        // Create map for validation
        const newNamesMap = new Map<string, string>();
        selectedFiles.forEach((file, index) => {
          const preview = previews[index];
          if (preview) {
            newNamesMap.set(file.id, preview.newName);
          }
        });

        // Validate the rename operations
        const validationResult = validateFileRenames(selectedFiles, newNamesMap, destinationPath);

        if (!validationResult.isValid) {
          const warning = formatValidationWarning(validationResult);
          setValidationWarning(warning);
          setShowWarningDialog(true);
          return;
        }

        // Execute rename
        setIsRenaming(true);
        try {
          const results = await executeFileRenames(selectedFiles, previews, {
            onProgress: (completed, total) => {
              logger.info(`Rename progress: ${completed}/${total}`);
            },
            destinationPath,
          });

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
        } catch (error) {
          logger.error('Rename operation failed:', error);
          toast.error('Rename Failed', error instanceof Error ? error.message : 'Unknown error');
        } finally {
          setIsRenaming(false);
        }
      },
      [selectedFiles, destinationPath, componentLibrary, toast, onItemRemove]
    );

    // Perform rename (called from warning dialog)
    const performRename = useCallback(async () => {
      if (filePreview.length === 0) {
        toast.error('No Pattern', 'Please build a naming pattern first');
        return;
      }

      setIsRenaming(true);
      try {
        const results = await executeFileRenames(selectedFiles, filePreview, {
          onProgress: (completed, total) => {
            logger.info(`Rename progress: ${completed}/${total}`);
          },
          destinationPath,
        });

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
      } catch (error) {
        logger.error('Rename operation failed:', error);
        toast.error('Rename Failed', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsRenaming(false);
      }
    }, [selectedFiles, filePreview, destinationPath, toast, onItemRemove]);

    return (
      <ErrorBoundary>
        <ResizableShelfContainer
          width={size.width}
          height={size.height}
          minWidth={SHELF_CONSTANTS.MIN_WIDTH}
          minHeight={SHELF_CONSTANTS.MIN_HEIGHT}
          maxWidth={SHELF_CONSTANTS.MAX_WIDTH}
          maxHeight={SHELF_CONSTANTS.MAX_HEIGHT}
          className="file-rename-shelf"
          style={{
            background: 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            border: 'none', // Remove border to prevent offset
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: isRenaming || isResizing ? 'none' : 'auto',
            opacity: isRenaming || isResizing ? 0.7 : config.opacity,
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
                      <FileRenamePreviewList
                        previews={filePreview}
                        files={selectedFiles}
                        onRemove={handleFileRemove}
                      />
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
                hasFiles={selectedFiles.length > 0}
                selectedFiles={selectedFiles}
                onDestinationChange={setDestinationPath}
                onRename={handleRename}
                onPatternChange={handlePatternChange}
              />
            </div>
          </div>
        </ResizableShelfContainer>

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
