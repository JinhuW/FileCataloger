const path = require('path');
const { merge } = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const webpack = require('webpack');
const common = require('./webpack.common');

const projectRoot = path.resolve(__dirname, '../..');

module.exports = merge(common, {
  entry: path.resolve(projectRoot, 'src/main/index.ts'),
  output: {
    path: path.resolve(projectRoot, 'dist/main'),
    filename: 'index.js'
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        include: /src/,
        exclude: [/node_modules/, /src\/native\/test/],
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(projectRoot, 'config/tsconfig.main.json'),
            transpileOnly: false
          }
        }]
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  },

  target: 'electron-main',

  externals: {
    // Native modules should be externalized
    './mouse_tracker_darwin.node': 'commonjs ./mouse_tracker_darwin.node',
    './drag_monitor_darwin.node': 'commonjs ./drag_monitor_darwin.node',
    'node-gyp-build': 'commonjs node-gyp-build',
    'better-sqlite3': 'commonjs better-sqlite3'
  },

  externalsType: 'commonjs',

  node: {
    __dirname: false,
    __filename: false
  },

  plugins: [
    // Clean dist directories before building
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.join(projectRoot, 'dist/main/**/*'),
        path.join(projectRoot, 'dist/native/**/*'),
        path.join(projectRoot, 'dist/shared/**/*')
      ]
    }),

    // Copy native modules to dist/main where they can be directly required
    new CopyWebpackPlugin({
      patterns: [
        // Copy main process assets (e.g., tray/logo icons)
        {
          from: path.join(projectRoot, 'src/main/assets/**/*'),
          to: path.join(projectRoot, 'dist/main/assets/[name][ext]'),
          noErrorOnMissing: true
        },
        // Copy all native modules built by centralized build system
        {
          from: path.join(projectRoot, 'src/native/mouse-tracker/darwin/build/Release/mouse_tracker_darwin.node'),
          to: path.join(projectRoot, 'dist/main/mouse_tracker_darwin.node'),
          noErrorOnMissing: true
        },
        {
          from: path.join(projectRoot, 'src/native/drag-monitor/darwin/build/Release/drag_monitor_darwin.node'),
          to: path.join(projectRoot, 'dist/main/drag_monitor_darwin.node'),
          noErrorOnMissing: true
        },
        // Generate package.json in dist/main for native module resolution
        {
          from: path.join(projectRoot, 'package.json'),
          to: path.join(projectRoot, 'dist/main/package.json'),
          transform: (content) => {
            const packageJson = JSON.parse(content.toString());
            const mainPackageJson = {
              name: packageJson.name,
              version: packageJson.version,
              main: 'index.js',
              dependencies: packageJson.dependencies
            };
            return JSON.stringify(mainPackageJson, null, 2);
          }
        }
      ]
    }),

    // Generate build manifest with metadata
    new WebpackManifestPlugin({
      fileName: '../build-info.json',
      generate: (seed, files, entrypoints) => {
        const packageJson = require(path.join(projectRoot, 'package.json'));
        return {
          timestamp: new Date().toISOString(),
          version: packageJson.version,
          buildDate: new Date().toLocaleDateString(),
          buildTime: new Date().toLocaleTimeString(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          webpack: webpack.version,
          mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          entrypoints,
          files: files.map(file => file.path)
        };
      }
    })
  ]
});