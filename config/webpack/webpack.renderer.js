const path = require('path');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const common = require('./webpack.common');

const projectRoot = path.resolve(__dirname, '../..');

module.exports = merge(common, {
  entry: {
    shelf: path.resolve(projectRoot, 'src/renderer/pages/shelf/shelf.tsx'),
    preferences: path.resolve(projectRoot, 'src/renderer/pages/preferences/preferences.ts')
  },

  output: {
    path: path.resolve(projectRoot, 'dist/renderer'),
    filename: '[name].js'
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: /src/,
        exclude: [/__tests__/, /\.test\.tsx?$/],
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(projectRoot, 'src/renderer/tsconfig.json'),
            transpileOnly: true
          }
        }]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: path.resolve(projectRoot, 'config/postcss.config.js')
              }
            }
          }
        ]
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: '../',
              publicPath: '../'
            }
          }
        ]
      }
    ]
  },

  target: 'electron-renderer',

  // Prevent webpack from trying to polyfill or externalize Node.js built-ins
  // The renderer should use browser APIs only
  resolve: {
    fallback: {
      crypto: false,  // Use browser's Web Crypto API, not Node.js crypto
      path: false,
      fs: false,
      stream: false
    }
  },

  // Override externals to prevent node:crypto from being external
  // We want to use browser's built-in crypto, not require it
  externals: function ({ request }, callback) {
    // Don't externalize node:crypto or crypto - use browser's Web Crypto API
    if (request === 'node:crypto' || request === 'crypto') {
      return callback();
    }
    // Allow other externals
    return callback();
  },

  plugins: [
    // Replace any crypto imports with our shim that uses browser's Web Crypto API
    new webpack.NormalModuleReplacementPlugin(
      /^(node:)?crypto$/,
      path.resolve(__dirname, 'cryptoShim.js')
    ),

    // Ignore the optional @emotion/is-prop-valid dependency from framer-motion
    new webpack.IgnorePlugin({
      resourceRegExp: /^@emotion\/is-prop-valid$/,
      contextRegExp: /framer-motion/
    }),

    new HtmlWebpackPlugin({
      template: path.resolve(projectRoot, 'src/renderer/pages/shelf/shelf.html'),
      filename: 'shelf.html',
      chunks: ['shelf']
    }),

    new HtmlWebpackPlugin({
      template: path.resolve(projectRoot, 'src/renderer/pages/preferences/preferences.html'),
      filename: 'preferences.html',
      chunks: ['preferences']
    })
  ]
});