import {
  NamingPlugin,
  PluginContext,
  PluginValidationResult,
  PluginUtils,
} from '@shared/types/plugins';

// Filename plugin render function with full TypeScript support and proper error handling
const renderFilenameComponent = async (context: PluginContext): Promise<string> => {
  const { file, config, utils, logger } = context;

  try {
    let name = config.includeExtension ? file.name : file.nameWithoutExtension;

    // Apply regex if provided
    if (config.regex?.pattern) {
      try {
        const regex = new RegExp(config.regex.pattern, 'g');
        name = name.replace(regex, config.regex.replacement || '');
      } catch (error) {
        logger.warn('Invalid regex pattern:', config.regex.pattern);
        // Continue with original name if regex fails
      }
    }

    // Remove or replace spaces
    if (config.removeSpaces) {
      name = name.replace(/\s+/g, '');
    } else if (config.spaceReplacement && config.spaceReplacement !== ' ') {
      name = name.replace(/\s+/g, config.spaceReplacement);
    }

    // Apply case transformation with proper error handling
    if (config.caseTransform && config.caseTransform !== 'none') {
      switch (config.caseTransform) {
        case 'lower':
          name = name.toLowerCase();
          break;
        case 'upper':
          name = name.toUpperCase();
          break;
        case 'title':
          name = utils.string.titleCase(name);
          break;
        case 'camel':
          name = utils.string.camelCase(name);
          break;
        case 'pascal':
          name = utils.string.pascalCase(name);
          break;
        case 'kebab':
          name = utils.string.kebabCase(name);
          break;
        case 'snake':
          name = utils.string.snakeCase(name);
          break;
        default:
          logger.warn('Unknown case transform:', config.caseTransform);
      }
    }

    // Apply length limit
    if (config.maxLength && config.maxLength > 0) {
      name = utils.string.truncate(name, config.maxLength);
    }

    return name;
  } catch (error) {
    logger.error('Error in filename plugin:', error);
    // Fallback to basic filename
    return file.nameWithoutExtension;
  }
};

// Filename plugin preview function with type safety
const previewFilenameComponent = (config: Record<string, any>, utils: PluginUtils): string => {
  let name = config.includeExtension ? 'example-file.txt' : 'example-file';

  // Apply the same transformations as render (without error handling complexity)
  if (config.regex?.pattern) {
    try {
      const regex = new RegExp(config.regex.pattern, 'g');
      name = name.replace(regex, config.regex.replacement || '');
    } catch {
      // Ignore regex errors in preview
    }
  }

  if (config.removeSpaces) {
    name = name.replace(/\s+/g, '');
  } else if (config.spaceReplacement && config.spaceReplacement !== ' ') {
    name = name.replace(/\s+/g, config.spaceReplacement);
  }

  if (config.caseTransform && config.caseTransform !== 'none') {
    switch (config.caseTransform) {
      case 'lower':
        name = name.toLowerCase();
        break;
      case 'upper':
        name = name.toUpperCase();
        break;
      case 'title':
        name = utils.string.titleCase(name);
        break;
      case 'camel':
        name = utils.string.camelCase(name);
        break;
      case 'pascal':
        name = utils.string.pascalCase(name);
        break;
      case 'kebab':
        name = utils.string.kebabCase(name);
        break;
      case 'snake':
        name = utils.string.snakeCase(name);
        break;
    }
  }

  if (config.maxLength && config.maxLength > 0) {
    name = utils.string.truncate(name, config.maxLength);
  }

  return name;
};

// Filename plugin validation with comprehensive checks
const validateFilenameComponent = (config: Record<string, any>): PluginValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate maxLength
  if (config.maxLength !== undefined) {
    if (
      typeof config.maxLength !== 'number' ||
      config.maxLength < 0 ||
      !Number.isInteger(config.maxLength)
    ) {
      errors.push('Maximum length must be a positive integer');
    }
  }

  // Validate regex pattern
  if (config.regex?.pattern) {
    try {
      new RegExp(config.regex.pattern);
    } catch (error) {
      errors.push('Invalid regular expression pattern');
    }
  }

  // Validate case transform
  const validCaseTransforms = [
    'none',
    'lower',
    'upper',
    'title',
    'camel',
    'pascal',
    'kebab',
    'snake',
  ];
  if (config.caseTransform && !validCaseTransforms.includes(config.caseTransform)) {
    errors.push('Invalid case transform option');
  }

  // Validate space replacement
  if (config.spaceReplacement && typeof config.spaceReplacement !== 'string') {
    errors.push('Space replacement must be a string');
  }

  // Warnings for potential issues
  if (config.removeSpaces && config.spaceReplacement) {
    warnings.push('Space replacement is ignored when removeSpaces is true');
  }

  if (config.maxLength && config.maxLength < 3) {
    warnings.push('Very short max length may result in non-unique filenames');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

// Enhanced filename plugin with proper TypeScript functions
export const filenamePlugin: NamingPlugin = {
  id: 'builtin-filename',
  name: 'File Name',
  version: '2.0.0',
  author: {
    name: 'FileCataloger Team',
    email: 'support@filecataloger.dev',
  },
  description:
    'Uses the original file name with various transformation options and full TypeScript support',
  type: 'component',
  engine: {
    filecataloger: '>=1.0.0',
  },
  capabilities: [],
  permissions: [],

  component: {
    // Proper TypeScript function with full type safety
    render: renderFilenameComponent,

    // Preview function with type safety
    preview: previewFilenameComponent,

    // Validation function with comprehensive checks
    validate: validateFilenameComponent,
  },

  configSchema: {
    type: 'object',
    properties: {
      includeExtension: {
        type: 'boolean',
        default: false,
        title: 'Include Extension',
        description: 'Include the file extension in the name',
      },
      caseTransform: {
        type: 'string',
        enum: ['none', 'lower', 'upper', 'title', 'camel', 'pascal', 'kebab', 'snake'],
        default: 'none',
        title: 'Case Transform',
        description: 'Transform the case of the filename',
      },
      maxLength: {
        type: 'number',
        minimum: 0,
        title: 'Maximum Length',
        description: 'Maximum length of the filename (0 = no limit)',
      },
      removeSpaces: {
        type: 'boolean',
        default: false,
        title: 'Remove Spaces',
        description: 'Remove all spaces from the filename',
      },
      spaceReplacement: {
        type: 'string',
        default: '_',
        title: 'Space Replacement',
        description: 'Character to replace spaces with (if not removing)',
      },
      regex: {
        type: 'object',
        title: 'Regular Expression',
        description: 'Apply regular expression transformation',
        properties: {
          pattern: {
            type: 'string',
            title: 'Pattern',
            description: 'Regular expression pattern to match',
          },
          replacement: {
            type: 'string',
            title: 'Replacement',
            description: 'String to replace matches with',
            default: '',
          },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },

  defaultConfig: {
    includeExtension: false,
    caseTransform: 'none',
    removeSpaces: false,
    spaceReplacement: '_',
  },

  category: 'file-info',
  tags: ['filename', 'transform', 'case', 'regex'],
};
