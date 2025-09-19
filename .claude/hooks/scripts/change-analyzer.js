#!/usr/bin/env node

/**
 * Change Analyzer for FileCataloger Auto-Rebuild Hook
 * Analyzes file changes and determines optimal rebuild strategy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = '/Users/jinhu/Development/File_Cataloger_Project/FileCataloger';
const CHANGE_LOG = '/tmp/claude_fc_changes.log';
const BUILD_CACHE = '/tmp/claude_fc_build_cache.json';

// File categories with rebuild implications
const FILE_PATTERNS = {
  native: {
    patterns: [/\.cc$/, /\.h$/, /\.gyp$/, /binding\.gyp/],
    path: /src\/native/,
    actions: ['rebuild:native', 'full-rebuild'],
    priority: 10
  },
  mainProcess: {
    patterns: [/src\/main\/.*\.ts$/],
    actions: ['build:main', 'restart-required'],
    priority: 8
  },
  renderer: {
    patterns: [/src\/renderer\/.*\.(ts|tsx)$/],
    actions: ['build:renderer', 'hot-reload'],
    priority: 6
  },
  preload: {
    patterns: [/src\/preload\/.*\.ts$/],
    actions: ['build:preload', 'restart-required'],
    priority: 7
  },
  config: {
    patterns: [/tsconfig.*\.json$/, /webpack\..*\.js$/, /package\.json$/],
    actions: ['full-rebuild', 'restart-required'],
    priority: 9
  },
  styles: {
    patterns: [/\.css$/, /tailwind\.config\.js$/],
    actions: ['build:renderer', 'hot-reload'],
    priority: 4
  },
  tests: {
    patterns: [/\.(test|spec)\.(ts|tsx)$/],
    actions: ['test'],
    priority: 2
  },
  docs: {
    patterns: [/\.md$/, /CHANGELOG/, /README/],
    actions: [],
    priority: 0
  }
};

/**
 * Categorize a file based on patterns
 */
function categorizeFile(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);

  for (const [category, config] of Object.entries(FILE_PATTERNS)) {
    // Check path pattern if specified
    if (config.path && !config.path.test(relativePath)) {
      continue;
    }

    // Check file patterns
    for (const pattern of config.patterns) {
      if (pattern.test(relativePath)) {
        return {
          category,
          ...config,
          file: relativePath
        };
      }
    }
  }

  // Default category for unmatched files
  return {
    category: 'other',
    actions: ['build'],
    priority: 1,
    file: relativePath
  };
}

/**
 * Analyze all changes and determine build strategy
 */
