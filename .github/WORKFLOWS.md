# GitHub Actions Workflows

This document describes the GitHub Actions workflows for building and releasing FileCataloger.

## Workflows

### 1. Release (`release.yml`)

Builds and publishes FileCataloger to GitHub Releases for all platforms.

**Triggers:**
- Pushing a version tag (e.g., `v1.0.0`)
- Manual workflow dispatch

**Platforms Built:**
- macOS Universal (ARM64 + Intel x64)
- macOS ARM64 (Apple Silicon)
- macOS Intel x64
- Windows x64
- Windows ia32

**How to Create a Release:**

1. **Update version in package.json**
   ```bash
   # Example: bump to 1.0.0
   npm version 1.0.0 --no-git-tag-version
   ```

2. **Commit the version change**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.0.0"
   git push
   ```

3. **Create and push a tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Workflow will:**
   - Create a draft release on GitHub
   - Build all platform variants in parallel
   - Upload installers to the release
   - You can then edit the release notes and publish

**Manual Release:**
- Go to Actions → Release → Run workflow
- Enter version (e.g., `v1.0.0`)
- Click Run

**Required Secrets for macOS Code Signing:**
- `APPLE_ID`: Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization
- `APPLE_TEAM_ID`: Your Apple Developer Team ID

### 2. CI (`ci.yml`)

Continuous integration testing for pull requests and pushes.

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Tests Run:**
- TypeScript type checking
- Linting (ESLint)
- Unit tests
- Native module validation (macOS)
- Build verification
- Security audit
- Test matrix: Node.js 18 and 20

**Platforms Tested:**
- macOS (with native module tests)
- Windows
- Linux (build verification only)

### 3. Manual Build (`build.yml`)

On-demand builds for testing specific platforms.

**Triggers:**
- Manual workflow dispatch only

**How to Use:**
1. Go to Actions → Manual Build → Run workflow
2. Select platform:
   - `macos-universal` - Universal binary (ARM64 + Intel)
   - `macos-arm64` - Apple Silicon only
   - `macos-x64` - Intel only
   - `windows-x64` - Windows 64-bit
   - `windows-ia32` - Windows 32-bit
   - `all` - All platforms
3. Choose whether to upload artifacts (default: true)
4. Click Run

**Artifacts:**
- Available for 7 days after build
- Download from workflow run page

## Setup Instructions

### 1. Enable GitHub Actions

Ensure Actions are enabled in your repository settings:
- Go to Settings → Actions → General
- Enable "Allow all actions and reusable workflows"

### 2. Configure Secrets (for macOS Signing)

For production releases with code signing and notarization:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD`: Generate at appleid.apple.com
   - `APPLE_TEAM_ID`: Find in Apple Developer Account

**Without these secrets:**
- Builds will still work
- Apps won't be signed or notarized
- Users will see security warnings on macOS

### 3. Configure Branch Protection (Optional)

For `main` branch:
- Go to Settings → Branches → Add rule
- Branch name pattern: `main`
- Enable:
  - Require status checks to pass before merging
  - Require branches to be up to date before merging
  - Select status checks: `test-macos`, `test-windows`, `test-linux`

## Build Output

### macOS Artifacts
- `FileCataloger-{version}-universal.dmg` - Universal binary (recommended)
- `FileCataloger-{version}-arm64.dmg` - Apple Silicon only
- `FileCataloger-{version}-x64.dmg` - Intel only
- Corresponding `.zip` files

### Windows Artifacts
- `FileCataloger-{version}-win-x64.exe` - 64-bit installer
- `FileCataloger-{version}-win-ia32.exe` - 32-bit installer
- `.nupkg` files for Squirrel updates

## Troubleshooting

### Build Failures

**Native module build fails:**
- Ensure Python 3.x is installed
- Check that build tools are available (Xcode CLI on macOS, Visual Studio on Windows)

**Type check fails:**
- Run `yarn typecheck` locally first
- Fix any TypeScript errors

**macOS signing fails:**
- Verify secrets are configured correctly
- Check Apple Developer account status
- Ensure certificates are valid

### Release Issues

**Tag already exists:**
```bash
# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0

# Create new tag
git tag v1.0.0
git push origin v1.0.0
```

**Draft release not created:**
- Check workflow logs for errors
- Verify `GITHUB_TOKEN` has write permissions
- Ensure repository settings allow Actions to create releases

## Performance Notes

- Build times:
  - macOS Universal: ~15-20 minutes
  - macOS single arch: ~10-15 minutes
  - Windows: ~10-15 minutes
  - Full release (all platforms): ~20-25 minutes (parallel)

- Artifact sizes:
  - macOS DMG: ~100-150 MB
  - Windows installer: ~80-120 MB

## Best Practices

1. **Always test locally before releasing**
   ```bash
   yarn typecheck
   yarn test
   yarn dist:mac:universal  # or dist:win:x64
   ```

2. **Use semantic versioning**
   - Major: Breaking changes (v2.0.0)
   - Minor: New features (v1.1.0)
   - Patch: Bug fixes (v1.0.1)

3. **Write good release notes**
   - Summarize changes
   - Highlight breaking changes
   - Include upgrade instructions if needed

4. **Test the release**
   - Download and install from GitHub Releases
   - Verify on different platforms
   - Test update mechanism

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
