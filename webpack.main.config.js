const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/main/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'index.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: /src/,
        exclude: /\.node$/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.node$/,
        use: [
          {
            loader: 'node-loader',
            options: {
              name: '[name].[ext]'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.node'],
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@preload': path.resolve(__dirname, 'src/preload'),
      '@native': path.resolve(__dirname, 'src/native'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@': path.resolve(__dirname, 'src')
    }
  },
  target: 'electron-main',
  externals: {
    'electron': 'commonjs electron',
    './drag_monitor_darwin.node': 'commonjs ./drag_monitor_darwin.node',
    './build/Release/drag_monitor_darwin.node': 'commonjs ./build/Release/drag_monitor_darwin.node'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'src/native/drag-monitor/build/Release/drag_monitor_darwin.node'),
          to: path.join(__dirname, 'dist/main/build/Release/drag_monitor_darwin.node')
        },
        {
          from: path.join(__dirname, 'src/native/mouse-tracker/darwin/build/Release'),
          to: path.join(__dirname, 'dist/main/build/Release'),
          noErrorOnMissing: true
        }
      ]
    })
  ]
};