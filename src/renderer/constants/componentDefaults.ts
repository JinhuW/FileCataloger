/**
 * Component Default Configurations
 *
 * Default values and configurations for each component type.
 */

import { COMPONENT_LIMITS } from './componentValidation';

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_TEXT_CONFIG = {
  defaultValue: '',
  placeholder: 'Enter text...',
  maxLength: COMPONENT_LIMITS.MAX_TEXT_LENGTH,
};

export const DEFAULT_SELECT_CONFIG = {
  options: [],
  allowInlineCreate: true,
  defaultOption: undefined,
};

export const DEFAULT_DATE_CONFIG = {
  dateFormat: 'YYYYMMDD',
  dateSource: 'current' as const,
  customDate: undefined,
};

export const DEFAULT_NUMBER_CONFIG = {
  numberFormat: 'padded' as const,
  padding: 3,
  prefix: '',
  autoIncrement: true,
  startNumber: 1,
  incrementStep: 1,
};

export const DEFAULT_FILE_METADATA_CONFIG = {
  selectedField: 'fileName' as const,
  dateFormat: 'YYYY-MM-DD',
  fallbackValue: 'N/A',
};
