# Native Mouse Tracker Requirement

## Important Notice

This application **requires** the native mouse tracker module to function. There is **no fallback** to a Node.js-based tracker.

## Key Points

1. **Native Module Required**: The application will terminate if the native mouse tracker module fails to load.
2. **No Fallback**: The `node-tracker.ts` file exists but is NOT used as a fallback. The application is designed to fail fast if native tracking is unavailable.
3. **macOS Permissions**: The native tracker requires Accessibility permissions on macOS.
4. **Build Requirements**:
   - Xcode Command Line Tools must be installed
   - Xcode license must be accepted (`sudo xcodebuild -license`)
   - Python must be installed for node-gyp

## Building the Native Module

After cloning or when Node/Electron versions change:

```bash
cd src/native/mouse-tracker/darwin
node-gyp rebuild
cd ../../../..
yarn electron-rebuild
```

## Error Handling

The application will terminate with an error if:

- The native module fails to load
- Accessibility permissions are not granted
- The native module build is missing or corrupted

This is by design to ensure the application only runs with proper native mouse tracking capabilities.
