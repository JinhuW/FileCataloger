# Stage 4: Built-in Plugins Migration

**Timeline**: Week 5
**Priority**: HIGH
**Dependencies**: Stage 3 completion

## Overview
This stage converts existing naming components into plugins and creates new built-in plugins that showcase the plugin system's capabilities. These plugins serve as examples for developers and provide enhanced functionality for users.

## Day 1: Migration Strategy

### Preparation
- [ ] **Create Migration Utilities**
  ```typescript
  // src/main/modules/plugins/migration/migrationUtils.ts

  export class ComponentMigrator {
    // Convert old component to plugin format
    async migrateComponent(
      type: 'date' | 'fileName' | 'counter' | 'text' | 'project',
      config: any
    ): Promise<NamingPlugin>;

    // Validate migrated plugin
    validateMigration(original: any, migrated: NamingPlugin): boolean;

    // Test migration
    async testMigration(plugin: NamingPlugin): Promise<TestResult>;
  }
  ```

- [ ] **Create Plugin Templates**
  ```typescript
  // src/main/modules/plugins/templates/basePlugin.ts

  export const createBasePlugin = (options: BasePluginOptions): NamingPlugin => ({
    id: options.id,
    name: options.name,
    version: '1.0.0',
    author: {
      name: 'FileCataloger Team',
      email: 'support@filecataloger.dev'
    },
    type: 'component',
    engine: {
      filecataloger: '>=2.0.0'
    },
    capabilities: options.capabilities || [],
    component: {
      render: options.render,
      preview: options.preview,
      validate: options.validate
    },
    configSchema: options.configSchema,
    defaultConfig: options.defaultConfig
  });
  ```

### Migration Plan
- [ ] **Document Current Behavior**
  - List all existing component features
  - Document edge cases
  - Note configuration options
  - Identify enhancement opportunities

## Day 2: Core Component Migrations

### Date Plugin
- [ ] **Convert Date Component**
  ```typescript
  // src/plugins/builtin/date/index.ts

  export default createBasePlugin({
    id: 'builtin-date',
    name: 'Date & Time',
    capabilities: [],
    configSchema: {
      type: 'object',
      properties: {
        dateType: {
          type: 'string',
          enum: ['current', 'file-created', 'file-modified', 'file-accessed'],
          default: 'current',
          description: 'Which date to use'
        },
        format: {
          type: 'string',
          default: 'YYYYMMDD',
          description: 'Date format pattern',
          examples: ['YYYYMMDD', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MMM DD, YYYY']
        },
        timezone: {
          type: 'string',
          default: 'local',
          description: 'Timezone for date formatting'
        },
        locale: {
          type: 'string',
          default: 'en-US',
          description: 'Locale for date formatting'
        }
      }
    },
    render: `
      function render(context) {
        const { file, config, utils } = context;
        let date;

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
      }
    `,
    preview: `
      function preview(config) {
        const date = new Date();
        return utils.format.date(date, config.format);
      }
    `
  });
  ```

- [ ] **Add Advanced Features**
  - Custom date formats with tokens
  - Relative dates (yesterday, last week)
  - Date arithmetic (add/subtract days)
  - Multiple calendar systems

### File Name Plugin
- [ ] **Convert File Name Component**
  ```typescript
  // src/plugins/builtin/filename/index.ts

  export default createBasePlugin({
    id: 'builtin-filename',
    name: 'File Name',
    capabilities: [],
    configSchema: {
      type: 'object',
      properties: {
        includeExtension: {
          type: 'boolean',
          default: false,
          description: 'Include file extension'
        },
        caseTransform: {
          type: 'string',
          enum: ['none', 'lower', 'upper', 'title', 'camel', 'pascal', 'kebab', 'snake'],
          default: 'none',
          description: 'Transform case of filename'
        },
        maxLength: {
          type: 'number',
          minimum: 0,
          description: 'Maximum length (0 = no limit)'
        },
        removeSpaces: {
          type: 'boolean',
          default: false,
          description: 'Remove spaces from filename'
        },
        spaceReplacement: {
          type: 'string',
          default: '_',
          description: 'Character to replace spaces with'
        },
        regex: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regular expression pattern'
            },
            replacement: {
              type: 'string',
              description: 'Replacement string'
            }
          }
        }
      }
    },
    render: `
      function render(context) {
        const { file, config, utils } = context;
        let name = config.includeExtension ? file.name : file.nameWithoutExtension;

        // Apply regex if provided
        if (config.regex?.pattern) {
          const regex = new RegExp(config.regex.pattern, 'g');
          name = name.replace(regex, config.regex.replacement || '');
        }

        // Remove or replace spaces
        if (config.removeSpaces || config.spaceReplacement !== '_') {
          name = name.replace(/\\s+/g, config.removeSpaces ? '' : config.spaceReplacement);
        }

        // Apply case transformation
        if (config.caseTransform !== 'none') {
          name = utils.string[config.caseTransform](name);
        }

        // Apply length limit
        if (config.maxLength > 0) {
          name = utils.string.truncate(name, config.maxLength);
        }

        return name;
      }
    `
  });
  ```

