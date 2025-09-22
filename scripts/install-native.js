#!/usr/bin/env node
/**
 * @fileoverview Smart native module installation script
 *
 * This script implements intelligent native module installation with multiple fallback strategies:
 * 1. Try prebuild-install for precompiled binaries (fastest)
 * 2. Fall back to electron-rebuild for automatic compilation
 * 3. Final fallback to manual node-gyp build
 *
 * Benefits:
 * - Zero manual steps for most users
 * - Faster installation with prebuilt binaries when available
 * - Automatic Electron version matching
 * - Clear error messages with troubleshooting steps
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class NativeModuleInstaller {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.electronVersion = this.getElectronVersion();
    this.nodeVersion = process.version;
    this.platform = process.platform;
    this.arch = process.arch;
  }

  async install() {
    console.log('🔧 FileCataloger Native Module Auto-Installer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Target: Electron ${this.electronVersion}, Node ${this.nodeVersion}, ${this.platform}-${this.arch}`);

    const strategies = [
      { name: 'Prebuild Install', method: this.tryPrebuildInstall.bind(this) },
      { name: 'Electron Rebuild', method: this.tryElectronRebuild.bind(this) },
      { name: 'Manual Build', method: this.tryManualBuild.bind(this) }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`\\n🔄 Trying: ${strategy.name}...`);
        const success = await strategy.method();

        if (success) {
          console.log(`✅ ${strategy.name} succeeded!`);
          await this.validateInstallation();
          console.log('\\n🎉 Native modules installed successfully!');
          return true;
        }
      } catch (error) {
        console.log(`❌ ${strategy.name} failed: ${error.message}`);
      }
    }

    console.error('\\n💥 All installation strategies failed!');
    this.showTroubleshootingHelp();
    process.exit(1);
  }

  async tryPrebuildInstall() {
    console.log('  📦 Checking for prebuilt binaries...');

    try {
      await this.runCommand('prebuild-install', [
        '--runtime', 'electron',
        '--target', this.electronVersion,
        '--arch', this.arch,
        '--platform', this.platform
      ]);
      return true;
    } catch (error) {
      console.log('  ℹ️  No prebuilt binaries available, will compile from source');
      return false;
    }
  }

  async tryElectronRebuild() {
    console.log('  🔨 Using electron-rebuild (recommended)...');

    await this.runCommand('electron-rebuild', [
      '-f',
      '-w', 'mouse_tracker_darwin,drag_monitor_darwin',
      '--electronVersion', this.electronVersion
    ]);
    return true;
  }

  async tryManualBuild() {
    console.log('  🔧 Manual build fallback...');

    const nativeDir = path.join(this.projectRoot, 'src', 'native');

    // Build mouse-tracker
    const mouseTrackerDir = path.join(nativeDir, 'mouse-tracker', 'darwin');
    if (fs.existsSync(mouseTrackerDir)) {
      process.chdir(mouseTrackerDir);
      await this.runCommand('node-gyp', ['rebuild']);
    }

    // Build drag-monitor
    const dragMonitorDir = path.join(nativeDir, 'drag-monitor');
    if (fs.existsSync(dragMonitorDir)) {
      process.chdir(dragMonitorDir);
      await this.runCommand('node-gyp', ['rebuild']);
    }

    process.chdir(this.projectRoot);
    return true;
  }

  async validateInstallation() {
    console.log('\\n🔍 Validating installation...');

    const distMain = path.join(this.projectRoot, 'dist', 'main');
    const expectedModules = [
      'mouse_tracker_darwin.node',
      'drag_monitor_darwin.node'
    ];

    // Check source modules first
    const mouseTrackerPath = path.join(this.projectRoot, 'src/native/mouse-tracker/darwin/build/Release/mouse_tracker_darwin.node');
    const dragMonitorPath = path.join(this.projectRoot, 'src/native/drag-monitor/build/Release/drag_monitor_darwin.node');

    if (!fs.existsSync(mouseTrackerPath)) {
      throw new Error('Mouse tracker module not built');
    }
    if (!fs.existsSync(dragMonitorPath)) {
      throw new Error('Drag monitor module not built');
    }

    const mouseStats = fs.statSync(mouseTrackerPath);
    const dragStats = fs.statSync(dragMonitorPath);

    console.log(`  ✅ Mouse Tracker: ${Math.round(mouseStats.size / 1024)}KB`);
    console.log(`  ✅ Drag Monitor: ${Math.round(dragStats.size / 1024)}KB`);

    // Try to load modules to verify they work
    try {
      require(mouseTrackerPath);
      require(dragMonitorPath);
      console.log('  ✅ Modules load successfully');
    } catch (error) {
      throw new Error(`Module validation failed: ${error.message}`);
    }
  }

  getElectronVersion() {
    try {
      const packageJson = require(path.join(this.projectRoot, 'package.json'));
      const electronDep = packageJson.devDependencies?.electron || packageJson.dependencies?.electron;
      return electronDep ? electronDep.replace('^', '') : '37.4.0';
    } catch (error) {
      return '37.4.0'; // Fallback version
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        ...options
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command '${command} ${args.join(' ')}' failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  showTroubleshootingHelp() {
    console.log('\\n🆘 Troubleshooting Native Module Installation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\\n1. **Install build tools:**');
    console.log('   xcode-select --install                    # macOS');
    console.log('   npm install -g node-gyp                   # Global node-gyp');
    console.log('\\n2. **Check Python version:**');
    console.log('   python3 --version                         # Should be 3.x');
    console.log('\\n3. **Manual rebuild:**');
    console.log('   yarn rebuild:native                       # Force rebuild');
    console.log('\\n4. **Clean build:**');
    console.log('   yarn clean && yarn build:native:clean     # Clean everything');
    console.log('\\n5. **Check logs:**');
    console.log('   yarn build:native:verbose                 # Verbose build output');
    console.log('\\n📋 For more help, see: src/native/README.md');
  }
}

// Run installer if called directly
if (require.main === module) {
  const installer = new NativeModuleInstaller();
  installer.install().catch((error) => {
    console.error('Installation failed:', error);
    process.exit(1);
  });
}

module.exports = { NativeModuleInstaller };