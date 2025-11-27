# Code Signing Policy

## Attribution

Windows binaries for FileCataloger are signed using [SignPath.io](https://signpath.io),
free code signing for open source projects, provided by [SignPath Foundation](https://signpath.org).

macOS binaries are signed and notarized by the project maintainer using Apple Developer ID.

## Signing Process

### Windows (SignPath)

- All Windows releases are built via GitHub Actions
- Unsigned binaries are automatically submitted to SignPath for signing
- Only builds from the `main` branch or release tags receive production signatures
- Pull request builds receive test signatures (not trusted by Windows)

### macOS (Apple)

- All macOS releases are built via GitHub Actions
- Binaries are signed with Developer ID Application certificate
- Apps are notarized with Apple's notary service
- DMG files are stapled with notarization ticket

## Verification

### Windows

Users can verify Windows signatures by:

1. Right-click the `.exe` file
2. Select "Properties" → "Digital Signatures" tab
3. Verify signer is "SignPath Foundation"

### macOS

Users can verify macOS signatures by running:

```bash
codesign -dv --verbose=4 /Applications/FileCataloger.app
spctl -a -t exec -vv /Applications/FileCataloger.app
```

## Team Roles

| Role             | Responsibilities                                              |
| ---------------- | ------------------------------------------------------------- |
| **Maintainer**   | Release authorization, code review, signing policy management |
| **Contributors** | Pull request submission, code changes                         |

## Security Practices

- All team members use multi-factor authentication (MFA) for GitHub
- Signing keys are stored in Hardware Security Modules (HSM)
- Private keys never leave the secure signing infrastructure
- All builds are reproducible from source code

## Contact

For security concerns related to code signing, please open an issue on the
[GitHub repository](https://github.com/JinhuW/FileCataloger/issues).
