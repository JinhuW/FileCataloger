import {
  NamingPlugin,
  PluginContext,
  PluginValidationResult,
  PluginUtils,
} from '@shared/types/plugins';

// Counter state management for batch processing
interface CounterState {
  current: number;
  lastResetValue?: string;
}

const counterStates = new Map<string, CounterState>();

// Counter plugin render function with full TypeScript support
const renderCounterComponent = async (context: PluginContext): Promise<string> => {
  const { config, runtime, utils, logger } = context;

  try {
    const stateKey = `${config.resetOn}_${runtime.timestamp}`;
    let state = counterStates.get(stateKey);

    if (!state) {
      state = { current: config.start };
      counterStates.set(stateKey, state);
    }

    // Check if we need to reset
    const shouldReset = checkResetCondition(context, state);
    if (shouldReset) {
      state.current = config.start;
      state.lastResetValue = getResetValue(context);
    }

    const current = state.current;
    state.current += config.step;

    // Format the number
    const paddedNumber = utils.string.padStart(String(current), config.padding, '0');

    return config.prefix + paddedNumber + config.suffix;
  } catch (error) {
    logger.error('Error in counter plugin:', error);
    return '001'; // Safe fallback
  }
};

// Batch processing function with proper state management
const renderCounterBatch = async (contexts: PluginContext[]): Promise<string[]> => {
  if (!contexts || contexts.length === 0) return [];

  const { config } = contexts[0];
  let counter = config.start;
  let lastResetValue: string | undefined = undefined;

  return contexts.map((context, index) => {
    try {
      // Check if we need to reset based on resetOn configuration
      const currentResetValue = getResetValue(context);

      if (config.resetOn === 'folder' && currentResetValue !== lastResetValue) {
        counter = config.start;
        lastResetValue = currentResetValue;
      } else if (config.resetOn === 'daily') {
        const currentDate = new Date().toDateString();
        if (lastResetValue !== currentDate) {
          counter = config.start;
          lastResetValue = currentDate;
        }
      } else if (config.resetOn === 'pattern' && index === 0) {
        // Reset for each new batch (pattern execution)
        counter = config.start;
      }

      const current = counter;
      counter += config.step;

      const paddedNumber = context.utils.string.padStart(String(current), config.padding, '0');

      return config.prefix + paddedNumber + config.suffix;
    } catch (error) {
      context.logger.error('Error in counter batch processing:', error);
      return '001'; // Safe fallback
    }
  });
};

// Helper function to determine if counter should reset
function checkResetCondition(context: PluginContext, state: CounterState): boolean {
  const { config } = context;

  switch (config.resetOn) {
    case 'folder':
      const currentFolder = context.file.path.split('/').slice(0, -1).join('/');
      return state.lastResetValue !== currentFolder;

    case 'daily':
      const currentDate = new Date().toDateString();
      return state.lastResetValue !== currentDate;

    case 'pattern':
      // Reset for each new execution (not tracked across calls)
      return context.runtime.index === 0;

    case 'never':
    default:
      return false;
  }
}

// Helper function to get the value used for reset comparison
function getResetValue(context: PluginContext): string {
  const { config } = context;

  switch (config.resetOn) {
    case 'folder':
      return context.file.path.split('/').slice(0, -1).join('/');

    case 'daily':
      return new Date().toDateString();

    case 'pattern':
      return String(context.runtime.timestamp);

    default:
      return 'never';
  }
}

// Counter plugin preview function
const previewCounterComponent = (config: Record<string, any>, utils: PluginUtils): string => {
  const number = utils.string.padStart(String(config.start), config.padding, '0');
  return config.prefix + number + config.suffix;
};

// Counter plugin validation with comprehensive checks
const validateCounterComponent = (config: Record<string, any>): PluginValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate start value
  if (config.start !== undefined && !Number.isInteger(config.start)) {
    errors.push('Start value must be an integer');
  }

  // Validate step value
  if (config.step !== undefined && (!Number.isInteger(config.step) || config.step === 0)) {
    errors.push('Step value must be a non-zero integer');
  }

  // Validate padding
  if (config.padding !== undefined && (!Number.isInteger(config.padding) || config.padding < 0)) {
    errors.push('Padding must be a non-negative integer');
  }

  // Validate resetOn option
  const validResetOptions = ['never', 'daily', 'folder', 'pattern'];
  if (config.resetOn && !validResetOptions.includes(config.resetOn)) {
    errors.push('Invalid reset option');
  }

  // Validate prefix and suffix
  if (config.prefix && typeof config.prefix !== 'string') {
    errors.push('Prefix must be a string');
  }

  if (config.suffix && typeof config.suffix !== 'string') {
    errors.push('Suffix must be a string');
  }

  // Warnings for potential issues
  if (config.step < 0) {
    warnings.push('Negative step will cause counter to decrease');
  }

  if (config.padding > 10) {
    warnings.push('Very large padding may result in excessively long filenames');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

// Enhanced counter plugin with proper TypeScript functions
export const counterPlugin: NamingPlugin = {
  id: 'builtin-counter',
  name: 'Sequential Counter',
  version: '2.0.0',
  author: {
    name: 'FileCataloger Team',
    email: 'support@filecataloger.dev',
  },
  description:
    'Adds sequential numbers to file names with customizable formatting, reset options, and full TypeScript support',
  type: 'component',
  engine: {
    filecataloger: '>=1.0.0',
  },
  capabilities: [],
  permissions: [],

  component: {
    // Proper TypeScript function with state management
    render: renderCounterComponent,

    // Batch processing function with proper state handling
    renderBatch: renderCounterBatch,

    // Preview function with type safety
    preview: previewCounterComponent,

    // Validation function with comprehensive checks
    validate: validateCounterComponent,

    // Cleanup function to clear state when needed
    cleanup: async (config: Record<string, any>) => {
      // Clear any state for this counter configuration
      counterStates.clear();
      console.debug('Counter plugin state cleared');
    },
  },

  configSchema: {
    type: 'object',
    properties: {
      start: {
        type: 'number',
        default: 1,
        title: 'Start Number',
        description: 'The starting number for the counter',
      },
      step: {
        type: 'number',
        default: 1,
        title: 'Step Size',
        description: 'The increment step for each file',
      },
      padding: {
        type: 'number',
        minimum: 0,
        default: 3,
        title: 'Padding',
        description: 'Minimum number of digits (pad with zeros)',
      },
      prefix: {
        type: 'string',
        default: '',
        title: 'Prefix',
        description: 'Text to add before the number',
      },
      suffix: {
        type: 'string',
        default: '',
        title: 'Suffix',
        description: 'Text to add after the number',
      },
      resetOn: {
        type: 'string',
        enum: ['never', 'daily', 'folder', 'pattern'],
        default: 'never',
        title: 'Reset Counter',
        description: 'When to reset the counter back to start value',
      },
    },
    required: ['start', 'step', 'padding'],
    additionalProperties: false,
  },

  defaultConfig: {
    start: 1,
    step: 1,
    padding: 3,
    prefix: '',
    suffix: '',
    resetOn: 'never',
  },

  category: 'numbering',
  tags: ['counter', 'sequence', 'numbering', 'batch'],
};
