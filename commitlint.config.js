export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow conventional commit formats
    'header-max-length': [2, 'always', 100],
    'header-min-length': [2, 'always', 10],
    'body-max-line-length': [2, 'always', 200],
    'footer-max-line-length': [2, 'always', 200],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
}