### Counter Plugin
- [ ] **Convert Counter Component**
  ```typescript
  // src/plugins/builtin/counter/index.ts

  export default createBasePlugin({
    id: 'builtin-counter',
    name: 'Sequential Counter',
    capabilities: [],
    configSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'number',
          default: 1,
          description: 'Starting number'
        },
        step: {
          type: 'number',
          default: 1,
          description: 'Increment step'
        },
        padding: {
          type: 'number',
          minimum: 0,
          default: 3,
          description: 'Minimum digits (pad with zeros)'
        },
        prefix: {
          type: 'string',
          default: '',
          description: 'Prefix before number'
        },
        suffix: {
          type: 'string',
          default: '',
          description: 'Suffix after number'
        },
        resetOn: {
          type: 'string',
          enum: ['never', 'daily', 'folder', 'pattern'],
          default: 'never',
          description: 'When to reset counter'
        }
      }
    },
    render: `
      function render(context) {
        const { config, runtime, utils } = context;
        const current = config.start + (runtime.index * config.step);
        const paddedNumber = utils.string.padStart(
          String(current),
          config.padding,
          '0'
        );
        return config.prefix + paddedNumber + config.suffix;
      }
    `,
    renderBatch: `
      function renderBatch(contexts) {
        // Handle reset logic for batch processing
        const { config } = contexts[0];
        let counter = config.start;
        let lastReset = null;

        return contexts.map((context, index) => {
          // Check if we need to reset
          if (config.resetOn === 'folder') {
            const currentFolder = context.file.path.split('/').slice(0, -1).join('/');
            if (lastReset !== currentFolder) {
              counter = config.start;
              lastReset = currentFolder;
            }
          }

          const current = counter;
          counter += config.step;

          const paddedNumber = context.utils.string.padStart(
            String(current),
            config.padding,
            '0'
          );
          return config.prefix + paddedNumber + config.suffix;
        });
      }
    `
  });
  ```

## Day 3: New Built-in Plugins

### Select/Dropdown Plugin
- [ ] **Create Select Plugin**
  ```typescript
  // src/plugins/builtin/select/index.ts

  export default createBasePlugin({
    id: 'builtin-select',
    name: 'Select from List',
    capabilities: ['database_access'],
    configSchema: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              label: { type: 'string' }
            }
          },
          default: [],
          description: 'Available options'
        },
        defaultValue: {
          type: 'string',
          description: 'Default selection'
        },
        allowCustom: {
          type: 'boolean',
          default: true,
          description: 'Allow custom values'
        },
        multiple: {
          type: 'boolean',
          default: false,
          description: 'Allow multiple selections'
        },
        separator: {
          type: 'string',
          default: '-',
          description: 'Separator for multiple values'
        }
      }
    },
    render: `
      function render(context) {
        const { config, storage } = context;

        // Get saved selection for this file if any
        const savedValue = storage.temp.get('selection');

        if (savedValue) {
          return savedValue;
        }

        return config.defaultValue || config.options[0]?.value || '';
      }
    `,
    configComponent: 'SelectConfig' // Custom React component
  });
  ```

