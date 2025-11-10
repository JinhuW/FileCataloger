import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ShelfItem } from '@shared/types/shelf';
import type { FileRenamePreview } from '@shared/types/fileRename';
import {
  buildFileTree,
  flattenTree,
  toggleExpansion,
  expandAll,
  collapseAll,
  autoExpandFolders,
} from '@renderer/utils/fileTreeUtils';
import { TreeNode } from './TreeNode';

interface FileRenameTreeViewProps {
  previews: FileRenamePreview[];
  files: ShelfItem[];
  onRemove: (index: number) => void;
  defaultExpanded?: boolean;
}

export const FileRenameTreeView: React.FC<FileRenameTreeViewProps> = ({
  previews,
  files,
  onRemove,
  defaultExpanded = false,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Build the tree structure
  const tree = useMemo(() => {
    if (!files.length) return null;
    return buildFileTree(files, previews);
  }, [files, previews]);

  // Initialize expansion state
  useEffect(() => {
    if (tree) {
      if (defaultExpanded) {
        setExpandedPaths(expandAll(tree));
      } else {
        // Auto-expand folders with <= 10 files
        setExpandedPaths(autoExpandFolders(tree, 10));
      }
    }
  }, [tree, defaultExpanded]);

  // Flatten the tree for rendering
  const flattenedNodes = useMemo(() => {
    if (!tree) return [];
    return flattenTree(tree, expandedPaths);
  }, [tree, expandedPaths]);

  // Handle folder toggle
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => toggleExpansion(prev, path));
  }, []);

  // Handle file removal
  const handleRemove = useCallback(
    (nodeIndex: number | undefined) => {
      if (nodeIndex !== undefined) {
        onRemove(nodeIndex);
      }
    },
    [onRemove]
  );

  // Expand/Collapse all controls
  const handleExpandAll = useCallback(() => {
    if (tree) {
      setExpandedPaths(expandAll(tree));
    }
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(collapseAll());
  }, []);

  if (!tree || flattenedNodes.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: '#718096',
          fontSize: 14,
        }}
      >
        No files to display
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Expand/Collapse controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          gap: 8,
        }}
      >
        <button
          onClick={handleExpandAll}
          style={{
            background: 'none',
            border: '1px solid rgba(66, 153, 225, 0.3)',
            color: '#4299e1',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.5)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.3)';
          }}
        >
          Expand All
        </button>
        <button
          onClick={handleCollapseAll}
          style={{
            background: 'none',
            border: '1px solid rgba(66, 153, 225, 0.3)',
            color: '#4299e1',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.5)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.3)';
          }}
        >
          Collapse All
        </button>
      </div>

      {/* Tree view */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 0',
        }}
      >
        <AnimatePresence mode="sync">
          {flattenedNodes.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              isExpanded={expandedPaths.has(node.path)}
              onToggle={() => handleToggle(node.path)}
              onRemove={
                node.type === 'file' && node.index !== undefined
                  ? () => handleRemove(node.index)
                  : undefined
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
