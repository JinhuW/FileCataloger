/**
 * @file index.js
 * @description Hash plugin for FileCataloger that adds file hash/checksum components
 */

module.exports = {
  id: 'hash',
  version: '1.0.0',
  metadata: {
    name: 'File Hash',
    description: 'Add file hash or checksum to file names',
    icon: '#️⃣',
    author: 'FileCataloger Team',
    website: 'https://github.com/filecataloger/plugins',
    tags: ['hash', 'checksum', 'md5', 'sha256', 'security'],
    screenshots: [],
  },

  // Configuration schema
  configSchema: {
    algorithm: {
      type: 'select',
      label: 'Hash Algorithm',
      description: 'Choose the hashing algorithm',
      required: true,
      default: 'MD5_SHORT',
      options: [
        { value: 'MD5_SHORT', label: 'MD5 (first 8 chars)' },
        { value: 'MD5_FULL', label: 'MD5 (full hash)' },
        { value: 'SHA1_SHORT', label: 'SHA-1 (first 8 chars)' },
        { value: 'SHA256_SHORT', label: 'SHA-256 (first 8 chars)' },
        { value: 'SHA256_FULL', label: 'SHA-256 (full hash)' },
        { value: 'CRC32', label: 'CRC32' },
      ],
    },
    uppercase: {
      type: 'boolean',
      label: 'Uppercase',
      description: 'Use uppercase letters for hash',
      default: false,
    },
    prefix: {
      type: 'text',
      label: 'Prefix',
      description: 'Text to add before the hash',
      placeholder: 'hash-',
      default: '',
    },
  },

  // The component that generates the hash
  component: {
    render: async (context) => {
      const { filename, config, utils } = context;
      const algorithm = config?.algorithm || 'MD5_SHORT';
      const uppercase = config?.uppercase || false;
      const prefix = config?.prefix || '';

      // Generate hash based on filename (in production, would hash file contents)
      let hash = '';

      switch (algorithm) {
        case 'MD5_SHORT':
          hash = utils.crypto.md5(filename).substring(0, 8);
          break;
        case 'MD5_FULL':
          hash = utils.crypto.md5(filename);
          break;
        case 'SHA1_SHORT':
          hash = utils.crypto.sha1(filename).substring(0, 8);
          break;
        case 'SHA256_SHORT':
          hash = utils.crypto.sha256(filename).substring(0, 8);
          break;
        case 'SHA256_FULL':
          hash = utils.crypto.sha256(filename);
          break;
        case 'CRC32':
          // Simple CRC32 implementation for demo
          hash = calculateCRC32(filename).toString(16).padStart(8, '0');
          break;
        default:
          hash = utils.crypto.md5(filename).substring(0, 8);
      }

      if (uppercase) {
        hash = hash.toUpperCase();
      }

      return prefix + hash;
    },

    // Batch processing - each file gets its own hash
    renderBatch: async (contexts) => {
      return Promise.all(
        contexts.map(context => module.exports.component.render(context))
      );
    },
  },

  // Lifecycle hooks
  lifecycle: {
    onLoad: async (context) => {
      context.logger.info('Hash plugin loaded');
    },

    onUnload: async (context) => {
      context.logger.info('Hash plugin unloaded');
    },

    onError: async (error, context) => {
      context.logger.error('Hash plugin error:', error);
    },
  },

  // API methods
  api: {
    getAvailableAlgorithms: () => {
      return [
        'MD5_SHORT',
        'MD5_FULL',
        'SHA1_SHORT',
        'SHA256_SHORT',
        'SHA256_FULL',
        'CRC32',
      ];
    },

    calculateHash: (data, algorithm) => {
      // Delegate to the main hash calculation logic
      const context = {
        filename: data,
        config: { algorithm },
        utils: {
          crypto: {
            md5: (d) => require('crypto').createHash('md5').update(d).digest('hex'),
            sha1: (d) => require('crypto').createHash('sha1').update(d).digest('hex'),
            sha256: (d) => require('crypto').createHash('sha256').update(d).digest('hex'),
          },
        },
      };
      return module.exports.component.render(context);
    },
  },
};

// Simple CRC32 implementation for demo purposes
function calculateCRC32(str) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    crc = crc ^ str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & (-(crc & 1)));
    }
  }
  return crc ^ 0xFFFFFFFF;
}