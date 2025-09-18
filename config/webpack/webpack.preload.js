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