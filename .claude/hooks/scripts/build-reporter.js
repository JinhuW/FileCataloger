#!/usr/bin/env node

/**
 * Build Reporter for FileCataloger Auto-Rebuild Hook
 * Provides clear, formatted feedback about build status
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Emoji indicators
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  building: '🔨',
  testing: '🧪',
  checking: '🔍',
  restart: '🔄',
  rocket: '🚀',
  clock: '⏱️',
  folder: '📁',
  package: '📦'
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Create a progress bar
 */
function createProgressBar(current, total, width = 30) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

/**
 * Print a formatted section header
 */
function printHeader(title, icon = '📋') {
  const line = '═'.repeat(50);
  console.log(`\n${colors.blue}${line}${colors.reset}`);
  console.log(`${icon} ${colors.bold}${title}${colors.reset}`);
  console.log(`${colors.blue}${line}${colors.reset}\n`);
}

/**
 * Print a build step
 */
function printStep(step, status, details = null) {
  const statusIcon = {
    running: '⏳',
    success: icons.success,
    error: icons.error,
    warning: icons.warning,
    skipped: '⏭️'
  }[status] || icons.info;

  const statusColor = {
    running: colors.yellow,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    skipped: colors.dim
  }[status] || colors.reset;

  console.log(`  ${statusIcon} ${statusColor}${step}${colors.reset}`);

  if (details) {
    const detailLines = Array.isArray(details) ? details : [details];
    detailLines.forEach(line => {
      console.log(`     ${colors.dim}${line}${colors.reset}`);
    });
  }
}

/**
 * Report build analysis
 */
function reportAnalysis(analysis) {
  printHeader('Build Analysis', icons.checking);

  console.log(`  ${icons.folder} Changed files: ${colors.bold}${analysis.fileCount}${colors.reset}`);
  console.log(`  ${icons.package} Categories: ${analysis.categories.join(', ')}`);
  console.log(`  🎯 Strategy: ${colors.cyan}${analysis.strategy}${colors.reset}`);

  if (analysis.requiresNativeRebuild) {
    console.log(`  ${icons.warning} ${colors.yellow}Native module rebuild required${colors.reset}`);
  }

  if (analysis.requiresRestart) {
    console.log(`  ${icons.restart} ${colors.yellow}Application restart required${colors.reset}`);
  }

  console.log('');
}

/**
 * Report command execution
 */
