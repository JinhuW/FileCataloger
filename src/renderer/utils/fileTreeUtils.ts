import type { ShelfItem } from '@shared/types/shelf';
import type { FileRenamePreview } from '@shared/types/fileRename';

// Browser-compatible path utilities
const path = {
  sep: '/',
  join: (...parts: string[]) => {
    // Sanitize and validate path segments to prevent path traversal
    const sanitized = parts
      .filter(Boolean)
      .map(part => {
        // Remove path traversal attempts (..)
        const clean = part.replace(/\.\./g, '');
        // Remove leading/trailing slashes
        return clean.replace(/^\/+|\/+$/g, '');
      })
      .filter(part => part.length > 0);

    return sanitized.join('/').replace(/\/+/g, '/');
  },
};

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  preview?: FileRenamePreview;
  shelfItem?: ShelfItem;
  children: FileTreeNode[];
  depth: number;
  parentPath?: string;
  fileCount?: number;
  index?: number; // Original index in the flat list
}

export interface FlattenedTreeNode extends FileTreeNode {
  isExpanded?: boolean;
  hasChildren: boolean;
}

/**
 * Finds the common base path from a list of file paths
 */
function findCommonBasePath(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) {
    // For a single file, return its directory
    const segments = paths[0].split(/[\\/]/).filter(Boolean);
    return segments.slice(0, -1).join('/');
  }

  // Split all paths into segments
  const allSegments = paths.map(p => p.split(/[\\/]/).filter(Boolean));

  // Find the shortest path length
  const minLength = Math.min(...allSegments.map(s => s.length));

  // Find common prefix
  let commonDepth = 0;
  for (let i = 0; i < minLength - 1; i++) {
    const segment = allSegments[0][i];
    if (allSegments.every(segments => segments[i] === segment)) {
      commonDepth = i + 1;
    } else {
      break;
    }
  }

  return commonDepth > 0 ? allSegments[0].slice(0, commonDepth).join('/') : '';
}

/**
 * Builds a hierarchical tree structure from a flat list of files
 */
export function buildFileTree(items: ShelfItem[], previews: FileRenamePreview[]): FileTreeNode {
  // Find the common base path
  const allPaths = items.map(item => item.path);
  const basePath = findCommonBasePath(allPaths);
  const baseDepth = basePath ? basePath.split(/[\\/]/).filter(Boolean).length : 0;

  // Create a root node
  const root: FileTreeNode = {
    id: 'root',
    name: 'Files',
    type: 'folder',
    path: '',
    children: [],
    depth: 0,
    fileCount: items.length,
  };

  // Build path map for quick lookup
  const nodeMap = new Map<string, FileTreeNode>();
  nodeMap.set('', root);

  // Process each item
  items.forEach((item, index) => {
    const preview = previews[index];
    const fullPath = item.path;
    // Split by both forward and back slashes to handle all path formats
    const allSegments = fullPath.split(/[\\/]/).filter(Boolean);

    // Remove the common base path segments
    const segments = allSegments.slice(baseDepth);

    let currentPath = '';
    let parentNode = root;

    // Build folder structure
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      currentPath = currentPath ? path.join(currentPath, segment) : segment;

      if (!nodeMap.has(currentPath)) {
        const folderNode: FileTreeNode = {
          id: `folder-${currentPath}`,
          name: segment,
          type: 'folder',
          path: currentPath,
          children: [],
          depth: i + 1,
          parentPath: parentNode.path,
          fileCount: 0,
        };

        parentNode.children.push(folderNode);
        nodeMap.set(currentPath, folderNode);
        parentNode = folderNode;
      } else {
        parentNode = nodeMap.get(currentPath)!;
      }
    }

    // Add the file node
    const fileName = segments[segments.length - 1] || item.name;
    const fileNode: FileTreeNode = {
      id: `file-${index}`,
      name: fileName,
      type: 'file',
      path: fullPath,
      preview,
      shelfItem: item,
      children: [],
      depth: segments.length,
      parentPath: parentNode.path,
      index,
    };

    parentNode.children.push(fileNode);

    // Update file counts
    let node = parentNode;
    while (node) {
      if (node.fileCount !== undefined) {
        node.fileCount++;
      }
      node = node.parentPath ? nodeMap.get(node.parentPath) : null;
    }
  });

  // Sort children (folders first, then alphabetically)
  sortTreeChildren(root);

  return root;
}

