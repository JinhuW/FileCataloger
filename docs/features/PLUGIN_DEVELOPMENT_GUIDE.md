# FileCataloger Plugin Development Guide

This guide will help you create custom plugins for FileCataloger to extend its file naming capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Plugin Structure](#plugin-structure)
3. [Configuration Schema](#configuration-schema)
4. [Component Implementation](#component-implementation)
5. [Lifecycle Hooks](#lifecycle-hooks)
6. [API Methods](#api-methods)
7. [Testing Your Plugin](#testing-your-plugin)
8. [Publishing Your Plugin](#publishing-your-plugin)
9. [Example Plugins](#example-plugins)
10. [Best Practices](#best-practices)

## Overview

FileCataloger plugins are npm packages that extend the file renaming functionality by providing custom naming components. Users can install plugins from npm and use them in their rename patterns alongside built-in components.

### Plugin Types

Currently, FileCataloger supports **naming plugins** that provide custom components for file rename patterns.

### Plugin Architecture

Plugins run in a sandboxed environment with access to:
- File metadata (name, extension, index)
- Plugin configuration
- Utility functions (crypto, string manipulation, date formatting)
- Logging capabilities

## Plugin Structure

### Package Structure

```
my-plugin/
├── package.json
├── index.js
├── README.md
├── LICENSE
└── test/
    └── index.test.js
```

### package.json

Your plugin's `package.json` must include:

```json
{
  "name": "@filecataloger/plugin-[name]",
  "version": "1.0.0",
  "description": "Description of your plugin",
  "main": "index.js",
  "keywords": [
    "filecataloger",
    "plugin",
    "rename"
  ],
  "filecataloger": {
    "version": "^1.0.0",
    "type": "naming"
  },
  "author": "Your Name",
  "license": "MIT",
  "peerDependencies": {
    "@filecataloger/plugin-sdk": "^1.0.0"
  }
}
```

### index.js

Your plugin must export an object with the following structure:

```javascript
module.exports = {
  id: 'unique-plugin-id',
  version: '1.0.0',
  metadata: {
    name: 'Display Name',
    description: 'What your plugin does',
    icon: '🔌', // Emoji or icon
    author: 'Your Name',
    website: 'https://your-website.com',
    tags: ['tag1', 'tag2'],
    screenshots: []
  },
  configSchema: {
    // Configuration options
  },
  component: {
    render: async (context) => {
      // Generate the component value
    },
    renderBatch: async (contexts) => {
      // Optional: batch processing
    }
  },
  lifecycle: {
    // Optional lifecycle hooks
  },
  api: {
    // Optional API methods
  }
};
```

## Configuration Schema

Define user-configurable options for your plugin:

```javascript
configSchema: {
  format: {
    type: 'select',
    label: 'Format',
    description: 'Choose the format',
    required: true,
    default: 'option1',
    options: [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ]
  },
  prefix: {
    type: 'text',
    label: 'Prefix',
    description: 'Text to add before the value',
    placeholder: 'Enter prefix',
    default: ''
  },
  uppercase: {
    type: 'boolean',
    label: 'Uppercase',
    description: 'Convert to uppercase',
    default: false
  },
  customField: {
    type: 'text',
    label: 'Custom Field',
    visibleWhen: { format: 'custom' } // Conditional visibility
  }
}
```

### Supported Field Types

- `text`: Text input field
- `select`: Dropdown selection
- `boolean`: Checkbox
- `number`: Numeric input

## Component Implementation

The `component` object contains the core logic of your plugin:

### render(context)

The main function that generates the component value:

```javascript
component: {
  render: async (context) => {
    const {
      filename,    // Original filename without extension
      extension,   // File extension (e.g., '.txt')
      index,       // File index in batch (0-based)
      config,      // User configuration
      utils,       // Utility functions
      logger       // Plugin logger
    } = context;

    // Your logic here
    const result = processFilename(filename, config);

    return result; // Must return a string
  }
}
```

### renderBatch(contexts)

Optional method for batch processing efficiency:

```javascript
renderBatch: async (contexts) => {
  // Process all files at once
  const results = contexts.map(ctx => {
    // Process each context
    return processContext(ctx);
  });

  return results; // Array of strings
}
```

### Available Utilities

The `utils` object provides helpful functions:

```javascript
utils: {
  date: {
    format(date, pattern),      // Format date
    parse(dateString),          // Parse date string
    addDays(date, days),        // Add days
    formatRelative(date),       // e.g., "2 days ago"
    getDayOfYear(date),         // Day number (1-365)
    getWeekOfYear(date),        // Week number
    isLeapYear(year)           // Check leap year
  },
  string: {
    slugify(text),             // Convert to slug
    camelCase(text),           // Convert to camelCase
    pascalCase(text),          // Convert to PascalCase
    kebabCase(text),           // Convert to kebab-case
    snakeCase(text),           // Convert to snake_case
    titleCase(text),           // Convert to Title Case
    truncate(text, length),    // Truncate with ellipsis
    padStart(text, length, char),
    padEnd(text, length, char)
  },
  crypto: {
    md5(data),                 // MD5 hash
    sha1(data),                // SHA-1 hash
    sha256(data),              // SHA-256 hash
    uuid(),                    // Generate UUID
    randomString(length, charset)
  }
}
```

## Lifecycle Hooks

Optional hooks for plugin lifecycle events:

```javascript
lifecycle: {
  onLoad: async (context) => {
    // Called when plugin is loaded
    context.logger.info('Plugin loaded');
  },

  onUnload: async (context) => {
    // Called when plugin is unloaded
    context.logger.info('Plugin unloaded');
  },

  onConfigChange: async (oldConfig, newConfig, context) => {
    // Called when configuration changes
    context.logger.debug('Config changed', { oldConfig, newConfig });
  },

  onError: async (error, context) => {
    // Called when an error occurs
    context.logger.error('Plugin error', error);
  }
}
```

## API Methods

Expose additional methods for advanced use:

```javascript
api: {
  // Custom methods that can be called by other parts of the system
  getAvailableFormats: () => {
    return ['format1', 'format2', 'format3'];
  },

  validateInput: (input) => {
    return input.length > 0 && input.length < 100;
  },

  processCustomData: async (data, options) => {
    // Custom processing logic
    return processedData;
  }
}
```

## Testing Your Plugin

### Local Testing

1. Create a test file:

```javascript
// test/index.test.js
const plugin = require('../index.js');

describe('My Plugin', () => {
  test('renders correct output', async () => {
    const context = {
      filename: 'test-file',
      extension: '.txt',
      index: 0,
      config: { format: 'uppercase' },
      utils: { /* mock utils */ },
      logger: console
    };

    const result = await plugin.component.render(context);
    expect(result).toBe('TEST-FILE');
  });
});
```

2. Install in FileCataloger for testing:

```bash
# From your plugin directory
npm link

# From FileCataloger plugins directory
npm link @filecataloger/plugin-[name]
```

### Plugin Validator

Use the FileCataloger plugin validator to check your plugin:

```bash
npx @filecataloger/plugin-validator .
```

This checks for:
- Correct structure
- Required fields
- Security issues
- Performance concerns

## Publishing Your Plugin

### 1. Prepare for Publishing

- Ensure all tests pass
- Update README.md with usage instructions
- Add examples
- Include screenshots if applicable
- Choose an appropriate license

### 2. Publish to npm

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

### 3. Register with FileCataloger

Submit your plugin to the FileCataloger plugin registry:

1. Fork the [FileCataloger Plugins](https://github.com/filecataloger/plugins) repository
2. Add your plugin to `registry.json`
3. Submit a pull request

## Example Plugins

### Timestamp Plugin

Adds customizable timestamps to file names:

```javascript
module.exports = {
  id: 'timestamp',
  version: '1.0.0',
  metadata: {
    name: 'Timestamp',
    description: 'Add timestamps to file names',
    icon: '⏰'
  },
  configSchema: {
    format: {
      type: 'select',
      label: 'Format',
      default: 'ISO',
      options: [
        { value: 'ISO', label: 'ISO 8601' },
        { value: 'UNIX', label: 'Unix Timestamp' },
        { value: 'CUSTOM', label: 'Custom' }
      ]
    }
  },
  component: {
    render: async (context) => {
      const format = context.config?.format || 'ISO';
      const now = new Date();

      switch (format) {
        case 'ISO':
          return now.toISOString();
        case 'UNIX':
          return Math.floor(now.getTime() / 1000).toString();
        default:
          return now.toString();
      }
    }
  }
};
```

### Hash Plugin

Adds file hashes to names:

```javascript
module.exports = {
  id: 'hash',
  version: '1.0.0',
  metadata: {
    name: 'File Hash',
    description: 'Add file hash to names',
    icon: '#️⃣'
  },
  configSchema: {
    algorithm: {
      type: 'select',
      label: 'Algorithm',
      default: 'MD5_SHORT',
      options: [
        { value: 'MD5_SHORT', label: 'MD5 (8 chars)' },
        { value: 'SHA256_SHORT', label: 'SHA-256 (8 chars)' }
      ]
    }
  },
  component: {
    render: async (context) => {
      const { filename, utils, config } = context;
      const algorithm = config?.algorithm || 'MD5_SHORT';

      if (algorithm === 'MD5_SHORT') {
        return utils.crypto.md5(filename).substring(0, 8);
      } else {
        return utils.crypto.sha256(filename).substring(0, 8);
      }
    }
  }
};
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
render: async (context) => {
  try {
    // Your logic
    return result;
  } catch (error) {
    context.logger.error('Failed to process', error);
    return 'ERROR'; // Fallback value
  }
}
```

### 2. Performance

- Use `renderBatch` for operations that can be optimized in batches
- Cache expensive computations
- Avoid synchronous file I/O

### 3. Configuration

- Provide sensible defaults
- Use clear, descriptive labels
- Include helpful descriptions
- Validate user input

### 4. Security

- Never execute user input as code
- Sanitize all inputs
- Don't access files outside the sandbox
- Don't make network requests without permission

### 5. User Experience

- Choose a clear, descriptive name
- Use an appropriate emoji icon
- Provide comprehensive documentation
- Include usage examples
- Handle edge cases gracefully

### 6. Compatibility

- Test with different file types
- Handle special characters in filenames
- Support various operating systems
- Maintain backward compatibility

## Support and Resources

- [FileCataloger Plugin SDK Documentation](https://docs.filecataloger.com/plugins)
- [Plugin Examples Repository](https://github.com/filecataloger/plugin-examples)
- [Community Forums](https://community.filecataloger.com)
- [Discord Server](https://discord.gg/filecataloger)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This guide is licensed under the MIT License. See [LICENSE](LICENSE) for details.