async function reportCommandExecution(commands, dryRun = false) {
  printHeader('Build Execution', icons.building);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const stepNumber = `[${i + 1}/${commands.length}]`;

    printStep(`${stepNumber} ${command.description}`, 'running');

    if (dryRun) {
      console.log(`     ${colors.dim}Command: ${command.cmd}${colors.reset}`);
      results.push({ ...command, status: 'skipped', duration: 0 });
      continue;
    }

    const stepStart = Date.now();
    try {
      const output = execSync(command.cmd, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const duration = Date.now() - stepStart;

      // Move cursor up and rewrite with success
      process.stdout.write('\x1b[1A\x1b[2K');
      printStep(
        `${stepNumber} ${command.description}`,
        'success',
        `Completed in ${formatDuration(duration)}`
      );

      results.push({
        ...command,
        status: 'success',
        duration,
        output: output.slice(0, 200)
      });

    } catch (error) {
      const duration = Date.now() - stepStart;

      // Move cursor up and rewrite with error
      process.stdout.write('\x1b[1A\x1b[2K');

      if (command.skipOnFail) {
        printStep(
          `${stepNumber} ${command.description}`,
          'warning',
          ['Non-critical failure (continuing)', error.message.split('\n')[0]]
        );
        results.push({ ...command, status: 'warning', duration, error: error.message });
      } else if (command.critical) {
        printStep(
          `${stepNumber} ${command.description}`,
          'error',
          ['Critical failure', error.message.split('\n')[0]]
        );
        results.push({ ...command, status: 'error', duration, error: error.message });
        break; // Stop on critical errors
      } else {
        printStep(
          `${stepNumber} ${command.description}`,
          'warning',
          error.message.split('\n')[0]
        );
        results.push({ ...command, status: 'warning', duration, error: error.message });
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  return { results, totalDuration };
}

/**
 * Report build summary
 */
function reportSummary(results, totalDuration) {
  printHeader('Build Summary', icons.info);

  const successful = results.filter(r => r.status === 'success').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const errors = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  const overallStatus = errors > 0 ? 'failed' :
                        warnings > 0 ? 'completed with warnings' :
                        'successful';

  console.log(`  ${icons.clock} Total time: ${colors.bold}${formatDuration(totalDuration)}${colors.reset}`);
  console.log(`  ${icons.success} Successful: ${colors.green}${successful}${colors.reset}`);

  if (warnings > 0) {
    console.log(`  ${icons.warning} Warnings: ${colors.yellow}${warnings}${colors.reset}`);
  }

  if (errors > 0) {
    console.log(`  ${icons.error} Errors: ${colors.red}${errors}${colors.reset}`);
  }

  if (skipped > 0) {
    console.log(`  ⏭️  Skipped: ${colors.dim}${skipped}${colors.reset}`);
  }

  console.log('');

  // Overall status message
  const statusColor = errors > 0 ? colors.red : warnings > 0 ? colors.yellow : colors.green;
  const statusIcon = errors > 0 ? icons.error : warnings > 0 ? icons.warning : icons.success;

  console.log(`${statusIcon} ${statusColor}${colors.bold}Build ${overallStatus}${colors.reset}\n`);

  // Next steps
  if (errors === 0) {
    console.log(`${icons.rocket} ${colors.cyan}Ready to continue development!${colors.reset}`);
  } else {
    console.log(`${icons.error} ${colors.red}Please fix the errors before continuing${colors.reset}`);
  }
}

/**
 * Live progress reporter for long-running builds
 */
class LiveProgressReporter {
  constructor(totalSteps) {
    this.totalSteps = totalSteps;
    this.currentStep = 0;
    this.startTime = Date.now();
  }

  updateStep(stepName, status) {
    this.currentStep++;
    const elapsed = Date.now() - this.startTime;
    const progress = createProgressBar(this.currentStep, this.totalSteps);

    // Clear line and update
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      `${progress} ${stepName} ${colors.dim}(${formatDuration(elapsed)})${colors.reset}`
    );

    if (status === 'complete') {
      console.log(` ${icons.success}`);
    } else if (status === 'error') {
      console.log(` ${icons.error}`);
    }
  }

  finish() {
    const totalTime = Date.now() - this.startTime;
    console.log(`\n${icons.success} Build completed in ${formatDuration(totalTime)}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'report';

  if (mode === 'live') {
    // Live progress mode
    const reporter = new LiveProgressReporter(5);

    // Simulate build steps
    const steps = [
      'Type checking',
      'Linting',
      'Building main process',
      'Building renderer',
      'Running tests'
    ];

    for (const step of steps) {
      reporter.updateStep(step, 'running');
      await new Promise(resolve => setTimeout(resolve, 1000));
      reporter.updateStep(step, 'complete');
    }

    reporter.finish();

  } else if (mode === 'analysis') {
    // Read analysis from stdin or file
    const analysisData = args[1] ?
      JSON.parse(fs.readFileSync(args[1], 'utf-8')) :
      JSON.parse(fs.readFileSync('/tmp/claude_fc_analysis.json', 'utf-8'));

    reportAnalysis(analysisData);

    if (analysisData.commands && analysisData.commands.length > 0) {
      const { results, totalDuration } = await reportCommandExecution(
        analysisData.commands,
        args.includes('--dry-run')
      );
      reportSummary(results, totalDuration);
    }

  } else {
    // Default report mode
    console.log(`${icons.info} FileCataloger Build Reporter`);
    console.log('Usage: build-reporter.js [live|analysis] [options]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  printHeader,
  printStep,
  reportAnalysis,
  reportCommandExecution,
  reportSummary,
  LiveProgressReporter
};