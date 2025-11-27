# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of FileCataloger seriously. If you discover a security vulnerability, please follow these steps:

### Please DO NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Email us privately** at security@filecataloger.dev (or open a private security advisory on GitHub)
2. **Provide detailed information** including:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)
   - Your contact information

### What to Expect:

- **Initial Response**: Within 48 hours of your report
- **Status Update**: Within 7 days with assessment of the report
- **Fix Timeline**: Security fixes are prioritized and typically released within 30 days
- **Disclosure**: Coordinated disclosure after fix is released
- **Credit**: We will credit you in the security advisory (if desired)

## Security Measures

FileCataloger implements several security measures:

### Application Security

- **Context Isolation**: All renderer processes use context isolation
- **Sandbox**: Renderer processes run in sandboxed environment
- **CSP Headers**: Content Security Policy headers in production
- **IPC Validation**: Whitelist-based IPC channel filtering
- **Input Sanitization**: All user inputs are validated and sanitized

### Code Signing

- **macOS**: Signed with Apple Developer ID and notarized
- **Windows**: Signed via SignPath.io for open source projects

See `CODE_SIGNING_POLICY.md` for detailed signing information.

### Native Module Security

- **Memory Safety**: Careful memory management in C++ code
- **Bounds Checking**: All array accesses are bounds-checked
- **Error Handling**: Comprehensive error handling in native code
- **Resource Cleanup**: RAII patterns for resource management

### Dependency Security

- Regular dependency audits via `yarn audit`
- Automated dependency updates via Dependabot
- Security-focused ESLint rules enabled

## Security Best Practices for Users

### Installation

- **Download from official sources only**
  - GitHub releases: https://github.com/JinhuW/FileCataloger/releases
  - Official website (when available)
- **Verify signatures** before installation
  - macOS: `codesign -dv --verbose=4 /Applications/FileCataloger.app`
  - Windows: Check digital signature in file properties

### Permissions

- **macOS Accessibility**: Required for mouse tracking feature
  - Review what the app does before granting
  - Can be revoked in System Settings → Privacy & Security
- **File System Access**: App requests access to files you drag onto shelves
  - No background file scanning occurs
  - Only temporary storage of file references

### Updates

- Keep FileCataloger updated to latest version
- Enable automatic updates when feature is available
- Review release notes for security fixes

## Known Security Considerations

### Native Module Access

FileCataloger uses native modules for:

- **Mouse Event Tracking**: Uses CGEventTap on macOS (requires Accessibility)
- **Drag Monitoring**: Monitors system pasteboard for drag events

These are necessary for core functionality but require elevated permissions.

### File Path Storage

- File paths are stored locally in application data
- No cloud sync or external transmission (currently)
- Paths are stored in plain text in preferences

## Security Updates

Security updates will be released as:

- **Critical**: Immediate patch release (x.x.x+1)
- **High**: Next minor release or patch if urgent
- **Medium**: Next minor release
- **Low**: Next major or minor release

## Vulnerability Disclosure Policy

We follow **responsible disclosure**:

1. Researcher reports vulnerability privately
2. We acknowledge and assess the report
3. We develop and test a fix
4. We release the fix in a new version
5. We publish a security advisory
6. Researcher can publish details after 90 days or after fix release (whichever is sooner)

## Security Hall of Fame

We recognize security researchers who responsibly disclose vulnerabilities:

<!-- Future security researchers will be listed here -->

_No vulnerabilities have been reported yet. Be the first!_

## Additional Resources

- [OWASP Electron Security Checklist](https://github.com/doyensec/electronegativity)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)

## Contact

For security concerns, please contact:

- **GitHub Security Advisories**: https://github.com/JinhuW/FileCataloger/security/advisories
- **Email**: Create an issue with "SECURITY" tag (we'll provide private channel)

---

Thank you for helping keep FileCataloger and its users safe!
