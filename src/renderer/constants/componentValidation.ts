/**
 * Component Validation Rules and Messages
 *
 * Limits, validation rules, and error messages for component validation.
 */

// ============================================================================
// Component Limits
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

// ============================================================================
// Validation Rules
// ============================================================================

export const COMPONENT_VALIDATION_RULES = {
  NAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/, // Alphanumeric, spaces, hyphens, underscores
  OPTION_LABEL_PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
  PREFIX_PATTERN: /^[a-zA-Z0-9\-_#]*$/,
  INVALID_NAME_CHARS: /[^a-zA-Z0-9\s\-_]/g,
};

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
// Validation Helper Functions
// ============================================================================

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
