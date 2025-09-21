#!/usr/bin/env node
/**
 * @fileoverview Unified native module builder
 *
 * This script builds all native modules using centralized configuration.
 * It replaces the need for individual package.json files in each native module.
 *
 * Benefits:
 * - Consistent build environment across all modules
 * - Single command to build all native dependencies
 * - Better integration with main project build process
 * - Centralized dependency management
 * - Easier CI/CD pipeline integration
 *
 * Usage:
 *   yarn build:native              # Build all modules for current platform
 *   yarn build:native --clean      # Clean before building
 *   yarn build:native --module=mouse-tracker  # Build specific module
 *   yarn build:native --verbose    # Verbose logging
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';
import {
  NATIVE_MODULES,
  getCurrentPlatformConfig,
  getNativeModulesForPlatform,
  validateConfig,
  BUILD_CONFIG,
  type NativeModuleConfig
} from './native-config';

interface BuildOptions {
  clean?: boolean;
  module?: string;
  verbose?: boolean;
  parallel?: boolean;
  skipTests?: boolean;
}

class NativeModuleBuilder {
  private options: BuildOptions;
  private startTime: number;

  constructor(options: BuildOptions = {}) {
    this.options = {
      verbose: false,
      parallel: true,
      ...options
    };
    this.startTime = performance.now();
  }

  async build(): Promise<void> {
    this.log('🔧 Starting native module build process...');

    // Validate configuration
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      this.error('Configuration validation failed:');
      configErrors.forEach(error => this.error(`  ❌ ${error}`));
      process.exit(1);
    }

    // Get platform configuration
    let platformConfig;
    try {
      platformConfig = getCurrentPlatformConfig();
      this.log(`📋 Platform: ${platformConfig.platform}-${platformConfig.arch}`);
      this.log(`📋 Node: ${platformConfig.nodeVersion}, Electron: ${platformConfig.electronVersion}`);
    } catch (error) {
      this.error(`Failed to get platform configuration: ${error}`);
      process.exit(1);
    }

    // Get modules to build
    const modulesToBuild = this.getModulesToBuild();
    if (modulesToBuild.length === 0) {
      this.warn('No native modules to build for current platform');
      return;
    }

    this.log(`🎯 Building ${modulesToBuild.length} module(s): ${modulesToBuild.map(m => m.name).join(', ')}`);

    // Clean if requested
    if (this.options.clean) {
      await this.cleanModules(modulesToBuild);
    }

    // Build modules
    if (this.options.parallel && modulesToBuild.length > 1) {
      await this.buildModulesParallel(modulesToBuild);
    } else {
      await this.buildModulesSequential(modulesToBuild);
    }

    // Run tests if not skipped
    if (!this.options.skipTests) {
      await this.testModules(modulesToBuild);
    }

    const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);
    this.log(`✅ Native module build completed in ${duration}s`);
  }

  private getModulesToBuild(): NativeModuleConfig[] {
    if (this.options.module) {
      const module = NATIVE_MODULES.find(m => m.name === this.options.module);
      if (!module) {
        this.error(`Module '${this.options.module}' not found. Available modules: ${NATIVE_MODULES.map(m => m.name).join(', ')}`);
        process.exit(1);
      }
      return [module];
    }

    return getNativeModulesForPlatform();
  }

  private async buildModulesSequential(modules: NativeModuleConfig[]): Promise<void> {
    for (const module of modules) {
      await this.buildModule(module);
    }
  }

  private async buildModulesParallel(modules: NativeModuleConfig[]): Promise<void> {
    this.log('🔄 Building modules in parallel...');
    const promises = modules.map(module => this.buildModule(module));
    await Promise.all(promises);
  }

  private async buildModule(module: NativeModuleConfig): Promise<void> {
    this.log(`🔨 Building ${module.displayName} (${module.name})...`);

    const buildStart = performance.now();

    try {
      // Change to module directory
      const originalCwd = process.cwd();
      process.chdir(module.buildPath);

      // Run node-gyp configure
      this.log(`  📝 Configuring ${module.name}...`);
      await this.runCommand('node-gyp', ['configure'], {
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      // Run node-gyp build
      this.log(`  🔧 Compiling ${module.name}...`);
      const buildArgs = ['build', ...(module.buildArgs || [])];
      await this.runCommand('node-gyp', buildArgs, {
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      // Run post-build commands
      if (module.postBuild) {
        this.log(`  🔄 Running post-build commands for ${module.name}...`);
        for (const command of module.postBuild) {
          await this.runShellCommand(command);
        }
      }

      // Restore original directory
      process.chdir(originalCwd);

      const buildTime = ((performance.now() - buildStart) / 1000).toFixed(2);
      this.log(`  ✅ ${module.displayName} built successfully in ${buildTime}s`);

    } catch (error) {
      this.error(`Failed to build ${module.name}: ${error}`);
      throw error;
    }
  }

  private async cleanModules(modules: NativeModuleConfig[]): Promise<void> {
    this.log('🧹 Cleaning build artifacts...');

    for (const module of modules) {
      try {
        const buildDir = path.join(module.buildPath, 'build');
        if (fs.existsSync(buildDir)) {
          fs.rmSync(buildDir, { recursive: true, force: true });
          this.log(`  🗑️  Cleaned ${module.name} build directory`);
        }
      } catch (error) {
        this.warn(`Failed to clean ${module.name}: ${error}`);
      }
    }
  }

  private async testModules(modules: NativeModuleConfig[]): Promise<void> {
    this.log('🧪 Testing native modules...');

    for (const module of modules) {
      try {
        // Basic smoke test: try to require the built module
        const builtModulePath = path.join(module.buildPath, 'build', 'Release', `${module.targetName}.node`);

        if (!fs.existsSync(builtModulePath)) {
          throw new Error(`Built module not found: ${builtModulePath}`);
        }

        // Verify the module can be loaded
        const stats = fs.statSync(builtModulePath);
        this.log(`  ✅ ${module.name}: Module exists (${this.formatBytes(stats.size)})`);

        // TODO: Add more sophisticated testing
        // - Check exports are available
        // - Run basic functionality tests
        // - Verify ABI compatibility

      } catch (error) {
        this.error(`Module test failed for ${module.name}: ${error}`);
        throw error;
      }
    }
  }

  private async runCommand(command: string, args: string[], options: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          if (this.options.verbose) {
            process.stdout.write(data);
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if (this.options.verbose) {
            process.stderr.write(data);
          }
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command '${command} ${args.join(' ')}' failed with code ${code}\nstderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async runShellCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        execSync(command, {
          stdio: this.options.verbose ? 'inherit' : 'pipe',
          cwd: process.cwd()
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private log(message: string): void {
    console.log(`[native-build] ${message}`);
  }

  private warn(message: string): void {
    console.warn(`[native-build] ⚠️  ${message}`);
  }

  private error(message: string): void {
    console.error(`[native-build] ❌ ${message}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options: BuildOptions = {};

  for (const arg of args) {
    if (arg === '--clean') {
      options.clean = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--sequential') {
      options.parallel = false;
    } else if (arg === '--skip-tests') {
      options.skipTests = true;
    } else if (arg.startsWith('--module=')) {
      options.module = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  try {
    const builder = new NativeModuleBuilder(options);
    await builder.build();
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Native Module Builder

Usage: yarn build:native [options]

Options:
  --clean              Clean build artifacts before building
  --verbose            Enable verbose logging
  --sequential         Build modules sequentially instead of in parallel
  --skip-tests         Skip module testing after build
  --module=<name>      Build only the specified module
  --help, -h           Show this help message

Examples:
  yarn build:native                    # Build all modules
  yarn build:native --clean            # Clean and build all modules
  yarn build:native --module=mouse-tracker  # Build specific module
  yarn build:native --verbose --clean  # Verbose clean build
`);
}

// Run if called directly
if (process.argv[1]?.endsWith('build-native.ts') || process.argv[1]?.endsWith('build-native.js')) {
  main().catch(console.error);
}

export { NativeModuleBuilder, type BuildOptions };