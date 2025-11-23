/**
 * @file tooltipUtils.ts
 * @description Utility functions for generating tooltip content for various contexts.
 * Provides builders for file metadata, component descriptions, and formatted text.
 *
 * @usage
 * ```typescript
 * const content = buildFileMetadataTooltip({
 *   fullPath: '/Users/john/Documents/file.txt',
 *   size: 1024,
 *   type: 'Text Document',
 * });
 * ```
 */

import type { FileMetadata, TooltipContent, ComponentDescription } from '@shared/types/ui';
import type { ShelfItem } from '@shared/types/shelf';

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/**
 * Format date in relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  // Format as date if older than a week
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format date in absolute format
 */
export const formatAbsoluteDate = (date: Date): string => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Get file name from path
 */
export const getFileName = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
};

/**
 * Get directory path from full path
 */
export const getDirectoryPath = (path: string): string => {
  const parts = path.split('/');
  parts.pop(); // Remove filename
  return parts.join('/') || '/';
};

/**
 * Build file metadata tooltip content
 */
export const buildFileMetadataTooltip = (item: ShelfItem): TooltipContent => {
  const metadata: FileMetadata = {
    fullPath: item.path,
    size: item.size || 0,
    formattedSize: formatFileSize(item.size || 0),
    type: item.type || 'Unknown',
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
  };

  return {
    type: 'metadata',
    metadata,
  };
};

/**
 * Format file metadata as text for display
 */
export const formatFileMetadataText = (metadata: FileMetadata): string => {
  const lines: string[] = [];

  // File path
  const fileName = getFileName(metadata.fullPath);
  const dirPath = getDirectoryPath(metadata.fullPath);
  lines.push(`📄 ${fileName}`);
  lines.push(`📁 ${dirPath}`);
  lines.push('');

  // File details
  lines.push(`Type: ${metadata.type}`);
  lines.push(`Size: ${metadata.formattedSize}`);
  lines.push('');

  // Dates
  lines.push(`Created: ${formatAbsoluteDate(metadata.createdAt)}`);
  lines.push(`Modified: ${formatAbsoluteDate(metadata.modifiedAt)}`);

  if (metadata.permissions) {
    lines.push('');
    lines.push(`Permissions: ${metadata.permissions}`);
  }

  return lines.join('\n');
};

/**
 * Build truncated text tooltip (shows full text when truncated)
 */
export const buildTruncatedTextTooltip = (
  text: string,
  maxDisplayLength: number
): string | null => {
  if (text.length <= maxDisplayLength) {
    return null; // No tooltip needed
  }

  return text;
};

/**
 * Build component description tooltip for rename pattern components
 */
export const buildComponentDescriptionTooltip = (
  componentName: string,
  description: string,
  example?: string,
  options?: string[]
): TooltipContent => {
  const componentDescription: ComponentDescription = {
    name: componentName,
    description,
    example,
    options,
  };

  return {
    type: 'component-description',
    componentDescription,
  };
};

/**
 * Format component description as text for display
 */
export const formatComponentDescriptionText = (description: ComponentDescription): string => {
  const lines: string[] = [];

  // Component name (title)
  lines.push(`✨ ${description.name}`);
  lines.push('');

  // Description
  lines.push(description.description);

  // Example if provided
  if (description.example) {
    lines.push('');
    lines.push(`Example: ${description.example}`);
  }

  // Options if provided
  if (description.options && description.options.length > 0) {
    lines.push('');
    lines.push('Options:');
    description.options.forEach(option => {
      lines.push(`  • ${option}`);
    });
  }

  return lines.join('\n');
};

/**
 * Build action button tooltip
 */
export const buildActionTooltip = (actionName: string, shortcut?: string): TooltipContent => {
  const text = shortcut ? `${actionName} (${shortcut})` : actionName;

  return {
    type: 'action',
    text,
  };
};

/**
 * Get tooltip content as string
 */
export const getTooltipContentAsString = (content: string | TooltipContent): string => {
  if (typeof content === 'string') {
    return content;
  }

  switch (content.type) {
    case 'text':
      return content.text || '';

    case 'metadata':
      return content.metadata ? formatFileMetadataText(content.metadata) : '';

    case 'component-description':
      return content.componentDescription
        ? formatComponentDescriptionText(content.componentDescription)
        : '';

    case 'action':
      return content.text || '';

    default:
      return '';
  }
};

/**
 * Check if text needs tooltip (is it truncated?)
 */
export const needsTooltip = (element: HTMLElement | null): boolean => {
  if (!element) return false;

  // Check if content is truncated using scrollWidth
  const isTruncated = element.scrollWidth > element.clientWidth;

  return isTruncated;
};

/**
 * Pattern component descriptions
 */
export const PATTERN_COMPONENT_DESCRIPTIONS: Record<string, ComponentDescription> = {
  filename: {
    name: 'Filename',
    description: 'Original file name without extension',
    example: 'document.pdf → document',
  },
  extension: {
    name: 'Extension',
    description: 'File extension including the dot',
    example: 'document.pdf → .pdf',
  },
  date: {
    name: 'Date',
    description: 'Current date in various formats',
    example: '2025-11-03',
    options: ['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYYMMDD'],
  },
  time: {
    name: 'Time',
    description: 'Current time in various formats',
    example: '14:30:45',
    options: ['HH:mm:ss', 'HH:mm', 'HHmmss'],
  },
  counter: {
    name: 'Counter',
    description: 'Sequential number with optional padding',
    example: '001, 002, 003',
    options: ['No padding', 'Pad to 2 digits', 'Pad to 3 digits', 'Pad to 4 digits'],
  },
  text: {
    name: 'Custom Text',
    description: 'Your own custom text literal',
    example: 'Project_',
  },
  project: {
    name: 'Project Name',
    description: 'Name of the current project or folder',
    example: 'MyProject',
  },
  uuid: {
    name: 'UUID',
    description: 'Universally unique identifier',
    example: 'a1b2c3d4-e5f6-7890',
  },
  random: {
    name: 'Random String',
    description: 'Random alphanumeric string',
    example: 'x7k9m2',
    options: ['4 characters', '6 characters', '8 characters', '12 characters'],
  },
};

/**
 * Get pattern component tooltip content
 */
export const getPatternComponentTooltip = (componentType: string): TooltipContent | null => {
  const description = PATTERN_COMPONENT_DESCRIPTIONS[componentType];

  if (!description) {
    return null;
  }

  return buildComponentDescriptionTooltip(
    description.name,
    description.description,
    description.example,
    description.options
  );
};