function analyzeChanges(changeLog) {
  if (!fs.existsSync(changeLog)) {
    return {
      strategy: 'none',
      actions: [],
      files: []
    };
  }

  const changes = fs.readFileSync(changeLog, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(file => categorizeFile(file));

  // Group by category
  const grouped = changes.reduce((acc, change) => {
    if (!acc[change.category]) {
      acc[change.category] = [];
    }
    acc[change.category].push(change);
    return acc;
  }, {});

  // Determine required actions
  const allActions = new Set();
  let maxPriority = 0;
  let requiresRestart = false;
  let requiresNativeRebuild = false;

  for (const category of Object.keys(grouped)) {
    const categoryData = grouped[category][0];
    maxPriority = Math.max(maxPriority, categoryData.priority);

    categoryData.actions.forEach(action => {
      allActions.add(action);
      if (action === 'restart-required') requiresRestart = true;
      if (action === 'rebuild:native') requiresNativeRebuild = true;
    });
  }

  // Determine strategy based on priority and actions
  let strategy = 'incremental';
  if (maxPriority >= 9 || allActions.has('full-rebuild')) {
    strategy = 'full';
  } else if (requiresNativeRebuild) {
    strategy = 'native';
  } else if (requiresRestart) {
    strategy = 'restart';
  } else if (maxPriority <= 2) {
    strategy = 'minimal';
  }

  // Build command sequence
  const commands = buildCommandSequence(strategy, allActions);

  return {
    strategy,
    actions: Array.from(allActions),
    commands,
    categories: Object.keys(grouped),
    fileCount: changes.length,
    requiresRestart,
    requiresNativeRebuild,
    priority: maxPriority
  };
}

/**
 * Build optimal command sequence based on strategy
 */
function buildCommandSequence(strategy, actions) {
  const commands = [];

  switch (strategy) {
    case 'full':
      commands.push({
        cmd: 'yarn clean',
        description: 'Clean build artifacts',
        critical: false
      });
      if (actions.has('rebuild:native')) {
        commands.push({
          cmd: 'yarn rebuild:native',
          description: 'Rebuild native modules',
          critical: true
        });
      }
      commands.push({
        cmd: 'yarn build',
        description: 'Full application build',
        critical: true
      });
      break;

    case 'native':
      commands.push({
        cmd: 'yarn rebuild:native',
        description: 'Rebuild native modules',
        critical: true
      });
      commands.push({
        cmd: 'yarn build:main',
        description: 'Rebuild main process',
        critical: true
      });
      break;

    case 'restart':
      if (actions.has('build:main')) {
        commands.push({
          cmd: 'yarn build:main',
          description: 'Build main process',
          critical: true
        });
      }
      if (actions.has('build:preload')) {
        commands.push({
          cmd: 'yarn build:preload',
          description: 'Build preload scripts',
          critical: true
        });
      }
      if (actions.has('build:renderer')) {
        commands.push({
          cmd: 'yarn build:renderer',
          description: 'Build renderer',
          critical: false
        });
      }
      break;

    case 'incremental':
      if (actions.has('build:renderer')) {
        commands.push({
          cmd: 'yarn build:renderer',
          description: 'Build renderer',
          critical: false
        });
      }
      break;

    case 'minimal':
      // Just validation
      break;
  }

  // Add validation commands
  commands.unshift({
    cmd: 'yarn typecheck',
    description: 'Type checking',
    critical: false,
    skipOnFail: true
  });

  commands.unshift({
    cmd: 'yarn lint',
    description: 'Linting',
    critical: false,
    skipOnFail: true
  });

  // Add tests if needed
  if (actions.has('test')) {
    commands.push({
      cmd: 'yarn test --run',
      description: 'Run tests',
      critical: false
    });
  }

  return commands;
}

/**
 * Check build cache to avoid unnecessary rebuilds
 */
function checkBuildCache(analysis) {
  if (!fs.existsSync(BUILD_CACHE)) {
    return true; // No cache, should build
  }

  try {
    const cache = JSON.parse(fs.readFileSync(BUILD_CACHE, 'utf-8'));
    const cacheAge = Date.now() - cache.timestamp;

    // Cache expires after 5 minutes
    if (cacheAge > 5 * 60 * 1000) {
      return true;
    }

    // Check if same files changed
    if (JSON.stringify(cache.categories) === JSON.stringify(analysis.categories)) {
      return false; // Skip rebuild, same categories
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Update build cache
 */
function updateBuildCache(analysis) {
  const cache = {
    timestamp: Date.now(),
    categories: analysis.categories,
    strategy: analysis.strategy
  };

  fs.writeFileSync(BUILD_CACHE, JSON.stringify(cache, null, 2));
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const changeLog = args[0] || CHANGE_LOG;

  const analysis = analyzeChanges(changeLog);

  // Check if rebuild is needed
  if (!checkBuildCache(analysis)) {
    console.log(JSON.stringify({
      ...analysis,
      skip: true,
      reason: 'Recently built with same changes'
    }, null, 2));
    return;
  }

  // Update cache
  updateBuildCache(analysis);

  // Output analysis
  console.log(JSON.stringify(analysis, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  categorizeFile,
  analyzeChanges,
  buildCommandSequence
};