const path = require('path');
const webpack = require('webpack');

const projectRoot = path.resolve(__dirname, '../..');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json', '.node'],
    alias: {
      '@main': path.resolve(projectRoot, 'src/main'),
      '@renderer': path.resolve(projectRoot, 'src/renderer'),
      '@preload': path.resolve(projectRoot, 'src/preload'),
      '@native': path.resolve(projectRoot, 'src/native'),
      '@shared': path.resolve(projectRoot, 'src/shared'),
      '@': path.resolve(projectRoot, 'src')
    }
  },

  module: {
    rules: []
  },

  plugins: [
    // Define build-time constants
    new webpack.DefinePlugin({
      '__BUILD_TIMESTAMP__': JSON.stringify(new Date().toISOString()),
      '__BUILD_DATE__': JSON.stringify(new Date().toLocaleDateString()),
      '__BUILD_TIME__': JSON.stringify(new Date().toLocaleTimeString()),
      '__NODE_VERSION__': JSON.stringify(process.version),
      '__PLATFORM__': JSON.stringify(process.platform),
      '__ARCH__': JSON.stringify(process.arch)
    })
  ],

  stats: {
    warnings: true,
    errors: true
  }
};