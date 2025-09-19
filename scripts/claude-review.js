#!/usr/bin/env node

/**
 * Claude Code Review Integration Script
 * Integrates with Claude Code agents for automated code review
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Configuration
const CONFIG = {
  agentsDir: '.claude/agents',
  cacheDir: '.claude/review-cache',
  reportsDir: '.claude/review-reports',
  hookConfig: '.claude/hooks/pre-stage-review.json',
  maxFilesPerReview: 10,
  supportedExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  excludePatterns: [
    'node_modules',
    'dist',
    'out',
    '.next',
    'coverage',
    '.test.',
    '.spec.'
  ]
};

class ClaudeReviewer {
  constructor() {
    this.ensureDirectories();
    this.loadConfig();
  }

  ensureDirectories() {
    [CONFIG.cacheDir, CONFIG.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG.hookConfig)) {
        const config = JSON.parse(fs.readFileSync(CONFIG.hookConfig, 'utf8'));
        Object.assign(CONFIG, config.config);
      }
    } catch (error) {
      console.warn(`${colors.yellow}⚠️  Could not load hook config: ${error.message}${colors.reset}`);
    }
  }

  log(level, message) {
    const icons = {
      info: '📘',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      review: '🔍'
    };

    const levelColors = {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
      review: colors.cyan
    };

    console.log(`${levelColors[level]}${icons[level]} ${message}${colors.reset}`);
  }

  isFileSupported(filePath) {
    const ext = path.extname(filePath);
    return CONFIG.supportedExtensions.includes(ext);
  }

  shouldExclude(filePath) {
    return CONFIG.excludePatterns.some(pattern => filePath.includes(pattern));
  }

  generateCacheKey(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = require('crypto').createHash('sha256');
      hash.update(filePath + stats.mtime.getTime() + content);
      return hash.digest('hex').substring(0, 16);
    } catch (error) {
      return null;
    }
  }

  getCachedReview(filePath) {
    const cacheKey = this.generateCacheKey(filePath);
    if (!cacheKey) return null;

    const cacheFile = path.join(CONFIG.cacheDir, `${cacheKey}.json`);

    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const age = Date.now() - cache.timestamp;

        // Cache expires after 1 hour
        if (age < 3600000) {
          return cache.review;
        }
      } catch (error) {
        // Invalid cache, ignore
      }
    }

    return null;
  }

  saveCachedReview(filePath, review) {
    const cacheKey = this.generateCacheKey(filePath);
    if (!cacheKey) return;

    const cacheFile = path.join(CONFIG.cacheDir, `${cacheKey}.json`);

    try {
      fs.writeFileSync(cacheFile, JSON.stringify({
        filePath,
        timestamp: Date.now(),
        review
      }, null, 2));
    } catch (error) {
      // Cache write failed, continue anyway
    }
  }

  runBasicChecks(filePath, content) {
    const issues = {
      critical: [],
      warnings: [],
      suggestions: []
    };

    // Check for console.log
    if (content.includes('console.log')) {
      issues.warnings.push('Contains console.log statements (use Logger module instead)');
    }

    // Check for any type in TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      if (content.match(/:\s*any(?:\s|;|,|\))/)) {
        issues.warnings.push('Uses "any" type (consider specific types)');
      }

      // Check for missing return types
      if (content.match(/function\s+\w+\s*\([^)]*\)\s*{/) ||
          content.match(/=>\s*{/)) {
        if (!content.includes(': void') && !content.includes('Promise<')) {
          issues.suggestions.push('Some functions may be missing explicit return types');
        }
      }
    }

    // Check for TODO/FIXME comments
    const todoMatch = content.match(/\/\/\s*(TODO|FIXME|XXX|HACK)/gi);
    if (todoMatch) {
      issues.suggestions.push(`Contains ${todoMatch.length} TODO/FIXME comments`);
    }

    // Check for error handling
    if (content.includes('async ') || content.includes('await ')) {
      if (!content.includes('try') || !content.includes('catch')) {
        issues.warnings.push('Async code may be missing error handling');
      }
    }

    // Check for potential security issues
    if (content.includes('eval(') || content.includes('new Function(')) {
      issues.critical.push('Contains potentially dangerous eval or Function constructor');
    }

    if (content.includes('innerHTML')) {
      issues.warnings.push('Uses innerHTML (consider textContent or sanitization)');
    }

    // Check for large functions
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{|=>\s*{/g);
    if (functionMatches && functionMatches.length > 20) {
      issues.suggestions.push('File contains many functions, consider splitting');
    }

    return issues;
  }

  async reviewFile(filePath) {
    // Check cache first
    const cached = this.getCachedReview(filePath);
    if (cached) {
      this.log('info', `Using cached review for ${filePath}`);
      return cached;
    }

    this.log('review', `Reviewing ${filePath}`);

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const issues = this.runBasicChecks(filePath, content);

      // Run TypeScript compiler check
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        try {
          execSync(`npx tsc --noEmit --skipLibCheck "${filePath}"`, {
            stdio: 'pipe'
          });
        } catch (error) {
          issues.critical.push('TypeScript compilation errors');
        }
      }

      // Run ESLint
      try {
        execSync(`npx eslint "${filePath}" --format json`, {
          stdio: 'pipe'
        });
      } catch (error) {
        const output = error.stdout?.toString() || '';
        if (output) {
          try {
            const results = JSON.parse(output);
            const fileResult = results[0];
            if (fileResult && fileResult.errorCount > 0) {
              issues.critical.push(`ESLint: ${fileResult.errorCount} errors`);
            }
            if (fileResult && fileResult.warningCount > 0) {
              issues.warnings.push(`ESLint: ${fileResult.warningCount} warnings`);
            }
          } catch {
            // JSON parse failed, skip
          }
        }
      }

      const review = {
        filePath,
        timestamp: Date.now(),
        issues,
        passed: issues.critical.length === 0
      };

      // Cache the review
      this.saveCachedReview(filePath, review);

      return review;
    } catch (error) {
      this.log('error', `Failed to review ${filePath}: ${error.message}`);
      return {
        filePath,
        timestamp: Date.now(),
        issues: {
          critical: [`Review failed: ${error.message}`],
          warnings: [],
          suggestions: []
        },
        passed: false
      };
    }
  }

  formatReview(review) {
    const { filePath, issues, passed } = review;

    console.log('');
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📄 ${filePath}${colors.reset}`);

    if (passed && issues.warnings.length === 0 && issues.suggestions.length === 0) {
      this.log('success', 'No issues found');
      return;
    }

    if (issues.critical.length > 0) {
      console.log(`${colors.red}🚨 Critical Issues:${colors.reset}`);
      issues.critical.forEach(issue => {
        console.log(`   ${colors.red}• ${issue}${colors.reset}`);
      });
    }

    if (issues.warnings.length > 0) {
      console.log(`${colors.yellow}⚠️  Warnings:${colors.reset}`);
      issues.warnings.forEach(warning => {
        console.log(`   ${colors.yellow}• ${warning}${colors.reset}`);
      });
    }

    if (issues.suggestions.length > 0) {
      console.log(`${colors.cyan}💡 Suggestions:${colors.reset}`);
      issues.suggestions.forEach(suggestion => {
        console.log(`   ${colors.cyan}• ${suggestion}${colors.reset}`);
      });
    }
  }

  async generateReport(reviews) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportFile = path.join(CONFIG.reportsDir, `review-${timestamp}.md`);

    let report = '# Code Review Report\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    report += `Files reviewed: ${reviews.length}\n\n`;

    let criticalCount = 0;
    let warningCount = 0;
    let passedCount = 0;

    reviews.forEach(review => {
      if (review.passed) passedCount++;
      criticalCount += review.issues.critical.length;
      warningCount += review.issues.warnings.length;
    });

    report += '## Summary\n\n';
    report += `- ✅ Passed: ${passedCount}/${reviews.length}\n`;
    report += `- 🚨 Critical issues: ${criticalCount}\n`;
    report += `- ⚠️  Warnings: ${warningCount}\n\n`;

    report += '## Detailed Results\n\n';

    reviews.forEach(review => {
      report += `### ${review.filePath}\n\n`;

      if (review.passed && review.issues.warnings.length === 0 && review.issues.suggestions.length === 0) {
        report += '✅ No issues found\n\n';
      } else {
        if (review.issues.critical.length > 0) {
          report += '#### Critical Issues\n';
          review.issues.critical.forEach(issue => {
            report += `- ${issue}\n`;
          });
          report += '\n';
        }

        if (review.issues.warnings.length > 0) {
          report += '#### Warnings\n';
          review.issues.warnings.forEach(warning => {
            report += `- ${warning}\n`;
          });
          report += '\n';
        }

        if (review.issues.suggestions.length > 0) {
          report += '#### Suggestions\n';
          review.issues.suggestions.forEach(suggestion => {
            report += `- ${suggestion}\n`;
          });
          report += '\n';
        }
      }
    });

    try {
      fs.writeFileSync(reportFile, report);
      this.log('info', `Report saved to ${reportFile}`);
    } catch (error) {
      this.log('error', `Failed to save report: ${error.message}`);
    }
  }

  async cleanCache() {
    const files = fs.readdirSync(CONFIG.cacheDir);
    let cleaned = 0;

    files.forEach(file => {
      const filePath = path.join(CONFIG.cacheDir, file);
      try {
        const cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const age = Date.now() - cache.timestamp;

        // Remove cache files older than 24 hours
        if (age > 86400000) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {
        // Invalid cache file, remove it
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.log('info', `Cleaned ${cleaned} old cache files`);
    }
  }

  async run(files) {
    console.log(`${colors.cyan}🤖 Claude Code Review${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    // Filter and validate files
    const filesToReview = files
      .filter(f => this.isFileSupported(f))
      .filter(f => !this.shouldExclude(f))
      .filter(f => fs.existsSync(f))
      .slice(0, CONFIG.maxFilesPerReview);

    if (filesToReview.length === 0) {
      this.log('info', 'No files to review');
      return 0;
    }

    this.log('info', `Reviewing ${filesToReview.length} files...`);

    // Review all files
    const reviews = [];
    for (const file of filesToReview) {
      const review = await this.reviewFile(file);
      reviews.push(review);
      this.formatReview(review);
    }

    // Generate summary
    console.log('');
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}📊 Review Summary${colors.reset}`);

    const failed = reviews.filter(r => !r.passed);
    const warnings = reviews.filter(r => r.issues.warnings.length > 0);

    if (failed.length === 0) {
      this.log('success', 'All files passed review!');
    } else {
      this.log('error', `${failed.length} files have critical issues`);
      failed.forEach(r => {
        console.log(`   ${colors.red}• ${r.filePath}${colors.reset}`);
      });
    }

    if (warnings.length > 0) {
      this.log('warning', `${warnings.length} files have warnings`);
    }

    // Generate report
    await this.generateReport(reviews);

    // Clean old cache
    await this.cleanCache();

    // Return exit code
    return failed.length > 0 ? 1 : 0;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: claude-review.js [files...]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help');
    console.log('  --all          Review all modified files');
    console.log('  --staged       Review staged files');
    console.log('');
    console.log('Environment variables:');
    console.log('  SKIP_REVIEW=1  Skip review and exit successfully');
    process.exit(0);
  }

  if (process.env.SKIP_REVIEW === '1' || process.env.SKIP_REVIEW === 'true') {
    console.log(`${colors.yellow}⚠️  Review skipped (SKIP_REVIEW is set)${colors.reset}`);
    process.exit(0);
  }

  let files = args.filter(arg => !arg.startsWith('--'));

  if (args.includes('--all')) {
    // Get all modified files
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf8' });
      files = output.trim().split('\n').filter(f => f);
    } catch (error) {
      console.error(`${colors.red}Failed to get modified files${colors.reset}`);
      process.exit(1);
    }
  } else if (args.includes('--staged')) {
    // Get staged files
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      files = output.trim().split('\n').filter(f => f);
    } catch (error) {
      console.error(`${colors.red}Failed to get staged files${colors.reset}`);
      process.exit(1);
    }
  }

  if (files.length === 0) {
    // Default to modified files
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf8' });
      files = output.trim().split('\n').filter(f => f);
    } catch {
      // Git command failed, no files to review
    }
  }

  const reviewer = new ClaudeReviewer();
  const exitCode = await reviewer.run(files);
  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { ClaudeReviewer };