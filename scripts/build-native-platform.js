#!/usr/bin/env node
/**
 * @fileoverview Cross-platform native module build script
 *
 * This script automatically builds the correct native modules for the current platform.
 * It determines the platform and runs electron-rebuild with the appropriate modules.
 */

const { execSync } = require('child_process');
const path = require('path');

const platform = process.platform;

console.log(`\n🔧 Building native modules for platform: ${platform}\n`);

let modules;

switch (platform) {
  case 'darwin':
    modules = 'mouse_tracker_darwin,drag_monitor_darwin';
    console.log('📦 Building macOS native modules (mouse_tracker_darwin, drag_monitor_darwin)');
    break;
  case 'win32':
    modules = 'mouse_tracker_win32,drag_monitor_win32';
    console.log('📦 Building Windows native modules (mouse_tracker_win32, drag_monitor_win32)');
    break;
  case 'linux':
    console.log('⚠️  Linux native modules not yet implemented');
    console.log('Skipping native module build...');
    process.exit(0);
  default:
    console.error(`❌ Unsupported platform: ${platform}`);
    process.exit(1);
}

try {
  const command = `electron-rebuild -f -w ${modules}`;
  console.log(`\n🚀 Running: ${command}\n`);

  execSync(command, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  console.log('\n✅ Native modules built successfully!\n');
} catch (error) {
  console.error('\n❌ Failed to build native modules:', error.message);
  process.exit(1);
}
