#!/usr/bin/env node
/**
 * @fileoverview Native module test runner
 *
 * This script runs comprehensive tests for all native modules to ensure they
 * work correctly after build and optimization changes.
 *
 * Usage:
 *   yarn test:native              # Run all tests
 *   yarn test:native --smoke      # Run smoke tests only
 *   yarn test:native --benchmark  # Run performance benchmark
 *   yarn test:native --validate   # Validate build integrity
 */

import { performance } from 'perf_hooks';

async function main() {
  const args = process.argv.slice(2);

  console.log('🧪 FileCataloger Native Module Test Runner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Import test modules dynamically to handle missing dependencies
    const {
      NativeModuleTestRunner,
      runSmokeTests,
      runPerformanceBenchmark,
      validateBuildIntegrity
    } = await import('../src/native/test/nativeModuleTests');

    const startTime = performance.now();

    if (args.includes('--smoke')) {
      console.log('🔥 Running smoke tests...');
      const passed = await runSmokeTests();
      process.exit(passed ? 0 : 1);
    }

    if (args.includes('--benchmark')) {
      console.log('⚡ Running performance benchmark...');
      await runPerformanceBenchmark();
      process.exit(0);
    }

    if (args.includes('--validate')) {
      console.log('🔍 Validating build integrity...');
      const valid = await validateBuildIntegrity();
      process.exit(valid ? 0 : 1);
    }

    // Run comprehensive tests by default
    console.log('🧪 Running comprehensive native module tests...');

    const testRunner = new NativeModuleTestRunner();
    const results = await testRunner.runAllTests();

    const totalDuration = performance.now() - startTime;
    console.log(`\\n⏱️  Total test duration: ${totalDuration.toFixed(2)}ms`);

    // Exit with appropriate code
    const allPassed = testRunner.allTestsPassed();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Test runner failed:', error);
    console.error('\\n💡 Make sure native modules are built:');
    console.error('   yarn build:native');
    process.exit(1);
  }
}

// Handle CLI arguments
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Native Module Test Runner

Usage: yarn test:native [options]

Options:
  --smoke       Run smoke tests only (quick validation)
  --benchmark   Run performance benchmark
  --validate    Validate build integrity only
  --help, -h    Show this help message

Examples:
  yarn test:native                # Run all comprehensive tests
  yarn test:native --smoke        # Quick validation
  yarn test:native --benchmark    # Performance testing
`);
  process.exit(0);
}

// Run main function
main().catch(console.error);