#!/usr/bin/env node
/**
 * @fileoverview Cross-platform native module build script
 *
 * This script builds the native modules for the current platform.
 * It automatically detects the platform and runs the appropriate build commands.
 *
 * Usage:
 *   node scripts/build-native.js          # Normal build
 *   node scripts/build-native.js --force  # Clean rebuild
 *   node scripts/build-native.js --verbose # Verbose output
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.platform;
const args = process.argv.slice(2);
const isForce = args.includes('--force');
const isVerbose = args.includes('--verbose');

/**
 * Get the native module names based on the current platform
 */
function getModuleNames() {
  if (platform === 'darwin') {
    return 'mouse_tracker_darwin,drag_monitor_darwin';
  } else if (platform === 'win32') {
    return 'mouse_tracker_win,drag_monitor_win';
  } else {
    console.log(`Platform '${platform}' is not supported for native modules`);
    console.log('Supported platforms: darwin (macOS), win32 (Windows)');
    process.exit(0);
  }
}

/**
 * Build native modules using electron-rebuild
 */
function buildNativeModules() {
  const moduleNames = getModuleNames();
  const flags = [];

  flags.push('-f'); // Force rebuild
  flags.push('-w', moduleNames);

  if (isForce) {
    flags.push('--force');
  }

  if (isVerbose) {
    flags.push('--debug');
  }

  const command = `electron-rebuild ${flags.join(' ')}`;

  console.log(`Building native modules for ${platform}...`);
  console.log(`Modules: ${moduleNames}`);
  console.log(`Command: ${command}\n`);

  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Ensure proper node-gyp configuration
        npm_config_runtime: 'electron',
        npm_config_disturl: 'https://electronjs.org/headers'
      }
    });

    console.log('\nNative modules built successfully!');
    validateBuild();
  } catch (error) {
    console.error('\nFailed to build native modules');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Validate that the native modules were built correctly
 */
function validateBuild() {
  const moduleSuffix = platform === 'darwin' ? 'darwin' : 'win';
  const modules = [
    {
      name: 'mouse_tracker',
      paths: [
        path.join(projectRoot, `src/native/mouse-tracker/build/Release/mouse_tracker_${moduleSuffix}.node`),
        path.join(projectRoot, `src/native/mouse-tracker/${moduleSuffix}/build/Release/mouse_tracker_${moduleSuffix}.node`)
      ]
    },
    {
      name: 'drag_monitor',
      paths: [
        path.join(projectRoot, `src/native/drag-monitor/build/Release/drag_monitor_${moduleSuffix}.node`)
      ]
    }
  ];

  console.log('\nValidating build...');

  for (const module of modules) {
    const foundPath = module.paths.find(p => fs.existsSync(p));

    if (!foundPath) {
      console.error(`  Module ${module.name}_${moduleSuffix}.node not found!`);
      console.error(`  Checked paths:`);
      module.paths.forEach(p => console.error(`    - ${p}`));
      process.exit(1);
    }

    const stats = fs.statSync(foundPath);
    console.log(`  ${module.name}_${moduleSuffix}.node: ${Math.round(stats.size / 1024)}KB`);
  }

  console.log('\nAll native modules validated successfully!');
}

// Run the build
buildNativeModules();
