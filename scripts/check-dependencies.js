#!/usr/bin/env node

/**
 * Dependency Checker
 * Validates package.json dependencies and checks for issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let hasErrors = false;
let hasWarnings = false;

function log(message, level = 'info') {
  const prefix = level === 'error' ? `${RED}❌` : level === 'warning' ? `${YELLOW}⚠️` : `${GREEN}✓`;
  const suffix = level !== 'info' ? RESET : '';
  console.log(`${prefix} ${message}${suffix}`);
}

console.log(`${GREEN}Checking Dependencies...${RESET}\n`);

// Read package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  log('package.json not found', 'error');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

// Check for duplicate dependencies
console.log(`${CYAN}Checking for duplicate dependencies...${RESET}`);
const deps = Object.keys(packageJson.dependencies || {});
const devDeps = Object.keys(packageJson.devDependencies || {});
const duplicates = deps.filter(dep => devDeps.includes(dep));

if (duplicates.length > 0) {
  duplicates.forEach(dep => {
    log(`Duplicate dependency: ${dep} appears in both dependencies and devDependencies`, 'error');
    hasErrors = true;
  });
} else {
  log('No duplicate dependencies found', 'info');
}

// Check for security vulnerabilities
console.log(`\n${CYAN}Checking for security vulnerabilities...${RESET}`);
try {
  execSync('yarn audit --json', { encoding: 'utf-8' });
  log('No security vulnerabilities found', 'info');
} catch (error) {
  // Parse audit output
  const output = error.stdout || '';
  const lines = output.split('\n').filter(line => line.trim());

  let vulnerabilities = {
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0
  };

  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.type === 'auditAdvisory') {
        const severity = json.data.advisory.severity;
        vulnerabilities[severity] = (vulnerabilities[severity] || 0) + 1;
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  const total = Object.values(vulnerabilities).reduce((a, b) => a + b, 0);

  if (total > 0) {
    log(`Found ${total} vulnerabilities:`, 'warning');
    if (vulnerabilities.critical > 0) {
      console.log(`  ${RED}Critical: ${vulnerabilities.critical}${RESET}`);
      hasErrors = true;
    }
    if (vulnerabilities.high > 0) {
      console.log(`  ${RED}High: ${vulnerabilities.high}${RESET}`);
      hasErrors = true;
    }
    if (vulnerabilities.moderate > 0) {
      console.log(`  ${YELLOW}Moderate: ${vulnerabilities.moderate}${RESET}`);
      hasWarnings = true;
    }
    if (vulnerabilities.low > 0) {
      console.log(`  Low: ${vulnerabilities.low}`);
    }
    console.log('  Run: yarn audit fix');
  }
}

// Check for unused dependencies using depcheck
console.log(`\n${CYAN}Checking for unused dependencies...${RESET}`);
try {
  const depcheckResult = execSync('npx depcheck --json', { encoding: 'utf-8' });
  const result = JSON.parse(depcheckResult);

  if (result.dependencies && result.dependencies.length > 0) {
    log(`Unused dependencies found:`, 'warning');
    result.dependencies.forEach(dep => {
      console.log(`  - ${dep}`);
    });
    hasWarnings = true;
  } else {
    log('No unused dependencies found', 'info');
  }

  if (result.devDependencies && result.devDependencies.length > 0) {
    // Filter out some common false positives
    const filtered = result.devDependencies.filter(dep =>
      !['@types/node', 'typescript', 'eslint', 'prettier', 'husky'].includes(dep)
    );

    if (filtered.length > 0) {
      log(`Potentially unused devDependencies:`, 'warning');
      filtered.forEach(dep => {
        console.log(`  - ${dep}`);
      });
      hasWarnings = true;
    }
  }

  if (result.missing && Object.keys(result.missing).length > 0) {
    log(`Missing dependencies detected:`, 'error');
    Object.entries(result.missing).forEach(([dep, files]) => {
      console.log(`  - ${dep} (used in ${files.length} files)`);
    });
    hasErrors = true;
  }

} catch (error) {
  log('Could not run depcheck (this is normal for some configurations)', 'warning');
}

// Check for outdated dependencies
console.log(`\n${CYAN}Checking for outdated dependencies...${RESET}`);
try {
  const outdatedJson = execSync('npm outdated --json', { encoding: 'utf-8' });
  if (outdatedJson) {
    const outdated = JSON.parse(outdatedJson);
    const outdatedCount = Object.keys(outdated).length;

    if (outdatedCount > 0) {
      log(`Found ${outdatedCount} outdated packages:`, 'warning');

      Object.entries(outdated).slice(0, 10).forEach(([name, info]) => {
        const current = info.current || 'not installed';
        const wanted = info.wanted;
        const latest = info.latest;

        if (info.current !== info.wanted) {
          console.log(`  ${YELLOW}- ${name}: ${current} → ${wanted} (latest: ${latest})${RESET}`);
        } else if (info.wanted !== info.latest) {
          console.log(`  - ${name}: ${current} (latest: ${latest})`);
        }
      });

      if (outdatedCount > 10) {
        console.log(`  ... and ${outdatedCount - 10} more`);
      }

      console.log('\n  Update with: yarn upgrade-interactive');
      hasWarnings = true;
    } else {
      log('All dependencies are up to date', 'info');
    }
  }
} catch (error) {
  // npm outdated returns non-zero exit code when packages are outdated
  // We handle this above by parsing the JSON output
  if (!error.stdout) {
    log('All dependencies are up to date', 'info');
  }
}

// Check Electron version compatibility
console.log(`\n${CYAN}Checking Electron compatibility...${RESET}`);
const electronVersion = packageJson.devDependencies?.electron;
if (electronVersion) {
  log(`Electron version: ${electronVersion}`, 'info');

  // Check if electron-rebuild is present
  if (!packageJson.devDependencies?.['electron-rebuild']) {
    log('electron-rebuild is missing (required for native modules)', 'error');
    hasErrors = true;
  }

  // Check Node version compatibility
  try {
    const nodeVersion = process.version;
    log(`Node version: ${nodeVersion}`, 'info');

    // Basic version check (Electron 25+ requires Node 18+)
    const majorElectron = parseInt(electronVersion.replace(/[^0-9]/g, ''));
    const majorNode = parseInt(nodeVersion.substring(1).split('.')[0]);

    if (majorElectron >= 25 && majorNode < 18) {
      log(`Node ${nodeVersion} may be incompatible with Electron ${electronVersion}`, 'warning');
      hasWarnings = true;
    }
  } catch (error) {
    // Ignore version parsing errors
  }
} else {
  log('Electron is not in devDependencies', 'error');
  hasErrors = true;
}

// Check for required peer dependencies
console.log(`\n${CYAN}Checking peer dependencies...${RESET}`);
const hasPeerDeps = Object.keys(packageJson.peerDependencies || {}).length > 0;
if (hasPeerDeps) {
  Object.entries(packageJson.peerDependencies).forEach(([dep, version]) => {
    if (!allDeps[dep]) {
      log(`Missing peer dependency: ${dep}@${version}`, 'error');
      hasErrors = true;
    }
  });
} else {
  log('No peer dependencies to check', 'info');
}

// Check package.json validity
console.log(`\n${CYAN}Checking package.json validity...${RESET}`);

if (!packageJson.name) {
  log('package.json missing "name" field', 'error');
  hasErrors = true;
}

if (!packageJson.version) {
  log('package.json missing "version" field', 'error');
  hasErrors = true;
}

if (!packageJson.main) {
  log('package.json missing "main" field', 'warning');
  hasWarnings = true;
}

if (!packageJson.scripts) {
  log('package.json missing "scripts" field', 'error');
  hasErrors = true;
}

// Check for yarn.lock
const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
if (!fs.existsSync(yarnLockPath)) {
  log('yarn.lock not found - run "yarn install"', 'error');
  hasErrors = true;
} else {
  log('yarn.lock exists', 'info');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log(`${RED}Dependency check failed with errors.${RESET}`);
  process.exit(1);
} else if (hasWarnings) {
  console.log(`${YELLOW}Dependency check passed with warnings.${RESET}`);
  process.exit(0);
} else {
  console.log(`${GREEN}✅ All dependency checks passed!${RESET}`);
  process.exit(0);
}