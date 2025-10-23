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
import { motion } from 'framer-motion';
import { ShelfConfig, ShelfItem, FileRenamePreview, RenameComponent } from '@shared/types';
import { ShelfHeader, ErrorBoundary, FileDropZone } from '@renderer/components/domain';
import { RenamePatternBuilder } from '../RenamePatternBuilder';
import { FileRenamePreviewList } from '../FileRenamePreviewList';
import { WarningDialog } from '@renderer/components/primitives';
import { validateFileRenames, formatValidationWarning } from '@renderer/utils/fileValidation';
import { useExternalPlugins } from '@renderer/hooks/useExternalPlugins';
import { useToast } from '@renderer/stores/toastStore';
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
    const [renameComponents, setRenameComponents] = useState<RenameComponent[]>([
      { id: 'date-1', type: 'date', format: 'YYYYMMDD' },
      { id: 'fileName-1', type: 'fileName' },
    ]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [destinationPath, setDestinationPath] = useState('~/Downloads');
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [validationWarning, setValidationWarning] = useState<{
      message: string;
      details: React.ReactNode;
    } | null>(null);

    // Use config.items as the source of truth for selected files
    const selectedFiles = config.items;

    // Get external plugin executor
    const { executePlugin } = useExternalPlugins();

    // Get toast notification system
    const toast = useToast();

    // Generate preview names based on current pattern
    const filePreview = useMemo((): FileRenamePreview[] => {
      return selectedFiles.map((file, fileIndex) => {
        let newName = '';

        renameComponents.forEach((component, index) => {
          if (index > 0) newName += '_'; // Add separator

          switch (component.type) {
            case 'date': {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              newName += `${year}${month}${day}`;
              break;
            }
            case 'fileName': {
              const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
              newName += component.value || nameWithoutExt;
              break;
            }
            case 'text':
              newName += component.value || '';
              break;
            case 'counter':
              newName += String(fileIndex + 1).padStart(3, '0');
              break;
            case 'project':
              newName += component.value || 'Project';
              break;
            default:
              // Handle plugin components
              if (component.type.startsWith('plugin:') && component.pluginId) {
                // For now, use a placeholder - actual plugin execution would be async
                // and should be handled differently in production
                newName += component.value || `[${component.pluginId}]`;
              }
              break;
          }
        });

        // Add file extension (not for folders)
        if (file.type !== 'folder') {
          const ext = file.name.match(/\.[^/.]+$/);
          if (ext) newName += ext[0];
        }

        return {
          originalName: file.name,
          newName,
          selected: true,
          type: file.type,
        };
      });
    }, [selectedFiles, renameComponents]);

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

    // Perform the actual rename operation
    const performRename = useCallback(async () => {
      try {
        // Process each file
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const preview = filePreview[i];
          if (preview) {
            let finalName = '';

            // Process each component
            for (let j = 0; j < renameComponents.length; j++) {
              const component = renameComponents[j];
              if (j > 0) finalName += '_';

              if (component.type.startsWith('plugin:') && component.pluginId) {
                // Execute plugin component
                try {
                  const extension = file.name.match(/\.[^/.]+$/)?.[0] || '';
                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

                  const result = await executePlugin(
                    component.pluginId,
                    nameWithoutExt,
                    extension,
                    i,
                    component.config
                  );
                  finalName += result;
                } catch (error) {
                  logger.error(`Plugin execution failed for ${component.pluginId}:`, error);
                  finalName += `[${component.pluginId}-error]`;
                }
              } else {
                // Handle built-in components (same as preview logic)
                switch (component.type) {
                  case 'date': {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    finalName += `${year}${month}${day}`;
                    break;
                  }
                  case 'fileName': {
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                    finalName += component.value || nameWithoutExt;
                    break;
                  }
                  case 'text':
                    finalName += component.value || '';
                    break;
                  case 'counter':
                    finalName += String(i + 1).padStart(3, '0');
                    break;
                  case 'project':
                    finalName += component.value || 'Project';
                    break;
                }
              }
            }

            // Add extension
            if (file.type !== 'folder') {
              const ext = file.name.match(/\.[^/.]+$/)?.[0];
              if (ext) finalName += ext;
            }

            // Actually rename the file using Electron APIs
            logger.debug(`🔧 DEBUG: File object structure:`, {
              id: file.id,
              name: file.name,
              path: file.path,
              type: file.type,
              keys: Object.keys(file),
            });

            // Validate that the file has a valid path
            if (!file.path || !file.path.includes('/')) {
              logger.error(`❌ Cannot rename ${file.name}: No valid file path available`);
              logger.info('💡 Tip: Drag files from Finder to ensure full paths are captured');
              continue; // Skip this file
            }

            const oldPath = file.path;
            const directory = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const newPath = directory + '/' + finalName;

            try {
              const result = await window.api.invoke('fs:rename-file', oldPath, newPath);
              if (result.success) {
                logger.info(`✅ File renamed: ${file.name} → ${finalName}`);
                // Update the file item with new name and path
                onItemRemove(file.id);
                onItemAdd({
                  ...file,
                  name: finalName,
                  path: newPath,
                });
              } else {
                logger.error(`❌ Failed to rename ${file.name}:`, result.error);
              }
            } catch (error) {
              logger.error(`❌ Rename failed for ${file.name}:`, error);
            }
          }
        }

        // Clear files after rename - state is managed by parent (ShelfPage)
        selectedFiles.forEach(file => onItemRemove(file.id));
      } catch (error) {
        logger.error('Rename operation failed:', error);
      }
    }, [selectedFiles, filePreview, renameComponents, executePlugin, onItemRemove, onItemAdd]);

    // Handle rename action
    const handleRename = useCallback(() => {
      // Create a map of file IDs to their new names
      const newNamesMap = new Map<string, string>();
      selectedFiles.forEach((file, index) => {
        const preview = filePreview[index];
        if (preview) {
          newNamesMap.set(file.id, preview.newName);
        }
      });

      // Validate the rename operations
      const validation = validateFileRenames(selectedFiles, newNamesMap, destinationPath);

      if (!validation.isValid) {
        // Show warning dialog
        const warning = formatValidationWarning(validation);
        setValidationWarning(warning);
        setShowWarningDialog(true);
        return;
      }

      // Proceed with rename
      performRename();
    }, [selectedFiles, filePreview, destinationPath, performRename]);

    return (
      <ErrorBoundary>
        <motion.div
          className="file-rename-shelf"
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={{
            opacity: config.isVisible ? config.opacity : 0,
            scale: config.isVisible ? 1 : 0.9,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            background: 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: '900px',
            height: '600px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
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

        {/* Warning Dialog */}
        {validationWarning && (
          <WarningDialog
            isOpen={showWarningDialog}
            onClose={() => setShowWarningDialog(false)}
            title="File Path/Name Warning"
            message={validationWarning.message}
            details={validationWarning.details}
            onConfirm={performRename}
            confirmText="Continue Anyway"
            cancelText="Cancel"
          />
        )}
      </ErrorBoundary>
    );
  }
);

FileRenameShelf.displayName = 'FileRenameShelf';
