/**
 * Component Type Constants and Metadata
 *
 * Re-exports all component type related constants from modular files.
 * This file maintains backward compatibility for existing imports.
 */

// Metadata and field options
export {
  COMPONENT_TYPE_METADATA,
  FILE_METADATA_FIELD_OPTIONS,
  DATE_FORMAT_OPTIONS,
  NUMBER_PADDING_OPTIONS,
  COMMON_NUMBER_PREFIXES,
  getComponentTypeMetadata,
  getAllComponentTypes,
  getDefaultIconForType,
  getDefaultColorForType,
} from './componentMetadata';
export type {
  ComponentTypeMetadata,
  FileMetadataFieldOption,
  DateFormatOption,
  NumberPaddingOption,
} from './componentMetadata';

// Validation and limits
export {
  COMPONENT_LIMITS,
  COMPONENT_VALIDATION_RULES,
  VALIDATION_MESSAGES,
  validateComponentName,
  sanitizeComponentName,
} from './componentValidation';

// Default configurations
export {
  DEFAULT_TEXT_CONFIG,
  DEFAULT_SELECT_CONFIG,
  DEFAULT_DATE_CONFIG,
  DEFAULT_NUMBER_CONFIG,
  DEFAULT_FILE_METADATA_CONFIG,
} from './componentDefaults';
