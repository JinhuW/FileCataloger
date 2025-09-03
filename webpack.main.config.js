const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
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
        use: [{ loader: 'ts-loader' }]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
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