### Conditional Plugin
- [ ] **Create Conditional Logic Plugin**
  ```typescript
  // src/plugins/builtin/conditional/index.ts

  export default createBasePlugin({
    id: 'builtin-conditional',
    name: 'Conditional',
    capabilities: [],
    configSchema: {
      type: 'object',
      properties: {
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['extension', 'size', 'type', 'name', 'date']
              },
              operator: {
                type: 'string',
                enum: ['equals', 'contains', 'startsWith', 'endsWith', 'matches', 'greaterThan', 'lessThan']
              },
              value: { type: 'string' },
              result: { type: 'string' }
            }
          }
        },
        defaultResult: {
          type: 'string',
          default: '',
          description: 'Result when no conditions match'
        }
      }
    },
    render: `
      function render(context) {
        const { file, config, utils } = context;

        for (const condition of config.conditions) {
          const fieldValue = getFieldValue(file, condition.field);

          if (evaluateCondition(fieldValue, condition.operator, condition.value)) {
            return condition.result;
          }
        }

        return config.defaultResult;

        function getFieldValue(file, field) {
          switch (field) {
            case 'extension': return file.extension;
            case 'size': return String(file.size);
            case 'type': return file.type;
            case 'name': return file.name;
            case 'date': return String(file.modified);
            default: return '';
          }
        }

        function evaluateCondition(fieldValue, operator, value) {
          switch (operator) {
            case 'equals': return fieldValue === value;
            case 'contains': return fieldValue.includes(value);
            case 'startsWith': return fieldValue.startsWith(value);
            case 'endsWith': return fieldValue.endsWith(value);
            case 'matches': return new RegExp(value).test(fieldValue);
            case 'greaterThan': return Number(fieldValue) > Number(value);
            case 'lessThan': return Number(fieldValue) < Number(value);
            default: return false;
          }
        }
      }
    `
  });
  ```

### Hash Plugin
- [ ] **Create Hash/Checksum Plugin**
  ```typescript
  // src/plugins/builtin/hash/index.ts

  export default createBasePlugin({
    id: 'builtin-hash',
    name: 'File Hash',
    capabilities: ['file_system_read'],
    configSchema: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          enum: ['md5', 'sha1', 'sha256', 'crc32'],
          default: 'md5',
          description: 'Hash algorithm'
        },
        length: {
          type: 'number',
          minimum: 0,
          default: 8,
          description: 'Hash length (0 = full)'
        },
        uppercase: {
          type: 'boolean',
          default: true,
          description: 'Use uppercase letters'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'base64', 'base64url'],
          default: 'hex',
          description: 'Hash encoding'
        }
      }
    },
    render: `
      async function render(context) {
        const { file, config, utils } = context;

        try {
          // Read file content (limited to first 1MB for performance)
          const buffer = await utils.fs.readFile(file.path, { limit: 1048576 });

          // Calculate hash
          let hash = utils.crypto[config.algorithm](buffer);

          // Apply encoding
          if (config.encoding !== 'hex') {
            hash = Buffer.from(hash, 'hex').toString(config.encoding);
          }

          // Apply length limit
          if (config.length > 0) {
            hash = hash.substring(0, config.length);
          }

          // Apply case
          if (config.uppercase && config.encoding === 'hex') {
            hash = hash.toUpperCase();
          }

          return hash;
        } catch (error) {
          context.logger.error('Hash calculation failed:', error);
          return 'HASH_ERROR';
        }
      }
    `
  });
  ```

## Day 4: Advanced Plugins

### EXIF Data Plugin
- [ ] **Create EXIF Plugin for Images**
  ```typescript
  // src/plugins/builtin/exif/index.ts

  export default createBasePlugin({
    id: 'builtin-exif',
    name: 'EXIF Data',
    capabilities: ['file_system_read'],
    configSchema: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: [
            'datetime', 'camera-make', 'camera-model', 'lens',
            'iso', 'aperture', 'shutter-speed', 'focal-length',
            'gps-latitude', 'gps-longitude', 'orientation'
          ],
          default: 'datetime',
          description: 'EXIF field to extract'
        },
        fallback: {
          type: 'string',
          default: '',
          description: 'Value when EXIF data not found'
        },
        dateFormat: {
          type: 'string',
          default: 'YYYYMMDD',
          description: 'Format for datetime field'
        }
      }
    },
    render: `
      async function render(context) {
        const { file, config, utils } = context;

        // Only process image files
        if (!file.type.startsWith('image/')) {
          return config.fallback;
        }

        try {
          const exifData = await utils.exif.read(file.path);

          switch (config.field) {
            case 'datetime':
              const date = exifData.DateTimeOriginal || exifData.DateTime;
              return date ? utils.format.date(new Date(date), config.dateFormat) : config.fallback;

            case 'camera-make':
              return exifData.Make || config.fallback;

            case 'camera-model':
              return exifData.Model || config.fallback;

            case 'iso':
              return exifData.ISO ? String(exifData.ISO) : config.fallback;

            // ... handle other fields

            default:
              return config.fallback;
          }
        } catch (error) {
          context.logger.warn('EXIF read failed:', error);
          return config.fallback;
        }
      }
    `
  });
  ```

