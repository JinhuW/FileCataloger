/**
 * Component Value Resolver
 *
 * Resolves component instance values to strings for file naming.
 * Handles all component types: Text, Select, Date, Number
 */

import type {
  ComponentInstance,
  ComponentDefinition,
  TextConfig,
  SelectConfig,
  DateConfig,
  NumberConfig,
} from '../../shared/types/componentDefinition';
import {
  isTextComponent,
  isSelectComponent,
  isDateComponent,
  isNumberComponent,
} from '../../shared/types/componentDefinition';

// ============================================================================
// Resolution Context
// ============================================================================

export interface ComponentResolutionContext {
  fileIndex?: number; // For auto-increment counters
  fileName?: string; // Original file name
  fileCreatedDate?: number; // File creation timestamp
  fileModifiedDate?: number; // File modification timestamp
  batchSize?: number; // Total number of files in batch
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve component instance to a string value for file naming
 */
export function resolveComponentValue(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  context: ComponentResolutionContext = {}
): string {
  // Merge instance overrides with definition config
  const effectiveConfig = instance.overrides
    ? { ...definition.config, ...instance.overrides }
    : definition.config;

  // Resolve based on component type
  if (isTextComponent(definition)) {
    return resolveTextValue(instance, effectiveConfig as TextConfig);
  }

  if (isSelectComponent(definition)) {
    return resolveSelectValue(instance, effectiveConfig as SelectConfig);
  }

  if (isDateComponent(definition)) {
    return resolveDateValue(instance, effectiveConfig as DateConfig, context);
  }

  if (isNumberComponent(definition)) {
    return resolveNumberValue(instance, effectiveConfig as NumberConfig, context);
  }

  // Fallback (should never happen with proper typing)
  return '';
}

// ============================================================================
// Type-Specific Resolvers
// ============================================================================

/**
 * Resolve TEXT component value
 */
function resolveTextValue(instance: ComponentInstance, config: TextConfig): string {
  // Use instance value if set, otherwise use default from config
  const value = instance.value !== undefined ? instance.value : config.defaultValue || '';

  // Apply max length if configured
  if (config.maxLength && value.length > config.maxLength) {
    return value.substring(0, config.maxLength);
  }

  return value;
}

/**
 * Resolve SELECT component value
 */
function resolveSelectValue(instance: ComponentInstance, config: SelectConfig): string {
  // Get selected option ID from instance value or default
  const selectedId = instance.value || config.defaultOption;

  if (!selectedId) {
    return ''; // No selection
  }

  // Find option by ID
  const option = config.options.find(o => o.id === selectedId);

  return option ? option.label : '';
}

/**
 * Resolve DATE component value
 */
function resolveDateValue(
  instance: ComponentInstance,
  config: DateConfig,
  context: ComponentResolutionContext
): string {
  // Determine which date to use
  let timestamp: number;

  switch (config.dateSource) {
    case 'current':
      timestamp = Date.now();
      break;
    case 'file-created':
      timestamp = context.fileCreatedDate || Date.now();
      break;
    case 'file-modified':
      timestamp = context.fileModifiedDate || Date.now();
      break;
    case 'custom':
      timestamp = config.customDate || instance.value || Date.now();
      break;
    default:
      timestamp = Date.now();
  }

  // Format date according to config
  return formatDate(timestamp, config.dateFormat);
}

/**
 * Resolve NUMBER component value
 */
function resolveNumberValue(
  instance: ComponentInstance,
  config: NumberConfig,
  context: ComponentResolutionContext
): string {
  let number: number;

  if (config.autoIncrement) {
    // Use file index from context for auto-increment
    const startNumber = config.startNumber !== undefined ? config.startNumber : 1;
    const step = config.incrementStep !== undefined ? config.incrementStep : 1;
    const index = context.fileIndex !== undefined ? context.fileIndex : 0;
    number = startNumber + index * step;
  } else {
    // Use instance value or start number
    number =
      instance.value !== undefined
        ? instance.value
        : config.startNumber !== undefined
          ? config.startNumber
          : 0;
  }

  // Format number
  let formatted: string;

  if (config.numberFormat === 'padded' && config.padding) {
    // Pad with zeros
    formatted = number.toString().padStart(config.padding, '0');
  } else {
    formatted = number.toString();
  }

  // Add prefix if configured
  if (config.prefix) {
    formatted = config.prefix + formatted;
  }

  return formatted;
}

// ============================================================================
// Date Formatting Helper
// ============================================================================

/**
 * Format timestamp to date string
 */
function formatDate(timestamp: number, format: string): string {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-indexed
  const day = date.getDate();

  // Month names
  const monthNamesShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthNamesFull = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Pad with zeros
  const MM = month.toString().padStart(2, '0');
  const DD = day.toString().padStart(2, '0');
  const YYYY = year.toString();

  switch (format) {
    case 'YYYYMMDD':
      return `${YYYY}${MM}${DD}`;
    case 'YYYY-MM-DD':
      return `${YYYY}-${MM}-${DD}`;
    case 'DD-MM-YYYY':
      return `${DD}-${MM}-${YYYY}`;
    case 'MM-DD-YYYY':
      return `${MM}-${DD}-${YYYY}`;
    case 'YYYYMM':
      return `${YYYY}${MM}`;
    case 'YYYY-MM':
      return `${YYYY}-${MM}`;
    case 'MMM-YYYY':
      return `${monthNamesShort[month - 1]}-${YYYY}`;
    case 'MMMM-YYYY':
      return `${monthNamesFull[month - 1]}-${YYYY}`;
    default:
      // Default to YYYYMMDD
      return `${YYYY}${MM}${DD}`;
  }
}

// ============================================================================
// Batch Resolution Helper
// ============================================================================

/**
 * Resolve component values for a batch of files
 */
export function resolveComponentValuesForBatch(
  instances: ComponentInstance[],
  definitions: Map<string, ComponentDefinition>,
  contexts: ComponentResolutionContext[]
): string[][] {
  return contexts.map(context => {
    return instances.map(instance => {
      const definition = definitions.get(instance.definitionId);
      if (!definition) {
        return ''; // Definition not found
      }
      return resolveComponentValue(instance, definition, context);
    });
  });
}

/**
 * Build file name from resolved component values
 */
export function buildFileNameFromComponents(
  componentValues: string[],
  separator: string = '_',
  extension?: string
): string {
  // Filter out empty values
  const nonEmptyValues = componentValues.filter(v => v !== '');

  // Join with separator
  const baseName = nonEmptyValues.join(separator);

  // Add extension if provided
  if (extension) {
    return `${baseName}.${extension}`;
  }

  return baseName;
}

/**
 * Create resolution context from file metadata
 */
export function createResolutionContext(
  fileName: string,
  fileIndex: number,
  batchSize: number,
  stats?: { birthtime?: Date; mtime?: Date }
): ComponentResolutionContext {
  return {
    fileIndex,
    fileName,
    fileCreatedDate: stats?.birthtime?.getTime(),
    fileModifiedDate: stats?.mtime?.getTime(),
    batchSize,
  };
}
