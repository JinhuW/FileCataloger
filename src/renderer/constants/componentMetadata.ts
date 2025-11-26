/**
 * Component Type Metadata
 *
 * Core metadata definitions for component types including labels,
 * icons, colors, and descriptions.
 */

import type { ComponentType } from '@shared/types/componentDefinition';

// ============================================================================
// Component Type Metadata
// ============================================================================

export interface ComponentTypeMetadata {
  type: ComponentType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const COMPONENT_TYPE_METADATA: Record<ComponentType, ComponentTypeMetadata> = {
  text: {
    type: 'text',
    label: 'Text',
    icon: '📝',
    color: '#64748b', // slate
    description: 'Static or dynamic text input',
  },
  select: {
    type: 'select',
    label: 'Select',
    icon: '🎯',
    color: '#3b82f6', // blue
    description: 'Single choice from predefined options',
  },
  date: {
    type: 'date',
    label: 'Date',
    icon: '📅',
    color: '#10b981', // green
    description: 'Date with customizable formatting',
  },
  number: {
    type: 'number',
    label: 'Number',
    icon: '🔢',
    color: '#8b5cf6', // purple
    description: 'Numeric values with optional auto-increment',
  },
  fileMetadata: {
    type: 'fileMetadata',
    label: 'File Metadata',
    icon: '📋',
    color: '#f59e0b', // amber
    description: 'Extract file information and properties',
  },
};

// ============================================================================
// File Metadata Field Options
// ============================================================================

export interface FileMetadataFieldOption {
  value: string;
  label: string;
  category: 'basic' | 'dates';
  description: string;
}

export const FILE_METADATA_FIELD_OPTIONS: FileMetadataFieldOption[] = [
  // Basic file info
  {
    value: 'fileName',
    label: 'File Name',
    category: 'basic',
    description: 'Name without extension (e.g., "document")',
  },
  {
    value: 'fileNameWithExtension',
    label: 'File Name with Extension',
    category: 'basic',
    description: 'Full name with extension (e.g., "document.pdf")',
  },
  {
    value: 'fileExtension',
    label: 'File Extension',
    category: 'basic',
    description: 'Extension with dot (e.g., ".pdf") - prevents automatic extension',
  },
  {
    value: 'fileSize',
    label: 'File Size',
    category: 'basic',
    description: 'Formatted size (e.g., "2.4 MB")',
  },
  {
    value: 'filePath',
    label: 'File Path',
    category: 'basic',
    description: 'Directory path without filename (e.g., "/Users/name/Documents")',
  },
  // Date information
  {
    value: 'fileCreatedDate',
    label: 'Created Date',
    category: 'dates',
    description: 'File creation date',
  },
  {
    value: 'fileModifiedDate',
    label: 'Modified Date',
    category: 'dates',
    description: 'Last modified date',
  },
  {
    value: 'fileAccessedDate',
    label: 'Accessed Date',
    category: 'dates',
    description: 'Last access date',
  },
];

// ============================================================================
// Date Format Options
// ============================================================================

export interface DateFormatOption {
  value: string;
  label: string;
  example: string;
  description?: string;
}

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  {
    value: 'YYYYMMDD',
    label: 'YYYYMMDD',
    example: '20251025',
    description: 'Compact numeric format',
  },
  {
    value: 'YYYY-MM-DD',
    label: 'YYYY-MM-DD',
    example: '2025-10-25',
    description: 'ISO 8601 date format',
  },
  {
    value: 'DD-MM-YYYY',
    label: 'DD-MM-YYYY',
    example: '25-10-2025',
    description: 'European date format',
  },
  {
    value: 'MM-DD-YYYY',
    label: 'MM-DD-YYYY',
    example: '10-25-2025',
    description: 'US date format',
  },
  {
    value: 'YYYYMM',
    label: 'YYYYMM',
    example: '202510',
    description: 'Year and month only',
  },
  {
    value: 'YYYY-MM',
    label: 'YYYY-MM',
    example: '2025-10',
    description: 'Year and month with separator',
  },
  {
    value: 'MMM-YYYY',
    label: 'MMM-YYYY',
    example: 'Oct-2025',
    description: 'Short month name and year',
  },
  {
    value: 'MMMM-YYYY',
    label: 'MMMM-YYYY',
    example: 'October-2025',
    description: 'Full month name and year',
  },
];

// ============================================================================
// Number Format Options
// ============================================================================

export interface NumberPaddingOption {
  value: number;
  label: string;
  example: string;
}

export const NUMBER_PADDING_OPTIONS: NumberPaddingOption[] = [
  { value: 1, label: '1 digit', example: '1, 2, 3...' },
  { value: 2, label: '2 digits', example: '01, 02, 03...' },
  { value: 3, label: '3 digits', example: '001, 002, 003...' },
  { value: 4, label: '4 digits', example: '0001, 0002, 0003...' },
];

export const COMMON_NUMBER_PREFIXES = [
  { value: '', label: 'None' },
  { value: 'v', label: 'v (version)' },
  { value: '#', label: '# (number)' },
  { value: 'r', label: 'r (revision)' },
  { value: 'n', label: 'n (number)' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get component type metadata by type
 */
export function getComponentTypeMetadata(type: ComponentType): ComponentTypeMetadata {
  return COMPONENT_TYPE_METADATA[type];
}

/**
 * Get all component types
 */
export function getAllComponentTypes(): ComponentType[] {
  return Object.keys(COMPONENT_TYPE_METADATA) as ComponentType[];
}

/**
 * Get default icon for component type
 */
export function getDefaultIconForType(type: ComponentType): string {
  return COMPONENT_TYPE_METADATA[type].icon;
}

/**
 * Get default color for component type
 */
export function getDefaultColorForType(type: ComponentType): string {
  return COMPONENT_TYPE_METADATA[type].color;
}
