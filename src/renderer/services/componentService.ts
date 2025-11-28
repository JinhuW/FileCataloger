/**
 * Component Service
 *
 * Business logic layer for component management in the meta-component system.
 * Handles component creation, validation, cloning, and resolution.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ComponentDefinition,
  ComponentInstance,
  ComponentType,
  ComponentValidationResult,
  ResolvedComponent,
  TextConfig,
  SelectConfig,
  DateConfig,
  NumberConfig,
} from '../../shared/types/componentDefinition';
import {
  validateComponentName,
  getDefaultIconForType,
  getDefaultColorForType,
  DEFAULT_TEXT_CONFIG,
  DEFAULT_SELECT_CONFIG,
  DEFAULT_DATE_CONFIG,
  DEFAULT_NUMBER_CONFIG,
  COMPONENT_LIMITS,
  VALIDATION_MESSAGES,
} from '../constants/componentTypes';

// ============================================================================
// Component Service Class
// ============================================================================

export class ComponentService {
  /**
   * Create a new component definition
   */
  static createComponent(
    type: ComponentType,
    name: string,
    config?: Partial<TextConfig | SelectConfig | DateConfig | NumberConfig>
  ): ComponentDefinition {
    const now = Date.now();

    // Get default config based on type
    let defaultConfig: TextConfig | SelectConfig | DateConfig | NumberConfig;
    switch (type) {
      case 'text':
        defaultConfig = { ...DEFAULT_TEXT_CONFIG, ...config } as TextConfig;
        break;
      case 'select':
        defaultConfig = { ...DEFAULT_SELECT_CONFIG, ...config } as SelectConfig;
        break;
      case 'date':
        defaultConfig = { ...DEFAULT_DATE_CONFIG, ...config } as DateConfig;
        break;
      case 'number':
        defaultConfig = { ...DEFAULT_NUMBER_CONFIG, ...config } as NumberConfig;
        break;
    }

    return {
      id: uuidv4(),
      name: name.trim(),
      type,
      icon: getDefaultIconForType(type),
      color: getDefaultColorForType(type),
      scope: 'global',
      config: defaultConfig,
      metadata: {
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        isTemplate: false,
        favorite: false,
      },
    };
  }

  /**
   * Validate a component definition
   */
  static validateComponent(
    definition: ComponentDefinition,
    existingComponents: ComponentDefinition[] = []
  ): ComponentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    const nameValidation = validateComponentName(definition.name);
    if (!nameValidation.isValid && nameValidation.error) {
      errors.push(nameValidation.error);
    }

    // Check for duplicate names
    const duplicate = existingComponents.find(
      c => c.id !== definition.id && c.name.toLowerCase() === definition.name.toLowerCase()
    );
    if (duplicate) {
      errors.push(VALIDATION_MESSAGES.COMPONENT_NAME_DUPLICATE);
    }

    // Type-specific validation
    switch (definition.type) {
      case 'text':
        this.validateTextConfig(definition.config as TextConfig, errors, warnings);
        break;
      case 'select':
        this.validateSelectConfig(definition.config as SelectConfig, errors, warnings);
        break;
      case 'date':
        this.validateDateConfig(definition.config as DateConfig, errors, warnings);
        break;
      case 'number':
        this.validateNumberConfig(definition.config as NumberConfig, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Clone a component with a new name
   */
  static cloneComponent(definition: ComponentDefinition, newName: string): ComponentDefinition {
    const now = Date.now();

    return {
      ...definition,
      id: uuidv4(),
      name: newName.trim(),
      metadata: {
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        lastUsed: undefined,
        isTemplate: false,
        favorite: false,
      },
    };
  }

  /**
   * Resolve component instance with definition
   * Merges instance overrides with definition config
   */
  static resolveComponentInstance(
    instance: ComponentInstance,
    definition: ComponentDefinition
  ): ResolvedComponent {
    // Merge instance overrides with definition config
    const effectiveConfig = instance.overrides
      ? { ...definition.config, ...instance.overrides }
      : definition.config;

    return {
      instance,
      definition,
      effectiveConfig,
    };
  }

  // ==========================================================================
  // Private Validation Helpers
  // ==========================================================================

  private static validateTextConfig(
    config: TextConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (config.maxLength && config.maxLength > COMPONENT_LIMITS.MAX_TEXT_LENGTH) {
      warnings.push(
        `Max length (${config.maxLength}) exceeds recommended limit (${COMPONENT_LIMITS.MAX_TEXT_LENGTH})`
      );
    }

    if (config.defaultValue && config.maxLength && config.defaultValue.length > config.maxLength) {
      errors.push('Default value exceeds max length');
    }
  }

  private static validateSelectConfig(
    config: SelectConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (config.options.length === 0) {
      warnings.push('Select component has no options');
    }

    if (config.options.length > COMPONENT_LIMITS.MAX_OPTIONS_PER_SELECT) {
      errors.push(VALIDATION_MESSAGES.MAX_OPTIONS_REACHED);
    }

    // Check for duplicate option labels
    const labels = config.options.map(o => o.label.toLowerCase());
    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (duplicates.length > 0) {
      warnings.push(`Duplicate option labels found: ${duplicates.join(', ')}`);
    }

    // Validate default option exists
    if (config.defaultOption && !config.options.find(o => o.id === config.defaultOption)) {
      errors.push('Default option does not exist in options list');
    }
  }

  private static validateDateConfig(
    config: DateConfig,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate date format (basic check)
    const validFormats = [
      'YYYYMMDD',
      'YYYY-MM-DD',
      'DD-MM-YYYY',
      'MM-DD-YYYY',
      'YYYYMM',
      'YYYY-MM',
      'MMM-YYYY',
      'MMMM-YYYY',
    ];

    if (!validFormats.includes(config.dateFormat)) {
      warnings.push(`Unknown date format: ${config.dateFormat}`);
    }

    // Validate custom date if source is custom
    if (config.dateSource === 'custom' && !config.customDate) {
      errors.push('Custom date source selected but no custom date provided');
    }
  }

  private static validateNumberConfig(
    config: NumberConfig,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate padding
    if (config.padding && (config.padding < 1 || config.padding > 4)) {
      errors.push('Padding must be between 1 and 4 digits');
    }

    // Validate prefix length
    if (config.prefix && config.prefix.length > COMPONENT_LIMITS.MAX_PREFIX_LENGTH) {
      errors.push(VALIDATION_MESSAGES.PREFIX_TOO_LONG);
    }

    // Validate start number
    if (
      config.startNumber !== undefined &&
      (config.startNumber < COMPONENT_LIMITS.MIN_START_NUMBER ||
        config.startNumber > COMPONENT_LIMITS.MAX_START_NUMBER)
    ) {
      errors.push(VALIDATION_MESSAGES.START_NUMBER_INVALID);
    }

    // Validate increment step
    if (
      config.incrementStep !== undefined &&
      (config.incrementStep < COMPONENT_LIMITS.MIN_INCREMENT_STEP ||
        config.incrementStep > COMPONENT_LIMITS.MAX_INCREMENT_STEP)
    ) {
      errors.push(VALIDATION_MESSAGES.INCREMENT_STEP_INVALID);
    }

    // Warnings
    if (config.autoIncrement && !config.startNumber) {
      warnings.push('Auto-increment enabled but no start number specified (will default to 1)');
    }
  }
}

