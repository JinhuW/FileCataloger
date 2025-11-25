/**
 * @file FileRenamePreviewList.tsx
 * @description List component displaying preview of file rename operations with before/after names.
 * Shows current and proposed filenames with visual diff and selection controls.
 *
 * @props {FileRenamePreview[]} previews - Array of file rename previews to display
 * @props {function} onRemove - Callback when a preview item is removed (receives index)
 *
 * @features
 * - Visual before/after comparison of file names
 * - Checkbox selection state for each file
 * - Tooltips for truncated file names
 * - Animated list with staggered entrance effects
 * - File type icons for visual recognition
 * - Individual remove buttons with hover effects
 * - Empty state message when no files are selected
 * - Responsive layout with ellipsis overflow handling
 *
 * @usage
 * ```tsx
 * <FileRenamePreviewList
 *   previews={renamePreviewArray}
 *   onRemove={handleRemoveFile}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileRenamePreview, ShelfItem } from '@shared/types';
import { getFileIcon, getTypeIcon } from '@renderer/utils/fileTypeIcons';
import { ViewToggle, type ViewMode } from './ViewToggle';
import { FileRenameTreeView } from '../FileRenameTreeView/FileRenameTreeView';
import { ErrorBoundary } from '@renderer/components/domain/ErrorBoundary';
import { logger } from '@shared/logger';

export interface FileRenamePreviewListProps {
  previews: FileRenamePreview[];
  files?: ShelfItem[];
  onRemove: (index: number) => void;
}

const VIEW_MODE_STORAGE_KEY = 'fileRename.viewMode';

export const FileRenamePreviewList: React.FC<FileRenamePreviewListProps> = ({
  previews,
  files,
  onRemove,
}) => {
  // Load view mode from localStorage or default to 'list'
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return saved === 'tree' || saved === 'list' ? saved : 'list';
    } catch (error) {
      logger.warn('Failed to load view mode preference:', error);
      return 'list';
    }
  });

  // Save view mode to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (error) {
      logger.warn('Failed to save view mode preference:', error);
    }
  }, [viewMode]);
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with view toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          Preview
        </div>
        {previews.length > 0 && <ViewToggle view={viewMode} onChange={setViewMode} />}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'tree' && files ? (
          // Tree view with error boundary
          <ErrorBoundary
            fallback={
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: '#fc8181',
                }}
              >
                <p>Tree view error. Switching to list view...</p>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    backgroundColor: 'rgba(66, 153, 225, 0.3)',
                    border: '1px solid rgba(66, 153, 225, 0.5)',
                    borderRadius: 4,
                    color: '#4299e1',
                    cursor: 'pointer',
                  }}
                >
                  Switch to List View
                </button>
              </div>
            }
          >
            <FileRenameTreeView
              previews={previews}
              files={files}
              onRemove={onRemove}
              defaultExpanded={false}
            />
          </ErrorBoundary>
        ) : (
          // List view
          <div
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '8px 12px',
            }}
          >
            <AnimatePresence mode="sync">
              {previews.map((preview, index) => (
                <motion.div
                  key={`${preview.originalName}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  style={{
                    background: preview.selected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    border:
                      '1px solid ' +
                      (preview.selected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = preview.selected
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = preview.selected
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'transparent';
                  }}
                >
                  {/* File Icon */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={
                        preview.type === 'folder'
                          ? getTypeIcon('folder')
                          : getFileIcon(preview.originalName)
                      }
                      alt="file icon"
                      style={{
                        width: '20px',
                        height: '20px',
                        objectFit: 'contain',
                        filter: 'brightness(0.9)',
                      }}
                    />
                  </div>

                  {/* File Names */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '13px',
                        marginBottom: '4px',
                        wordBreak: 'break-word',
                        lineHeight: '1.4',
                      }}
                    >
                      {preview.originalName}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          color: 'rgba(255, 255, 255, 0.3)',
                          fontSize: '11px',
                          flexShrink: 0,
                        }}
                      >
                        →
                      </span>
                      <div
                        style={{
                          flex: 1,
                          color: '#3b82f6',
                          fontSize: '13px',
                          fontWeight: 500,
                          wordBreak: 'break-word',
                          lineHeight: '1.4',
                        }}
                      >
                        {preview.newName}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.4)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {previews.length === 0 && (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '14px',
                }}
              >
                No files to preview
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
