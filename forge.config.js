module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.example.filecataloger',
    appCopyright: 'Copyright © 2024',
    name: 'FileCataloger',
    executableName: 'FileCataloger',
    // macOS Ad-hoc signing for distribution without Developer ID
    osxSign: {
      identity: '-', // Ad-hoc signing
      hardenedRuntime: false,
      gatekeeperAssess: false,
      entitlements: './entitlements.mac.plist',
      'entitlements-inherit': './entitlements.mac.plist'
    },
    // macOS universal binary support - merge arm64 and x64 into single binary
    osxUniversal: {
      // Merge x64 and arm64 native modules
      x64ArchFiles: '**/mouse_tracker_darwin.node',
      // Force rebuild for universal architecture
      mergeASARs: true
    },
    // Windows specific settings
    win32metadata: {
      CompanyName: 'FileCataloger',
      FileDescription: 'FileCataloger - Floating shelf for file management',
      ProductName: 'FileCataloger',
      InternalName: 'filecataloger'
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
    // Windows Squirrel installer
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'FileCataloger',
        authors: 'FileCataloger Team',
        description: 'Floating shelf for temporary file storage',
        // iconUrl and setupIcon can be added when icons are available
        // iconUrl: 'https://example.com/icon.ico',
        // setupIcon: './assets/icon.ico',
        noMsi: false
      }
    },
    // macOS ZIP
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32']
    },
    // Linux DEB
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'FileCataloger Team',
          homepage: 'https://github.com/example/filecataloger'
        }
      }
    },
    // macOS DMG
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
