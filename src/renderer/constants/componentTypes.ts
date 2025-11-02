/**
 * Component Type Constants and Metadata
 *
 * Defines metadata, configuration options, and validation rules
 * for the meta-component system.
 */

import type { ComponentType } from '../../shared/types/componentDefinition';

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
};

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
// Component Limits and Validation
// ============================================================================

export const COMPONENT_LIMITS = {
  MAX_COMPONENTS_PER_LIBRARY: 100,
  MAX_OPTIONS_PER_SELECT: 50,
  MAX_COMPONENT_NAME_LENGTH: 50,
  MIN_COMPONENT_NAME_LENGTH: 1,
  MAX_TEXT_LENGTH: 200,
  MAX_OPTION_LABEL_LENGTH: 30,
  MAX_PREFIX_LENGTH: 5,
  MIN_START_NUMBER: 0,
  MAX_START_NUMBER: 99999,
  MIN_INCREMENT_STEP: 1,
  MAX_INCREMENT_STEP: 100,
};

export const COMPONENT_VALIDATION_RULES = {
  NAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/, // Alphanumeric, spaces, hyphens, underscores
  OPTION_LABEL_PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
  PREFIX_PATTERN: /^[a-zA-Z0-9\-_#]*$/,
  INVALID_NAME_CHARS: /[^a-zA-Z0-9\s\-_]/g,
};

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

// ============================================================================
// Option Colors (for Select components)
// ============================================================================

export const OPTION_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
];

// ============================================================================
// Component Icons (User Selection)
// ============================================================================

export const COMPONENT_ICONS = [
  // Folders & Files
  '📁',
  '📊',
  '📈',
  '📉',
  '💼',
  '🏢',
  '🏭',
  '🏗️',
  '🏪',
  '🏫',
  // People
  '👤',
  '👥',
  '👨‍💼',
  '👩‍💼',
  // Communication
  '📧',
  '📞',
  // Locations
  '🌍',
  '🌎',
  '🌏',
  // Creative
  '📸',
  '🎨',
  '🎬',
  '🎵',
  '🎮',
  // Tech
  '💻',
  '⚙️',
  '🔧',
  '🔨',
  // Status
  '✅',
  '❌',
  '⚠️',
  'ℹ️',
  // Misc
  '🚀',
  '⭐',
  '💡',
  '🔒',
  '📝',
  '🎯',
  '📅',
  '🔢',
  '🏷️',
  '📋',
  '📌',
  '🔖',
  '🗂️',
  '📦',
  '🎁',
];

// ============================================================================
// Validation Messages
// ============================================================================

export const VALIDATION_MESSAGES = {
  COMPONENT_NAME_REQUIRED: 'Component name is required',
  COMPONENT_NAME_TOO_SHORT: `Component name must be at least ${COMPONENT_LIMITS.MIN_COMPONENT_NAME_LENGTH} character`,
  COMPONENT_NAME_TOO_LONG: `Component name must be less than ${COMPONENT_LIMITS.MAX_COMPONENT_NAME_LENGTH} characters`,
  COMPONENT_NAME_INVALID_CHARS:
    'Component name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores',
  COMPONENT_NAME_DUPLICATE: 'A component with this name already exists',
  OPTION_LABEL_REQUIRED: 'Option label is required',
  OPTION_LABEL_TOO_LONG: `Option label must be less than ${COMPONENT_LIMITS.MAX_OPTION_LABEL_LENGTH} characters`,
  OPTION_LABEL_INVALID_CHARS: 'Option label contains invalid characters',
  MAX_COMPONENTS_REACHED: `You have reached the maximum number of components (${COMPONENT_LIMITS.MAX_COMPONENTS_PER_LIBRARY})`,
  MAX_OPTIONS_REACHED: `You have reached the maximum number of options (${COMPONENT_LIMITS.MAX_OPTIONS_PER_SELECT})`,
  PREFIX_TOO_LONG: `Prefix must be less than ${COMPONENT_LIMITS.MAX_PREFIX_LENGTH} characters`,
  PREFIX_INVALID_CHARS: 'Prefix contains invalid characters',
  START_NUMBER_INVALID: `Start number must be between ${COMPONENT_LIMITS.MIN_START_NUMBER} and ${COMPONENT_LIMITS.MAX_START_NUMBER}`,
  INCREMENT_STEP_INVALID: `Increment step must be between ${COMPONENT_LIMITS.MIN_INCREMENT_STEP} and ${COMPONENT_LIMITS.MAX_INCREMENT_STEP}`,
};

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
 * Validate component name
 */
export function validateComponentName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: VALIDATION_MESSAGES.COMPONENT_NAME_REQUIRED };
  }

  if (name.length < COMPONENT_LIMITS.MIN_COMPONENT_NAME_LENGTH) {
    return { isValid: false, error: VALIDATION_MESSAGES.COMPONENT_NAME_TOO_SHORT };
  }

  if (name.length > COMPONENT_LIMITS.MAX_COMPONENT_NAME_LENGTH) {
    return { isValid: false, error: VALIDATION_MESSAGES.COMPONENT_NAME_TOO_LONG };
  }

  if (!COMPONENT_VALIDATION_RULES.NAME_PATTERN.test(name)) {
    return { isValid: false, error: VALIDATION_MESSAGES.COMPONENT_NAME_INVALID_CHARS };
  }

  return { isValid: true };
}

/**
 * Sanitize component name (remove invalid characters)
 */
export function sanitizeComponentName(name: string): string {
  return name.replace(COMPONENT_VALIDATION_RULES.INVALID_NAME_CHARS, '');
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
