/**
 * @file namingPatterns.ts
 * @description Constants and configuration for naming pattern functionality
 */

export const NAMING_PATTERN_LABELS = {
  HEADER: 'Naming Pattern',
  DEFAULT_PATTERN: 'Default Pattern',
  CUSTOM_PATTERN: 'Custom Pattern',
  ADD_PATTERN: 'Add New Pattern',
  MAX_PATTERNS: 20,
} as const;

export const PATTERN_COMPONENT_TYPES = {
  DATE: 'date',
  FILE_NAME: 'fileName',
  COUNTER: 'counter',
  TEXT: 'text',
  PROJECT: 'project',
} as const;

export const PATTERN_COMPONENT_LABELS = {
  [PATTERN_COMPONENT_TYPES.DATE]: 'Date',
  [PATTERN_COMPONENT_TYPES.FILE_NAME]: 'File Name',
  [PATTERN_COMPONENT_TYPES.COUNTER]: 'Counter',
  [PATTERN_COMPONENT_TYPES.TEXT]: 'Text',
  [PATTERN_COMPONENT_TYPES.PROJECT]: 'Project',
} as const;

export const PATTERN_COMPONENT_ICONS = {
  [PATTERN_COMPONENT_TYPES.DATE]: '📅',
  [PATTERN_COMPONENT_TYPES.FILE_NAME]: '📄',
  [PATTERN_COMPONENT_TYPES.COUNTER]: '🔢',
  [PATTERN_COMPONENT_TYPES.TEXT]: '💬',
  [PATTERN_COMPONENT_TYPES.PROJECT]: '📁',
} as const;

export const DATE_FORMAT_OPTIONS = {
  YYYYMMDD: 'YYYYMMDD',
  'YYYY-MM-DD': 'YYYY-MM-DD',
  'DD-MM-YYYY': 'DD-MM-YYYY',
  'MM-DD-YYYY': 'MM-DD-YYYY',
  YYYYMM: 'YYYYMM',
  'YYYY-MM': 'YYYY-MM',
} as const;

export const COUNTER_FORMAT_OPTIONS = {
  '001': { digits: 3, start: 1 },
  '01': { digits: 2, start: 1 },
  '1': { digits: 1, start: 1 },
  '0001': { digits: 4, start: 1 },
} as const;

export const MAX_COMPONENT_COUNT = 10;
export const MAX_PATTERN_NAME_LENGTH = 50;
export const MIN_PATTERN_NAME_LENGTH = 1;

export const PATTERN_VALIDATION = {
  MAX_PATTERNS: NAMING_PATTERN_LABELS.MAX_PATTERNS,
  MAX_COMPONENTS: MAX_COMPONENT_COUNT,
  NAME_LENGTH: {
    MIN: MIN_PATTERN_NAME_LENGTH,
    MAX: MAX_PATTERN_NAME_LENGTH,
  },
} as const;
