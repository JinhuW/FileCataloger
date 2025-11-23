import React, { memo } from 'react';
import { motion } from 'framer-motion';
import type { FlattenedTreeNode } from '@renderer/utils/fileTreeUtils';
import { getFileIcon } from '@renderer/utils/fileTypeIcons';

interface TreeNodeProps {
  node: FlattenedTreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
}

export const TreeNode = memo<TreeNodeProps>(({ node, isExpanded, onToggle, onRemove, style }) => {
  const isFolder = node.type === 'folder';
  const hasChildren = node.hasChildren;
  const indentLevel = Math.max(0, node.depth - 1); // Adjust for root being hidden

  // Get the appropriate icon
  const getIcon = () => {
    if (isFolder) {
      // Custom folder icon (SVG)
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ marginRight: 6, flexShrink: 0 }}
        >
          <path
            d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.29289C6.69031 3 7.07185 3.15804 7.35355 3.43934L8.06066 4.14645C8.15421 4.24 8.28107 4.29289 8.41289 4.29289H12.5C13.3284 4.29289 14 4.96447 14 5.79289V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z"
            fill={isExpanded ? '#4299e1' : '#718096'}
            fillOpacity={isExpanded ? 0.9 : 0.7}
          />
          {isExpanded && (
            <path
              d="M2.5 6H13.5C13.7761 6 14 6.22386 14 6.5V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V6.5C2 6.22386 2.22386 6 2.5 6Z"
              fill="#4299e1"
              fillOpacity={0.3}
            />
          )}
        </svg>
      );
    } else {
      // Use existing file icon
      const iconPath = getFileIcon(node.name);
      return (
        <img
          src={iconPath}
          alt="file icon"
          style={{
            width: 16,
            height: 16,
            marginRight: 6,
            objectFit: 'contain',
            filter: 'brightness(0.9)',
          }}
        />
      );
    }
  };

  // Get chevron icon for folders
  const getChevron = () => {
    if (!isFolder || !hasChildren) return null;

    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        style={{
          marginRight: 4,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={onToggle}
      >
        <path
          d="M4.5 3L7.5 6L4.5 9"
          stroke="#a0aec0"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        paddingLeft: 12 + indentLevel * 20,
        cursor: isFolder && hasChildren ? 'pointer' : 'default',
        borderRadius: 4,
        transition: 'background-color 0.2s ease',
        backgroundColor: 'transparent',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Chevron for expandable folders */}
      {getChevron()}

      {/* File/Folder icon */}
      <div
        onClick={isFolder && hasChildren ? onToggle : undefined}
        style={{
          cursor: isFolder && hasChildren ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {getIcon()}
      </div>

      {/* Name and preview */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={isFolder && hasChildren ? onToggle : undefined}
      >
        <span
          style={{
            fontSize: 13,
            color: isFolder ? '#e2e8f0' : '#cbd5e0',
            fontWeight: isFolder ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: isFolder ? 'none' : 1,
            cursor: isFolder && hasChildren ? 'pointer' : 'default',
          }}
        >
          {node.name}
        </span>

        {/* Show file count for folders */}
        {isFolder && node.fileCount !== undefined && node.fileCount > 0 && (
          <span
            style={{
              fontSize: 11,
              color: '#718096',
              backgroundColor: 'rgba(66, 153, 225, 0.15)',
              padding: '2px 6px',
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            {node.fileCount}
          </span>
        )}

        {/* Show rename preview for files */}
        {!isFolder && node.preview && (
          <>
            <span style={{ color: '#4a5568', fontSize: 16 }}>→</span>
            <span
              style={{
                fontSize: 13,
                color: node.preview.newName !== node.name ? '#4299e1' : '#cbd5e0',
                fontWeight: node.preview.newName !== node.name ? 500 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
            >
              {node.preview.newName}
            </span>
          </>
        )}
      </div>

      {/* Remove button for files */}
      {!isFolder && onRemove && (
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#fc8181',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: 14,
            opacity: 0.7,
            transition: 'opacity 0.2s ease',
            marginLeft: 8,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '0.7';
          }}
          title="Remove from preview"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
});

TreeNode.displayName = 'TreeNode';
