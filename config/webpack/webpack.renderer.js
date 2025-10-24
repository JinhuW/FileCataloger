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
            configFile: path.resolve(projectRoot, 'config/tsconfig.renderer.json'),
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

  plugins: [
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