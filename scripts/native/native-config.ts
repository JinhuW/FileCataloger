/**
 * @fileoverview Centralized native module configuration
 *
 * This file defines all native modules in the project and their build configurations.
 * Benefits of centralized management:
 * - Single source of truth for all native modules
 * - Consistent versioning and dependency management
 * - Unified build process across all platforms
 * - Easy integration with CI/CD pipelines
 * - Better compatibility guarantees with Electron/Node versions
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const NATIVE_ROOT = path.join(PROJECT_ROOT, 'src', 'native');

export interface NativeModuleConfig {
  name: string;
  displayName: string;
  platforms: string[];
  buildPath: string;
  binding: string;
  targetName: string;
  dependencies?: string[];
  buildArgs?: string[];
  postBuild?: string[];
}

export interface PlatformConfig {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  buildTools: {
    compiler: string;
    flags: string[];
    linkFlags: string[];
  };
}

/**
 * Native modules registry
 * Add new native modules here for automatic build management
 */
export const NATIVE_MODULES: NativeModuleConfig[] = [
  {
    name: 'mouse-tracker',
    displayName: 'Mouse Tracker',
    platforms: ['darwin'], // TODO: Add 'win32', 'linux' when implemented
    buildPath: path.join(NATIVE_ROOT, 'mouse-tracker', 'darwin'),
    binding: 'binding.gyp',
    targetName: 'mouse_tracker_darwin',
    buildArgs: ['--release', '--verbose'],
    postBuild: [
      // Copy built module to expected location for webpack
      'cp build/Release/*.node ../../'
    ]
  },
  {
    name: 'drag-monitor',
    displayName: 'Drag Monitor',
    platforms: ['darwin'], // TODO: Add 'win32', 'linux' when implemented
    buildPath: path.join(NATIVE_ROOT, 'drag-monitor', 'darwin'),
    binding: 'binding.gyp',
    targetName: 'drag_monitor_darwin',
    buildArgs: ['--release', '--verbose'],
    postBuild: [
      // Copy built module to expected location for webpack
      'cp build/Release/*.node ../../'
    ]
  }
];

/**
 * Platform-specific build configurations
 */
export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  'darwin-arm64': {
    platform: 'darwin',
    arch: 'arm64',
    nodeVersion: '20.0.0', // Match Electron's Node version
    electronVersion: '28.0.0', // Current project's Electron version
    buildTools: {
      compiler: 'clang++',
      flags: [
        '-O3',
        '-ffast-math',
        '-march=native',
        '-std=c++17',
        '-fobjc-arc'
      ],
      linkFlags: [
        '-framework CoreGraphics',
        '-framework ApplicationServices',
        '-framework Foundation',
        '-framework Carbon'
      ]
    }
  },
  'darwin-x64': {
    platform: 'darwin',
    arch: 'x64',
    nodeVersion: '20.0.0',
    electronVersion: '28.0.0',
    buildTools: {
      compiler: 'clang++',
      flags: [
        '-O3',
        '-ffast-math',
        '-std=c++17',
        '-fobjc-arc'
      ],
      linkFlags: [
        '-framework CoreGraphics',
        '-framework ApplicationServices',
        '-framework Foundation',
        '-framework Carbon'
      ]
    }
  }
  // TODO: Add Windows and Linux configurations
  // 'win32-x64': { ... },
  // 'linux-x64': { ... }
};

/**
 * Build environment configuration
 */
export const BUILD_CONFIG = {
  // Shared build settings
  concurrency: 4, // Parallel builds
  verboseLogging: true,

  // Paths
  outputDir: path.join(PROJECT_ROOT, 'dist', 'native'),
  cacheDir: path.join(PROJECT_ROOT, '.cache', 'native'),

  // Build optimization
  enableLTO: true, // Link-time optimization
  enablePGO: false, // Profile-guided optimization (experimental)

  // Development settings
  watchMode: false,
  debugSymbols: process.env.NODE_ENV === 'development',

  // CI/CD integration
  artifactRetention: 30, // days
  testTimeout: 300000, // 5 minutes
};

/**
 * Get configuration for current platform
 */
export function getCurrentPlatformConfig(): PlatformConfig {
  const platform = process.platform;
  const arch = process.arch;
  const key = `${platform}-${arch}`;

  const config = PLATFORM_CONFIGS[key];
  if (!config) {
    throw new Error(`Unsupported platform: ${key}. Supported platforms: ${Object.keys(PLATFORM_CONFIGS).join(', ')}`);
  }

  return config;
}

/**
 * Get native modules for current platform
 */
export function getNativeModulesForPlatform(platform: string = process.platform): NativeModuleConfig[] {
  return NATIVE_MODULES.filter(module => module.platforms.includes(platform));
}

/**
 * Validate native module configuration
 */
export function validateConfig(): string[] {
  const errors: string[] = [];

  for (const module of NATIVE_MODULES) {
    if (!module.name || !module.buildPath) {
      errors.push(`Invalid module configuration: ${JSON.stringify(module)}`);
    }

    // Check if build path exists
    try {
      const fs = require('fs');
      if (!fs.existsSync(module.buildPath)) {
        errors.push(`Build path does not exist for module ${module.name}: ${module.buildPath}`);
      }
    } catch (e) {
      errors.push(`Cannot validate build path for module ${module.name}: ${e}`);
    }
  }

  return errors;
}

export default {
  NATIVE_MODULES,
  PLATFORM_CONFIGS,
  BUILD_CONFIG,
  getCurrentPlatformConfig,
  getNativeModulesForPlatform,
  validateConfig
};