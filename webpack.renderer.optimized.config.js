const rules = require('./webpack.rules');
const path = require('path');

// Optimized renderer configuration with performance improvements
module.exports = {
  module: {
    rules: [
      ...rules,
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader'
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@components': path.resolve(__dirname, './src/renderer/components'),
      '@assets': path.resolve(__dirname, './src/renderer/assets'),
    },
  },
  optimization: {
    // Enable production optimizations
    minimize: process.env.NODE_ENV === 'production',
    
    // Split chunks for better caching
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react',
          priority: 20,
        },
        framer: {
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          name: 'framer',
          priority: 15,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    
    // Keep runtime chunk separate for long-term caching
    runtimeChunk: 'single',
    
    // Use deterministic module ids for better caching
    moduleIds: 'deterministic',
  },
  
  // Performance hints
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000, // 500 KB
    maxAssetSize: 256000, // 250 KB
  },
  
  // Production-specific optimizations
  ...(process.env.NODE_ENV === 'production' && {
    mode: 'production',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      usedExports: true,
      sideEffects: false,
      concatenateModules: true,
    },
  }),
};