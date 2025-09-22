import {
  NamingPlugin,
  PluginContext,
  PluginValidationResult,
  PluginUtils,
} from '@shared/types/plugins';

// Date plugin render function with full TypeScript support
const renderDateComponent = async (context: PluginContext): Promise<string> => {
  const { file, config, utils } = context;
  let date: Date;

  switch (config.dateType) {
    case 'file-created':
      date = new Date(file.created);
      break;
    case 'file-modified':
      date = new Date(file.modified);
      break;
    case 'file-accessed':
      date = new Date(file.accessed);
      break;
    default:
      date = new Date();
  }

  return utils.format.date(date, config.format);
};

// Date plugin preview function
const previewDateComponent = (config: Record<string, any>, utils: PluginUtils): string => {
  const date = new Date();
  return utils.format.date(date, config.format);
};

// Date plugin validation function
const validateDateComponent = (config: Record<string, any>): PluginValidationResult => {
  const errors: string[] = [];

  if (!config.format) {
    errors.push('Date format is required');
  }

  const validDateTypes = ['current', 'file-created', 'file-modified', 'file-accessed'];
  if (config.dateType && !validDateTypes.includes(config.dateType)) {
    errors.push('Invalid date type');
  }

  // Validate date format pattern
  if (config.format && typeof config.format !== 'string') {
    errors.push('Date format must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
};

// Enhanced date plugin with proper TypeScript functions
export const datePlugin: NamingPlugin = {
  id: 'builtin-date',
  name: 'Date & Time',
  version: '2.0.0',
  author: {
    name: 'FileCataloger Team',
    email: 'support@filecataloger.dev',
  },
  description:
    'Adds date and time information to file names with flexible formatting options and full TypeScript support',
  type: 'component',
  engine: {
    filecataloger: '>=2.0.0',
  },
  capabilities: [],
  permissions: [],

  component: {
    // Proper TypeScript function - no strings!
    render: renderDateComponent,

    // Preview function with type safety
    preview: previewDateComponent,

    // Validation function with proper error handling
    validate: validateDateComponent,

    // Setup function (optional)
    setup: async (config: Record<string, any>) => {
      // Perform any initialization if needed
      console.debug('Date plugin setup with config:', config);
    },

    // Cleanup function (optional)
    cleanup: async (config: Record<string, any>) => {
      // Perform any cleanup if needed
      console.debug('Date plugin cleanup with config:', config);
    },
  },

  configSchema: {
    type: 'object',
    properties: {
      dateType: {
        type: 'string',
        enum: ['current', 'file-created', 'file-modified', 'file-accessed'],
        default: 'current',
        title: 'Date Source',
        description: 'Which date to use for the filename',
      },
      format: {
        type: 'string',
        default: 'YYYYMMDD',
        title: 'Date Format',
        description:
          'Date format pattern (YYYY=year, MM=month, DD=day, HH=hour, mm=minute, ss=second)',
        examples: ['YYYYMMDD', 'YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY-MM-DD_HH-mm-ss', 'MMM DD, YYYY'],
      },
      timezone: {
        type: 'string',
        default: 'local',
        title: 'Timezone',
        description: 'Timezone for date formatting',
        enum: ['local', 'UTC'],
      },
      locale: {
        type: 'string',
        default: 'en-US',
        title: 'Locale',
        description: 'Locale for date formatting',
        examples: ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'ja-JP'],
      },
    },
    required: ['format'],
    additionalProperties: false,
  },

  defaultConfig: {
    dateType: 'current',
    format: 'YYYYMMDD',
    timezone: 'local',
    locale: 'en-US',
  },

  // Lifecycle hooks with proper functions
  lifecycle: {
    onActivate: async () => {
      console.log('Date plugin activated');
    },
    onDeactivate: async () => {
      console.log('Date plugin deactivated');
    },
    onError: async (error: Error) => {
      console.error('Date plugin error:', error);
    },
  },

  category: 'date-time',
  tags: ['date', 'time', 'timestamp', 'file-info'],
};
