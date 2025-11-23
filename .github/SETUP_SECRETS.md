# GitHub Actions Secrets Setup Guide

This guide explains how to configure the required secrets for automated builds and releases.

## Required Secrets for Full Automation

### 1. Code Signing (macOS) - Required for Distribution

These secrets enable code signing and notarization for macOS builds:

#### `APPLE_CERTIFICATE`

- **Description**: Base64-encoded Developer ID Application certificate (.p12 file)
- **How to obtain**:
  1. Open Keychain Access on macOS
  2. Find your "Developer ID Application" certificate
  3. Right-click → Export → Save as .p12 with password
  4. Convert to base64: `base64 -i certificate.p12 | pbcopy`
  5. Paste the result as the secret value

#### `APPLE_CERTIFICATE_PASSWORD`

- **Description**: Password for the .p12 certificate file
- **Value**: The password you set when exporting the certificate

#### `APPLE_ID`

- **Description**: Your Apple Developer account email
- **Value**: Your @icloud.com or other Apple ID email

#### `APPLE_ID_PASSWORD`

- **Description**: App-specific password for notarization
- **How to obtain**:
  1. Go to https://appleid.apple.com/account/manage
  2. Sign in and navigate to "Security"
  3. Under "App-Specific Passwords", click "Generate Password"
  4. Name it "FileCataloger GitHub Actions"
  5. Copy the generated password

#### `APPLE_TEAM_ID`

- **Description**: Your Apple Developer Team ID
- **How to find**:
  1. Log in to https://developer.apple.com
  2. Go to Account → Membership
  3. Find your Team ID (10-character alphanumeric string)

### 2. GitHub Token (Auto-configured)

#### `GITHUB_TOKEN`

- **Description**: Automatically provided by GitHub Actions
- **Note**: No configuration needed, but ensure your workflow has proper permissions

## Setting Up Secrets

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its name and value
5. Click "Add secret"

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
brew install gh

# Authenticate
gh auth login

# Add secrets
gh secret set APPLE_CERTIFICATE < certificate_base64.txt
gh secret set APPLE_CERTIFICATE_PASSWORD -b "your_password"
gh secret set APPLE_ID -b "your.email@icloud.com"
gh secret set APPLE_ID_PASSWORD -b "xxxx-xxxx-xxxx-xxxx"
gh secret set APPLE_TEAM_ID -b "XXXXXXXXXX"
```

## Testing Your Setup

### 1. Test Without Secrets (Basic Build)

The workflows will still run without Apple secrets, but will skip code signing:

```bash
# Push to develop branch to trigger CI
git push origin develop
```

### 2. Test With Secrets (Full Release)

```bash
# Create a test tag
git tag v1.0.1-test
git push origin v1.0.1-test

# Or trigger manually via GitHub Actions UI
```

## Workflow Triggers

### Develop Branch CI (`develop-ci.yml`)

- **Triggers on**: Push to develop branch, PRs to develop
- **Creates**: Pre-release builds with -dev suffix
- **Frequency**: Every commit

### Production Release (`release.yml`)

- **Triggers on**: Push to main/master, version tags (v\*), manual dispatch
- **Creates**: Production releases
- **Frequency**: On demand

### Version Bump (`version-bump.yml`)

- **Triggers on**: Manual dispatch or automatic on develop commits
- **Purpose**: Manages semantic versioning

### Dependency Updates (`dependency-update.yml`)

- **Triggers on**: Weekly (Mondays at 9 AM UTC), manual dispatch
- **Creates**: PRs with dependency updates

### Release Please (`release-please.yml`)

- **Triggers on**: Push to main/master
- **Purpose**: Automated changelog and release creation

## Troubleshooting

### Certificate Issues

If you see "Certificate not trusted" errors:

```bash
# Verify certificate
security find-identity -v -p codesigning

# Should show: "Developer ID Application: Your Name (TEAMID)"
```

### Notarization Issues

If notarization fails:

1. Ensure app-specific password is correct
2. Check Team ID matches certificate
3. Verify Apple Developer account is active

### Build Failures

Check logs for:

- Missing dependencies: Run `yarn install`
- Native module issues: Run `yarn rebuild:native`
- TypeScript errors: Run `yarn typecheck` locally

## Security Best Practices

1. **Rotate secrets regularly**: Update certificates before expiration
2. **Use environment-specific secrets**: Different secrets for dev/prod
3. **Limit secret access**: Only give access to required workflows
4. **Monitor usage**: Check GitHub's secret scanning alerts
5. **Never commit secrets**: Use `.gitignore` for local certificates

## Optional Enhancements

### Sentry Integration (Error Tracking)

```yaml
SENTRY_DSN: your_sentry_dsn
SENTRY_AUTH_TOKEN: your_auth_token
```

### Analytics

```yaml
ANALYTICS_KEY: your_analytics_key
```

### Auto-Update Server

```yaml
UPDATE_SERVER_URL: https://your-update-server.com
UPDATE_SERVER_TOKEN: your_token
```

## Support

For issues with the workflows:

1. Check the [Actions tab](../../actions) for logs
2. Review this documentation
3. Open an issue with workflow logs attached
