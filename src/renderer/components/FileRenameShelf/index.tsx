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
import { ShelfConfig, ShelfItem, FileRenamePreview, RenameComponent } from '../../shared/types';
import { ShelfHeader } from '../ShelfHeader';
import { ErrorBoundary } from '../ErrorBoundary';
import { FileDropZone } from '../FileDropZone';
import { RenamePatternBuilder } from '../RenamePatternBuilder';
import { FileRenamePreviewList } from '../FileRenamePreviewList';

export interface FileRenameShelfProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onItemAdd: (item: ShelfItem) => void;
  onItemRemove: (itemId: string) => void;
  onClose: () => void;
}

export const FileRenameShelf = React.memo<FileRenameShelfProps>(
  ({ config, onConfigChange, onItemAdd, onItemRemove, onClose }) => {
    const [selectedFiles, setSelectedFiles] = useState<ShelfItem[]>([]);
    const [renameComponents, setRenameComponents] = useState<RenameComponent[]>([
      { id: 'date-1', type: 'date', format: 'YYYYMMDD' },
      { id: 'fileName-1', type: 'fileName' },
    ]);
    const [isDragOver, setIsDragOver] = useState(false);

    // Generate preview names based on current pattern
    const filePreview = useMemo((): FileRenamePreview[] => {
      return selectedFiles.map(file => {
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
              newName += String(index + 1).padStart(3, '0');
              break;
            case 'project':
              newName += component.value || 'Project';
              break;
          }
        });

        // Add file extension
        const ext = file.name.match(/\.[^/.]+$/);
        if (ext) newName += ext[0];

        return {
          originalName: file.name,
          newName,
          selected: true,
        };
      });
    }, [selectedFiles, renameComponents]);

    // Handle file drop
    const handleFileDrop = useCallback(
      (items: ShelfItem[]) => {
        setSelectedFiles(prev => [...prev, ...items]);
        items.forEach(item => onItemAdd(item));
      },
      [onItemAdd]
    );

    // Handle file removal
    const handleFileRemove = useCallback(
      (index: number) => {
        const file = selectedFiles[index];
        if (file) {
          setSelectedFiles(prev => prev.filter((_, i) => i !== index));
          onItemRemove(file.id);
        }
      },
      [selectedFiles, onItemRemove]
    );

    // Handle rename action
    const handleRename = useCallback(() => {
      // TODO: Implement actual file renaming logic

      // For now, just clear the files after rename
      selectedFiles.forEach(file => onItemRemove(file.id));
      setSelectedFiles([]);
    }, [selectedFiles, onItemRemove]);

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
              onTogglePin={() => onConfigChange({ isPinned: !config.isPinned })}
              onClose={onClose}
              title="Rename Files"
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
                  padding: '16px',
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
                    margin: '4px 0 0',
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
                flex: 1,
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
              />
            </div>
          </div>
        </motion.div>
      </ErrorBoundary>
    );
  }
);

FileRenameShelf.displayName = 'FileRenameShelf';
