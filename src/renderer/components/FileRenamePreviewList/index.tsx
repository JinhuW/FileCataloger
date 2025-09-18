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

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileRenamePreview } from '../../shared/types';
import { Tooltip } from '../Tooltip';

interface FileRenamePreviewListProps {
  previews: FileRenamePreview[];
  onRemove: (index: number) => void;
}

export const FileRenamePreviewList: React.FC<FileRenamePreviewListProps> = ({
  previews,
  onRemove,
}) => {
  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '16px',
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
              padding: '12px',
              marginBottom: '8px',
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
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={preview.selected}
              readOnly
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
              }}
            />

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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth="2"
              >
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>

            {/* File Names */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '11px',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Current File Name
              </div>
              <Tooltip content={preview.originalName}>
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '13px',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {preview.originalName}
                </div>
              </Tooltip>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '11px',
                  }}
                >
                  →
                </span>
                <Tooltip content={preview.newName}>
                  <div
                    style={{
                      color: '#3b82f6',
                      fontSize: '13px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {preview.newName}
                  </div>
                </Tooltip>
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
  );
};
