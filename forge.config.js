// Load environment variables for code signing
require('dotenv').config();

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.filecataloger',
    appCopyright: 'Copyright © 2025 FileCataloger',
    name: 'FileCataloger',
    executableName: process.platform === 'linux' ? 'filecataloger' : 'FileCataloger',
    // Code signing configuration for Apple Distribution
    osxSign: {
      identity: 'Developer ID Application: Jinhu Wang (5DA3687T6S)',
      hardenedRuntime: true, // Required for notarization
      gatekeeperAssess: false,
      entitlements: './entitlements.mac.plist',
      'entitlements-inherit': './entitlements.mac.plist'
    },
    // Notarization configuration for Apple Distribution
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    },
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
        description: 'A macOS application for organizing files with floating shelf windows'
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
