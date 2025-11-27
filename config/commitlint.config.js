module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only changes
        'style',    // Code style changes (formatting, missing semi-colons, etc)
        'refactor', // Code refactoring without changing functionality
        'perf',     // Performance improvements
        'test',     // Adding missing tests or correcting existing tests
        'build',    // Changes that affect the build system or external dependencies
        'ci',       // Changes to CI configuration files and scripts
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Reverts a previous commit
        'native',   // Changes to native C++ modules
        'security', // Security fixes or improvements
        'deps',     // Dependency updates
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'main',        // Main process changes
        'renderer',    // Renderer process changes
        'preload',     // Preload script changes
        'native',      // Native module changes
        'shelf',       // Shelf functionality
        'drag',        // Drag detection functionality
        'prefs',       // Preferences management
        'build',       // Build configuration
        'deps',        // Dependencies
        'docs',        // Documentation
        'tests',       // Test files
        'config',      // Configuration files
      ],
    ],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
  },
};