const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const BuildInfoPlugin = require('./webpack-plugins/build-info-plugin');

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
        exclude: /node_modules/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.main.json',
            transpileOnly: false // Perform type checking
          }
        }]
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node'],
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
    // Native modules should be externalized
    './mouse_tracker_darwin.node': 'commonjs ./mouse_tracker_darwin.node',
    './drag_monitor_darwin.node': 'commonjs ./drag_monitor_darwin.node',
    'node-gyp-build': 'commonjs node-gyp-build'
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
        path.join(__dirname, 'dist/main/**/*'),
        path.join(__dirname, 'dist/native/**/*'),
        path.join(__dirname, 'dist/shared/**/*')
      ]
    }),
    // Copy native modules to dist/main where they can be directly required
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'src/native/drag-monitor/build/Release/drag_monitor_darwin.node'),
          to: path.join(__dirname, 'dist/main/drag_monitor_darwin.node'),
          noErrorOnMissing: true
        },
        {
          from: path.join(__dirname, 'src/native/mouse-tracker/darwin/build/Release/mouse_tracker_darwin.node'),
          to: path.join(__dirname, 'dist/main/mouse_tracker_darwin.node'),
          noErrorOnMissing: true
        }
      ]
    }),
    // Generate build info file
    new BuildInfoPlugin({
      filename: '../build-info.json' // Output to dist/build-info.json
    }),
    // Create package.json in dist/main for native module resolution
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('CreatePackageJson', () => {
          const packageJson = require('./package.json');
          const mainPackageJson = {
            name: packageJson.name,
            version: packageJson.version,
            main: 'index.js',
            dependencies: packageJson.dependencies
          };
          
          const distPath = path.join(__dirname, 'dist/main/package.json');
          fs.mkdirSync(path.dirname(distPath), { recursive: true });
          fs.writeFileSync(distPath, JSON.stringify(mainPackageJson, null, 2));
        });
      }
    }
  ],
  // Show warnings for missing native modules
  stats: {
    warnings: true,
    errors: true
  }
};