### Random/UUID Plugin
- [ ] **Create Random Generator Plugin**
  ```typescript
  // src/plugins/builtin/random/index.ts

  export default createBasePlugin({
    id: 'builtin-random',
    name: 'Random/UUID',
    capabilities: [],
    configSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['uuid', 'nanoid', 'random', 'timestamp'],
          default: 'uuid',
          description: 'Type of random value'
        },
        length: {
          type: 'number',
          minimum: 1,
          maximum: 32,
          default: 8,
          description: 'Length for random string'
        },
        charset: {
          type: 'string',
          enum: ['alphanumeric', 'alpha', 'numeric', 'hex'],
          default: 'alphanumeric',
          description: 'Character set for random string'
        },
        uppercase: {
          type: 'boolean',
          default: false,
          description: 'Use uppercase letters'
        }
      }
    },
    render: `
      function render(context) {
        const { config, utils } = context;

        switch (config.type) {
          case 'uuid':
            return utils.crypto.uuid();

          case 'nanoid':
            return utils.crypto.nanoid(config.length);

          case 'timestamp':
            return String(Date.now());

          case 'random':
            const charsets = {
              alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
              alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
              numeric: '0123456789',
              hex: '0123456789ABCDEF'
            };

            let charset = charsets[config.charset];
            if (!config.uppercase && config.charset !== 'numeric') {
              charset = charset.toLowerCase();
            }

            return utils.crypto.randomString(config.length, charset);

          default:
            return '';
        }
      }
    `
  });
  ```

## Day 5: Testing and Documentation

### Plugin Test Suite
- [ ] **Create Test Framework**
  ```typescript
  // src/plugins/builtin/__tests__/pluginTestUtils.ts

  export class PluginTestRunner {
    async testPlugin(
      plugin: NamingPlugin,
      testCases: TestCase[]
    ): Promise<TestResults>;

    async testRender(
      plugin: NamingPlugin,
      context: PluginContext,
      expected: string
    ): Promise<boolean>;

    async testBatchRender(
      plugin: NamingPlugin,
      contexts: PluginContext[],
      expected: string[]
    ): Promise<boolean>;

    async testConfiguration(
      plugin: NamingPlugin,
      config: any
    ): Promise<ValidationResult>;

    async benchmarkPlugin(
      plugin: NamingPlugin,
      iterations: number
    ): Promise<BenchmarkResult>;
  }
  ```

### Test Cases
- [ ] **Write Comprehensive Tests**
  - Each plugin tested individually
  - Edge cases covered
  - Error scenarios tested
  - Performance benchmarked
  - Configuration validation

### Plugin Documentation
- [ ] **Create Plugin Docs**
  ```markdown
  # Built-in Plugins Documentation

  ## Date & Time Plugin
  - Description
  - Configuration options
  - Examples
  - Use cases

  ## File Name Plugin
  - Description
  - Configuration options
  - Examples
  - Use cases

  // ... for each plugin
  ```

### Migration Guide
- [ ] **Create Migration Documentation**
  - How to migrate from old components
  - Configuration mapping
  - Breaking changes
  - Upgrade path

## Performance Optimization

### Caching Strategy
- [ ] **Implement Plugin Cache**
  - Cache compiled render functions
  - Cache plugin metadata
  - Lazy load heavy plugins
  - Memory management

### Batch Processing
- [ ] **Optimize Batch Operations**
  - Batch render support
  - Shared context optimization
  - Parallel execution where safe
  - Progress reporting

## Quality Assurance

### Code Review Checklist
- [ ] All plugins follow consistent structure
- [ ] Error handling implemented
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Tests comprehensive
- [ ] Security validated

### User Testing
- [ ] Test with real file sets
- [ ] Validate output correctness
- [ ] Check performance impact
- [ ] Verify backwards compatibility

## Deliverables

1. **Migrated Core Plugins**
   - Date plugin with enhancements
   - File name plugin with transforms
   - Counter plugin with reset logic
   - Text and project plugins

2. **New Advanced Plugins**
   - Select/dropdown plugin
   - Conditional logic plugin
   - Hash/checksum plugin
   - EXIF data plugin
   - Random/UUID plugin

3. **Testing Infrastructure**
   - Comprehensive test suite
   - Performance benchmarks
   - Integration tests

4. **Documentation**
   - Plugin API docs
   - Usage examples
   - Migration guide
   - Best practices

## Success Criteria

- [ ] All existing functionality preserved
- [ ] New plugins add value
- [ ] Performance remains acceptable
- [ ] No breaking changes for users
- [ ] Test coverage > 90%
- [ ] Documentation complete

## Next Stage

Stage 5 will create the Developer SDK, enabling external developers to create and distribute their own plugins.