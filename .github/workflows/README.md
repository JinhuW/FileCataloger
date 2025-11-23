# GitHub Actions Workflows

This directory contains all CI/CD workflows for the FileCataloger project.

## Workflow Overview

### Core Workflows

#### 🚀 `release.yml` - Main Build & Release Pipeline

- **Triggers**: Push to main/master, tags (v\*), manual dispatch
- **Platforms**: macOS (Universal, ARM64, x64), Windows (x64, ARM64), Linux (x64, AppImage)
- **Features**:
  - Cross-platform builds with code signing
  - macOS notarization
  - Automated GitHub releases
  - Update manifest generation
  - Quality checks before build

#### 🔧 `develop-ci.yml` - Development Branch CI

- **Triggers**: Push/PR to develop branch
- **Features**:
  - Multi-platform builds (macOS, Windows, Linux)
  - Development pre-releases (dev-latest tag)
  - PR quality reports
  - Faster builds without signing

#### ✅ `ci.yml` - General CI for All Branches

- **Triggers**: Push to any branch (except main/develop), all PRs
- **Features**:
  - Quick validation checks
  - TypeScript, linting, formatting
  - Build verification
  - Security audits

### Automation Workflows

#### 📦 `dependency-update.yml` - Automated Dependency Management

- **Triggers**: Weekly (Mondays 9 AM UTC), manual dispatch
- **Features**:
  - Configurable update levels (patch/minor/major)
  - Automated PR creation
  - Security scanning
  - Quality checks after updates

### AI-Assisted Workflows

#### 🤖 `claude.yml` - Interactive Claude Support

- **Triggers**: Comments with @claude mention
- **Features**:
  - Responds to issues and PR comments
  - Provides code suggestions
  - Answers questions

#### 👁️ `claude-code-review.yml` - Automated PR Reviews

- **Triggers**: PR opened/synchronized
- **Features**:
  - Automated code review
  - Security analysis
  - Performance suggestions
  - Best practices enforcement

## Secrets Required

### macOS Code Signing & Notarization

- `APPLE_CERTIFICATE` - Base64 encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_ID` - Apple Developer account email
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Developer Team ID

### Windows Code Signing

- `WINDOWS_CERTIFICATE` - Base64 encoded .pfx certificate
- `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password

### Claude Integration

- `CLAUDE_CODE_OAUTH_TOKEN` - OAuth token for Claude Code

## Workflow Triggers

| Workflow               | Push (main) | Push (develop) | Push (other) | PR  | Tag | Schedule | Manual  |
| ---------------------- | ----------- | -------------- | ------------ | --- | --- | -------- | ------- |
| release.yml            | ✅          | ❌             | ❌           | ✅  | ✅  | ❌       | ✅      |
| develop-ci.yml         | ❌          | ✅             | ❌           | ✅  | ❌  | ❌       | ❌      |
| ci.yml                 | ❌          | ❌             | ✅           | ✅  | ❌  | ❌       | ❌      |
| dependency-update.yml  | ❌          | ❌             | ❌           | ❌  | ❌  | ✅       | ✅      |
| claude.yml             | N/A         | N/A            | N/A          | N/A | N/A | N/A      | Comment |
| claude-code-review.yml | N/A         | N/A            | N/A          | ✅  | N/A | N/A      | N/A     |

## Platform Support

| Platform             | Development | Release | Code Signing | Notes                 |
| -------------------- | ----------- | ------- | ------------ | --------------------- |
| macOS Universal      | ✅          | ✅      | ✅           | Apple Silicon + Intel |
| macOS ARM64          | ✅          | ✅      | ✅           | Apple Silicon only    |
| macOS x64            | ✅          | ✅      | ✅           | Intel only            |
| Windows x64          | ✅          | ✅      | ✅           | 64-bit                |
| Windows ARM64        | ❌          | ✅      | ✅           | ARM processors        |
| Linux x64 (deb)      | ✅          | ✅      | ❌           | Debian/Ubuntu         |
| Linux x64 (AppImage) | ❌          | ✅      | ❌           | Universal Linux       |

## Best Practices

1. **Quality First**: All workflows run quality checks before building
2. **Fail Fast**: Matrix builds use `fail-fast: false` to see all failures
3. **Caching**: Node modules cached for faster builds
4. **Native Modules**: Only built on macOS where needed
5. **Artifacts**: Retained for 7-30 days depending on importance

## Manual Workflow Dispatch

### Creating a Release

```bash
# Trigger a release build
gh workflow run release.yml \
  -f version="1.0.0" \
  -f release_type="release"
```

### Update Dependencies

```bash
# Trigger dependency updates
gh workflow run dependency-update.yml \
  -f update_type="minor"
```

## Monitoring

- Check workflow runs: https://github.com/[owner]/FileCataloger/actions
- Release page: https://github.com/[owner]/FileCataloger/releases
- Development builds: Tagged as `dev-latest`

## Troubleshooting

### Build Failures

1. Check Node.js version (should be 22)
2. Verify native module compatibility
3. Check code signing certificates expiry

### Native Module Issues

- macOS: Ensure Xcode Command Line Tools installed
- Windows: Visual Studio Build Tools required
- Linux: build-essential package needed

### Release Issues

- Ensure all secrets are configured
- Check certificate expiry dates
- Verify GitHub token permissions
