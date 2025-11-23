module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.example.filecataloger',
    appCopyright: 'Copyright © 2024',
    name: 'FileCataloger',
    executableName: process.platform === 'linux' ? 'filecataloger' : 'FileCataloger',
    // Ad-hoc signing for distribution without Developer ID
    osxSign: {
      identity: '-', // Ad-hoc signing
      hardenedRuntime: false,
      gatekeeperAssess: false,
      entitlements: './entitlements.mac.plist',
      'entitlements-inherit': './entitlements.mac.plist'
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
