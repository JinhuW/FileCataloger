/**
 * @file index.js
 * @description File Last Updated Date plugin for FileCataloger that adds file's last modification date as a rename component
 */

module.exports = {
  id: 'file-last-updated',
  version: '1.0.0',
  metadata: {
    name: 'File Last Updated Date',
    description: 'Add file\'s last modification date to filenames with flexible formatting options',
    icon: '📅',
    author: 'FileCataloger Community',
    website: 'https://github.com/filecataloger/plugins',
    tags: ['file', 'metadata', 'date', 'modified', 'timestamp', 'last-updated'],
    screenshots: [],
  },

  // Configuration schema for the plugin
  configSchema: {
    format: {
      type: 'select',
      label: 'Date Format',
      description: 'Choose the date format for the last modified date',
      required: true,
      default: 'YYYYMMDD',
      options: [
        { value: 'YYYYMMDD', label: 'YYYYMMDD (20250122)' },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-01-22)' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (22/01/2025)' },
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (01/22/2025)' },
        { value: 'YYYY-MM-DD_HH-mm-ss', label: 'YYYY-MM-DD_HH-mm-ss (2025-01-22_14-30-45)' },
        { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY (Jan 22, 2025)' },
        { value: 'DD MMM YYYY', label: 'DD MMM YYYY (22 Jan 2025)' },
        { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2025/01/22)' },
        { value: 'YYMMDD', label: 'YYMMDD (250122)' },
        { value: 'DDMMYYYY', label: 'DDMMYYYY (22012025)' },
        { value: 'CUSTOM', label: 'Custom Format' },
      ],
    },
    customFormat: {
      type: 'text',
      label: 'Custom Format',
      description: 'Custom date format pattern (YYYY=year, MM=month, DD=day, HH=hour, mm=minute, ss=second)',
      placeholder: 'YYYY-MM-DD [at] HH:mm',
      visibleWhen: { format: 'CUSTOM' },
    },
    prefix: {
      type: 'text',
      label: 'Prefix',
      description: 'Text to add before the date (e.g., "lastmod_", "updated_")',
      placeholder: 'lastmod_',
      maxLength: 50,
    },
    suffix: {
      type: 'text',
      label: 'Suffix',
      description: 'Text to add after the date (e.g., "_backup", "_v")',
      placeholder: '_backup',
      maxLength: 50,
    },
    timezone: {
      type: 'select',
      label: 'Timezone',
      description: 'Timezone for date formatting',
      default: 'local',
      options: [
        { value: 'local', label: 'Local Time' },
        { value: 'UTC', label: 'UTC' },
      ],
    },
  },

  // The component that generates the file last updated date
  component: {
    render: async (context) => {
      const { file, config } = context;

      // Get the file's last modified date
      const lastModifiedDate = new Date(file.modified);

      // Handle invalid dates gracefully
      if (isNaN(lastModifiedDate.getTime())) {
        throw new Error('Invalid file modification date');
      }

      // Apply timezone adjustment if needed
      let date = lastModifiedDate;
      if (config?.timezone === 'UTC') {
        // Convert to UTC
        date = new Date(lastModifiedDate.toISOString());
      }

      // Get format configuration
      const format = config?.format || 'YYYYMMDD';
      const useCustomFormat = format === 'CUSTOM';
      const customFormat = config?.customFormat || 'YYYY-MM-DD';
      const prefix = config?.prefix || '';
      const suffix = config?.suffix || '';

      // Format the date
      let formattedDate;
      try {
        if (useCustomFormat) {
          formattedDate = formatDateTime(date, customFormat);
        } else {
          formattedDate = formatDateTime(date, format);
        }
      } catch (error) {
        throw new Error(`Failed to format date: ${error.message}`);
      }

      // Apply prefix and suffix
      return `${prefix}${formattedDate}${suffix}`;
    },

    // Batch processing support
    renderBatch: async (contexts) => {
      // For file last updated dates, each file will have its own unique date
      const results = [];
      for (const context of contexts) {
        try {
          const result = await module.exports.component.render(context);
          results.push(result);
        } catch (error) {
          results.push(`ERROR: ${error.message}`);
        }
      }
      return results;
    },

    // Preview function for the UI
    preview: (config) => {
      // Use current date for preview
      const previewDate = new Date();
      const format = config?.format || 'YYYYMMDD';
      const useCustomFormat = format === 'CUSTOM';
      const customFormat = config?.customFormat || 'YYYY-MM-DD';
      const prefix = config?.prefix || '';
      const suffix = config?.suffix || '';

      try {
        let formattedDate;
        if (useCustomFormat) {
          formattedDate = formatDateTime(previewDate, customFormat);
        } else {
          formattedDate = formatDateTime(previewDate, format);
        }
        return `${prefix}${formattedDate}${suffix}`;
      } catch (error) {
        return 'Invalid format';
      }
    },

    // Validation function
    validate: (config) => {
      const errors = [];
      const warnings = [];

      // Validate format selection
      if (!config.format && !config.useCustomFormat) {
        errors.push('Either a predefined format or custom format must be selected');
      }

      // Validate custom format if enabled
      if (config.format === 'CUSTOM') {
        if (!config.customFormat || typeof config.customFormat !== 'string') {
          errors.push('Custom format is required when using custom format option');
        } else if (config.customFormat.length === 0) {
          errors.push('Custom format cannot be empty');
        }
      }

      // Validate prefix and suffix
      if (config.prefix && typeof config.prefix !== 'string') {
        errors.push('Prefix must be a string');
      }
      if (config.suffix && typeof config.suffix !== 'string') {
        errors.push('Suffix must be a string');
      }

      // Warning for very long prefixes/suffixes
      if (config.prefix && config.prefix.length > 20) {
        warnings.push('Long prefix may make filenames unwieldy');
      }
      if (config.suffix && config.suffix.length > 20) {
        warnings.push('Long suffix may make filenames unwieldy');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
  },

  // Lifecycle hooks
  lifecycle: {
    onLoad: async (context) => {
      context.logger.info('File Last Updated Date plugin loaded');
    },

    onUnload: async (context) => {
      context.logger.info('File Last Updated Date plugin unloaded');
    },

    onConfigChange: async (oldConfig, newConfig, context) => {
      context.logger.debug('File Last Updated Date plugin config changed', { oldConfig, newConfig });
    },
  },

  // API methods exposed by the plugin
  api: {
    getAvailableFormats: () => {
      return [
        'YYYYMMDD',
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY-MM-DD_HH-mm-ss',
        'MMM DD, YYYY',
        'DD MMM YYYY',
        'YYYY/MM/DD',
        'YYMMDD',
        'DDMMYYYY',
        'CUSTOM',
      ];
    },

    getTimezones: () => {
      return ['local', 'UTC'];
    },

    formatFileDate: (fileModifiedTimestamp, format) => {
      const date = new Date(fileModifiedTimestamp);
      return formatDateTime(date, format);
    },

    isValidDate: (timestamp) => {
      const date = new Date(timestamp);
      return !isNaN(date.getTime());
    },
  },
};

// Helper function to format date/time
function formatDateTime(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Get month names for MMM format
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthName = monthNames[date.getMonth()];

  // Get short year
  const shortYear = String(year).slice(-2);

  return format
    .replace('YYYY', year)
    .replace('YY', shortYear)
    .replace('MMM', monthName)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}