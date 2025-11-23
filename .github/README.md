# GitHub Actions CI/CD Setup

![Develop CI](https://github.com/jinhu/FileCataloger/workflows/Develop%20Branch%20CI%2FCD/badge.svg?branch=develop)
![Production Release](https://github.com/jinhu/FileCataloger/workflows/Production%20Release/badge.svg)
![Dependency Updates](https://github.com/jinhu/FileCataloger/workflows/Dependency%20Updates/badge.svg)

## Quick Start

This repository is configured with comprehensive CI/CD pipelines for automated building, testing, and releasing of FileCataloger.

### Workflows Overview

| Workflow               | Trigger                   | Purpose                        | Creates                     |
| ---------------------- | ------------------------- | ------------------------------ | --------------------------- |
| **Develop CI**         | Push to `develop`         | Build, test, and pre-release   | Dev builds (`.dmg`, `.deb`) |
| **Production Release** | Push to `main`, tags `v*` | Production builds with signing | Signed, notarized releases  |
| **Version Bump**       | Auto on commits or manual | Semantic versioning            | Version tags                |
| **Dependency Updates** | Weekly or manual          | Update dependencies            | Pull requests               |
| **Release Please**     | Push to `main`            | Changelog generation           | Release notes               |

### Getting Started

1. **Fork or clone this repository**
2. **Set up secrets** (see [SETUP_SECRETS.md](./SETUP_SECRETS.md))
3. **Push to develop** to trigger builds

### Branch Strategy

```
main (stable releases)
  └── develop (active development)
       └── feature/* (feature branches)
```

### Release Process

#### Automated Development Builds

Every push to `develop` creates a pre-release:

```bash
git checkout develop
git add .
git commit -m "feat: add new feature"
git push origin develop
# Creates: v1.0.0-dev.123
```

#### Production Release

Merge to main for stable release:

```bash
git checkout main
git merge develop
git push origin main
# Creates: v1.0.0
```

#### Manual Release

Trigger via GitHub UI or CLI:

```bash
gh workflow run release.yml -f version=1.2.0
```

### Commit Convention

Use conventional commits for automatic versioning:

- `feat:` New feature (minor version bump)
- `fix:` Bug fix (patch version bump)
- `perf:` Performance improvement
- `docs:` Documentation only
- `chore:` Maintenance
- `BREAKING CHANGE:` Major version bump

Examples:

```bash
git commit -m "feat: add dark mode support"
git commit -m "fix: resolve memory leak in shelf manager"
git commit -m "BREAKING CHANGE: update API to v2"
```

### Build Artifacts

Artifacts are available in:

1. **GitHub Releases**: Public downloads
2. **Actions Artifacts**: Temporary (7-30 days)
3. **Package Registry**: npm/GitHub Packages (if configured)

### Local Development

Run the same checks locally:

```bash
# Quality checks (run before pushing)
yarn quality:check

# Build for current platform
yarn dist

# Run all tests
yarn test
yarn test:native:validate
```

### Monitoring

- **Build Status**: Check [Actions tab](../../actions)
- **Release History**: View [Releases page](../../releases)
- **Dependencies**: Review [Security tab](../../security)

### Troubleshooting

| Issue                | Solution                                       |
| -------------------- | ---------------------------------------------- |
| Build fails          | Check `yarn typecheck` and `yarn lint` locally |
| Signing fails        | Verify Apple certificates in secrets           |
| Native module errors | Run `yarn rebuild:native`                      |
| Release not created  | Ensure proper commit format                    |

### Advanced Configuration

#### Custom Build Matrix

Edit `.github/workflows/develop-ci.yml`:

```yaml
strategy:
  matrix:
    include:
      - os: windows-latest # Add Windows
        platform: win32
        arch: x64
```

#### Change Release Schedule

Edit `.github/workflows/dependency-update.yml`:

```yaml
schedule:
  - cron: '0 9 * * 1' # Every Monday at 9 AM
```

#### Add Deployment Step

Add to `.github/workflows/release.yml`:

```yaml
- name: Deploy to Server
  run: |
    scp out/*.dmg user@server:/releases/
```

## Support

- [Setup Guide](./SETUP_SECRETS.md) - Configure GitHub secrets
- [Issues](../../issues) - Report problems
- [Discussions](../../discussions) - Get help

## License

The CI/CD configuration is part of the FileCataloger project under MIT license.