/**
 * Sorts tree children recursively (folders first, then alphabetically)
 */
function sortTreeChildren(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    // Folders come before files
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    // Then sort alphabetically
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  // Recursively sort children
  for (const child of node.children) {
    if (child.type === 'folder') {
      sortTreeChildren(child);
    }
  }
}

/**
 * Flattens a tree structure for rendering, respecting expansion state
 */
export function flattenTree(
  node: FileTreeNode,
  expandedPaths: Set<string>,
  skipRoot = true
): FlattenedTreeNode[] {
  const result: FlattenedTreeNode[] = [];

  function traverse(node: FileTreeNode, isExpanded = true): void {
    // Skip the root node if requested
    if (!(skipRoot && node.id === 'root')) {
      const flatNode: FlattenedTreeNode = {
        ...node,
        isExpanded: expandedPaths.has(node.path),
        hasChildren: node.children.length > 0,
      };
      result.push(flatNode);
    }

    // Only traverse children if this node is expanded (or is root)
    if (isExpanded || node.id === 'root') {
      for (const child of node.children) {
        const childExpanded = expandedPaths.has(node.path) || node.id === 'root';
        traverse(child, childExpanded);
      }
    }
  }

  traverse(node);
  return result;
}

/**
 * Gets all folder paths in the tree
 */
export function getAllFolderPaths(node: FileTreeNode): string[] {
  const paths: string[] = [];

  function traverse(node: FileTreeNode): void {
    if (node.type === 'folder' && node.path) {
      paths.push(node.path);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(node);
  return paths;
}

/**
 * Toggles the expansion state of a path
 */
export function toggleExpansion(expandedPaths: Set<string>, path: string): Set<string> {
  const newSet = new Set(expandedPaths);
  if (newSet.has(path)) {
    newSet.delete(path);
  } else {
    newSet.add(path);
  }
  return newSet;
}

/**
 * Expands all folders in the tree
 */
export function expandAll(tree: FileTreeNode): Set<string> {
  return new Set(getAllFolderPaths(tree));
}

/**
 * Collapses all folders in the tree
 */
export function collapseAll(): Set<string> {
  return new Set();
}

/**
 * Auto-expands folders based on file count threshold
 */
export function autoExpandFolders(tree: FileTreeNode, threshold = 10): Set<string> {
  const expandedPaths = new Set<string>();

  function traverse(node: FileTreeNode): void {
    if (node.type === 'folder' && node.path) {
      // Expand if the folder has fewer files than threshold
      if ((node.fileCount || 0) <= threshold) {
        expandedPaths.add(node.path);
      }
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree);
  return expandedPaths;
}

/**
 * Finds a node by its original file index
 */
export function findNodeByIndex(tree: FileTreeNode, index: number): FileTreeNode | null {
  if (tree.index === index) {
    return tree;
  }

  for (const child of tree.children) {
    const found = findNodeByIndex(child, index);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Removes a node from the tree by index and rebuilds the tree
 */
export function removeNodeByIndex(
  items: ShelfItem[],
  previews: FileRenamePreview[],
  index: number
): { items: ShelfItem[]; previews: FileRenamePreview[]; tree: FileTreeNode } {
  const newItems = items.filter((_, i) => i !== index);
  const newPreviews = previews.filter((_, i) => i !== index);
  const newTree = buildFileTree(newItems, newPreviews);

  return {
    items: newItems,
    previews: newPreviews,
    tree: newTree,
  };
}
