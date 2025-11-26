// Load environment variables for code signing
require('dotenv').config();

// macOS code signing configuration
const getMacOSSignConfig = () => {
  // Use environment variable for identity (for CI) or default to local identity
  const identity = process.env.APPLE_IDENTITY || 'Developer ID Application: Jinhu Wang (5DA3687T6S)';

  // Check if signing is explicitly disabled (CI sets this when certificate is invalid)
  if (process.env.MACOS_SIGNING_ENABLED === 'false') {
    console.log('macOS signing disabled via MACOS_SIGNING_ENABLED=false');
    return null;
  }

  // Only enable signing if we have the necessary credentials
  // In CI, APPLE_TEAM_ID will be set if certificate was properly imported
  const shouldSign = process.env.APPLE_TEAM_ID || process.platform === 'darwin';

  if (shouldSign) {
    return {
      identity: identity,
      hardenedRuntime: true, // Required for notarization
      gatekeeperAssess: false,
      entitlements: './entitlements.mac.plist',
      'entitlements-inherit': './entitlements.mac.plist'
    };
  }
  return null;
};

// macOS notarization configuration
const getMacOSNotarizeConfig = () => {
  if (process.env.APPLE_ID && process.env.APPLE_APP_PASSWORD && process.env.APPLE_TEAM_ID) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    };
  }
  return null;
};

// Windows code signing configuration
const getWindowsSignConfig = () => {
  const certPath = process.env.WINDOWS_CERT_PATH;
  const certPassword = process.env.WINDOWS_CERT_PASSWORD;

  if (certPath && certPassword) {
    return {
      certificateFile: certPath,
      certificatePassword: certPassword
    };
  }
  return {};
};

const osxSignConfig = getMacOSSignConfig();
const osxNotarizeConfig = getMacOSNotarizeConfig();

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.filecataloger',
    appCopyright: 'Copyright © 2025 FileCataloger',
    name: 'FileCataloger',
    executableName: process.platform === 'linux' ? 'filecataloger' : 'FileCataloger',
    // Code signing configuration for Apple Distribution
    ...(osxSignConfig && { osxSign: osxSignConfig }),
    // Notarization configuration for Apple Distribution
    ...(osxNotarizeConfig && { osxNotarize: osxNotarizeConfig }),
    // Native modules need to be unpacked
    asarUnpack: [
      'dist/main/**/*.node',
      'dist/native/**/*.node',
      'node_modules/**/build/Release/*.node',
      '**/*.node'
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'filecataloger',
        authors: 'FileCataloger Team',
        exe: 'FileCataloger.exe',
        description: 'A Windows application for organizing files with floating shelf windows',
        // Windows code signing - uses environment variables from CI
        ...getWindowsSignConfig()
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'FileCataloger Team',
          homepage: 'https://github.com/JinhuW/FileCataloger'
        }
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'FileCataloger',
        format: 'ULFO',
        overwrite: true
      }
    }
  ],
  plugins: []
};
