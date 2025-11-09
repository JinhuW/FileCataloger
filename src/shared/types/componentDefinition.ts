/**
 * Component Definition Types
 *
 * This file defines the core types for the meta-component system,
 * where users create custom components from basic building block types.
 */

// ============================================================================
// Component Type Enums
// ============================================================================

export type ComponentType = 'text' | 'select' | 'date' | 'number' | 'fileMetadata';
export type ComponentScope = 'global' | 'local';
export type DateSource = 'current' | 'file-created' | 'file-modified' | 'custom';
export type NumberFormat = 'plain' | 'padded';

// File Metadata Field Types
export type FileMetadataField =
  // Basic file info
  | 'fileName' // Name without extension
  | 'fileNameWithExtension' // Full name with extension
  | 'fileExtension' // Extension only
  | 'fileSize' // Formatted size
  | 'filePath' // Full file path
  // Date information
  | 'fileCreatedDate' // File creation date
  | 'fileModifiedDate' // Last modified date
  | 'fileAccessedDate'; // Last access date

// ============================================================================
// Select Component Types
// ============================================================================

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

// ============================================================================
// Component Configuration Types (Type-Specific)
// ============================================================================

export interface TextConfig {
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}

export interface SelectConfig {
  options: SelectOption[];
  allowInlineCreate?: boolean;
  defaultOption?: string;
}

export interface DateConfig {
  dateFormat: string;
  dateSource: DateSource;
  customDate?: number; // timestamp for custom date
}

export interface NumberConfig {
  numberFormat: NumberFormat;
  padding?: number; // 1, 2, 3, 4 digits
  prefix?: string; // 'v', '#', 'r', etc.
  autoIncrement: boolean;
  startNumber?: number;
  incrementStep?: number;
}

export interface FileMetadataConfig {
  selectedField: FileMetadataField;
  dateFormat?: string; // For date fields
  fallbackValue?: string; // Value to use when metadata is unavailable
}

// ============================================================================
// Component Configuration Union Type
// ============================================================================

export type ComponentConfig =
  | { type: 'text'; config: TextConfig }
  | { type: 'select'; config: SelectConfig }
  | { type: 'date'; config: DateConfig }
  | { type: 'number'; config: NumberConfig }
  | { type: 'fileMetadata'; config: FileMetadataConfig };

// ============================================================================
// Component Definition (The Schema)
// ============================================================================

export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string; // Optional description for tooltip/help
  type: ComponentType;
  icon: string;
  color?: string;
  scope: ComponentScope;

  // Type-specific configuration
  config: TextConfig | SelectConfig | DateConfig | NumberConfig | FileMetadataConfig;

  // Metadata
  metadata: {
    createdAt: number;
    updatedAt: number;
    usageCount: number;
    lastUsed?: number;
    isTemplate?: boolean;
    favorite?: boolean;
  };
}

// ============================================================================
// Component Instance (Used in Patterns)
// ============================================================================

export interface ComponentInstance {
  id: string; // Instance UUID
  definitionId: string; // Links to ComponentDefinition
  name: string; // Display name (cached from definition)
  type: ComponentType; // Cached from definition
  value?: unknown; // Current value for this instance
  overrides?: Partial<TextConfig | SelectConfig | DateConfig | NumberConfig | FileMetadataConfig>; // Pattern-specific overrides
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTextComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'text'; config: TextConfig } {
  return component.type === 'text';
}

export function isSelectComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'select'; config: SelectConfig } {
  return component.type === 'select';
}

export function isDateComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'date'; config: DateConfig } {
  return component.type === 'date';
}

export function isNumberComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'number'; config: NumberConfig } {
  return component.type === 'number';
}

export function isFileMetadataComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'fileMetadata'; config: FileMetadataConfig } {
  return component.type === 'fileMetadata';
}

// ============================================================================
// Helper Types
// ============================================================================

export interface ComponentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ResolvedComponent {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  effectiveConfig: TextConfig | SelectConfig | DateConfig | NumberConfig | FileMetadataConfig;
}

// ============================================================================
// Legacy Component Types (for migration)
// ============================================================================

export interface LegacyRenameComponent {
  id: string;
  type: 'date' | 'fileName' | 'counter' | 'text' | 'project';
  value?: string;
  format?: string;
  placeholder?: string;
}
