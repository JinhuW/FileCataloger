/**
 * @fileoverview Webpack configuration for the preload script
 *
 * This configuration builds the preload script that runs in the renderer process
 * but has access to Node.js APIs, acting as a secure bridge between main and renderer.
 *
 * Key configuration:
 * - Target: 'electron-preload' for proper Electron preload environment
 * - Entry: src/preload/index.ts
 * - Output: dist/preload/index.js
 * - TypeScript compilation with ts-loader
 * - Electron externals to prevent bundling Electron APIs
 *
 * Build notes:
 * - transpileOnly is set to false for type checking during build
 * - Uses the main tsconfig.json for TypeScript configuration
 * - Inherits common webpack settings from webpack.common.js
 */

const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

const projectRoot = path.resolve(__dirname, '../..');

module.exports = merge(common, {
  entry: path.resolve(projectRoot, 'src/preload/index.ts'),

  target: 'electron-preload',

  output: {
    path: path.resolve(projectRoot, 'dist/preload'),
    filename: 'index.js'
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(projectRoot, 'tsconfig.json'),
            transpileOnly: false
          }
        }],
        exclude: /node_modules/
      }
    ]
  },

  externals: {
    electron: 'commonjs electron'
  }
});