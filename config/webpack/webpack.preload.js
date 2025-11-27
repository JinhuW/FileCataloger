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
 * - transpileOnly is set to true for faster builds (type checking done separately)
 * - Uses the renderer tsconfig.json for TypeScript configuration (preload has DOM access)
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
    filename: 'index.js',
    // Clean output directory before building
    clean: true
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(projectRoot, 'src/renderer/tsconfig.json'),
            // Type checking should be done separately for better performance
            transpileOnly: true,
            // Disable project references to avoid ts-loader issues
            projectReferences: false
          }
        }],
        exclude: /node_modules/
      }
    ]
  },

  // Optimize for preload script size
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    // No need for runtime chunk in preload
    runtimeChunk: false,
    // No need to split chunks in preload
    splitChunks: false
  },

  // Proper externals for electron preload
  externals: {
    electron: 'commonjs electron'
  },

  // Disable source maps in production for security
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'
});