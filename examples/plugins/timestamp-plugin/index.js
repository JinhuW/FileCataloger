/**
 * @file index.js
 * @description Timestamp plugin for FileCataloger that provides customizable timestamp components
 */

module.exports = {
  id: 'timestamp',
  version: '1.0.0',
  metadata: {
    name: 'Timestamp',
    description: 'Add customizable timestamps to file names',
    icon: '⏰',
    author: 'FileCataloger Team',
    website: 'https://github.com/filecataloger/plugins',
    tags: ['date', 'time', 'timestamp'],
    screenshots: [],
  },

  // Configuration schema for the plugin
  configSchema: {
    format: {
      type: 'select',
      label: 'Timestamp Format',
      description: 'Choose the timestamp format',
      required: true,
      default: 'ISO',
      options: [
        { value: 'ISO', label: 'ISO 8601 (2025-01-22T14:30:45)' },
        { value: 'UNIX', label: 'Unix Timestamp (1737557445)' },
        { value: 'DATE_TIME', label: 'Date and Time (2025-01-22_14-30-45)' },
        { value: 'TIME_ONLY', label: 'Time Only (14-30-45)' },
        { value: 'COMPACT', label: 'Compact (20250122143045)' },
        { value: 'CUSTOM', label: 'Custom Format' },
      ],
    },
    customFormat: {
      type: 'text',
      label: 'Custom Format',
      description: 'Custom date format (e.g., YYYY-MM-DD_HH-mm-ss)',
      placeholder: 'YYYY-MM-DD_HH-mm-ss',
      visibleWhen: { format: 'CUSTOM' },
    },
    timezone: {
      type: 'select',
      label: 'Timezone',
      description: 'Timezone for the timestamp',
      default: 'local',
      options: [
        { value: 'local', label: 'Local Time' },
        { value: 'UTC', label: 'UTC' },
        { value: 'EST', label: 'Eastern Time' },
        { value: 'PST', label: 'Pacific Time' },
        { value: 'CST', label: 'Central Time' },
      ],
    },
  },

  // The component that generates the timestamp
  component: {
    render: async (context) => {
      const { config } = context;
      const format = config?.format || 'ISO';
      const timezone = config?.timezone || 'local';

      const now = new Date();

      // Adjust for timezone if needed
      let date = now;
      if (timezone === 'UTC') {
        // Convert to UTC
        const utcDate = new Date(now.toISOString());
        date = utcDate;
      }

      // Generate timestamp based on format
      switch (format) {
        case 'ISO':
          return date.toISOString().replace(/:/g, '-').replace(/\\.\\d{3}Z$/, '');

        case 'UNIX':
          return Math.floor(date.getTime() / 1000).toString();

        case 'DATE_TIME':
          return formatDateTime(date, 'YYYY-MM-DD_HH-mm-ss');

        case 'TIME_ONLY':
          return formatDateTime(date, 'HH-mm-ss');

        case 'COMPACT':
          return formatDateTime(date, 'YYYYMMDDHHmmss');

        case 'CUSTOM':
          const customFormat = config?.customFormat || 'YYYY-MM-DD_HH-mm-ss';
          return formatDateTime(date, customFormat);

        default:
          return date.toISOString();
      }
    },

    // Batch processing support
    renderBatch: async (contexts) => {
      // For timestamps, we might want all files in a batch to have the same timestamp
      const timestamp = await module.exports.component.render(contexts[0]);
      return contexts.map(() => timestamp);
    },
  },

  // Lifecycle hooks
  lifecycle: {
    onLoad: async (context) => {
      context.logger.info('Timestamp plugin loaded');
    },

    onUnload: async (context) => {
      context.logger.info('Timestamp plugin unloaded');
    },

    onConfigChange: async (oldConfig, newConfig, context) => {
      context.logger.debug('Timestamp plugin config changed', { oldConfig, newConfig });
    },
  },

  // API methods exposed by the plugin
  api: {
    getAvailableFormats: () => {
      return [
        'ISO',
        'UNIX',
        'DATE_TIME',
        'TIME_ONLY',
        'COMPACT',
        'CUSTOM',
      ];
    },

    getTimezones: () => {
      return ['local', 'UTC', 'EST', 'PST', 'CST'];
    },

    formatTimestamp: (date, format) => {
      return formatDateTime(date, format);
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

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}