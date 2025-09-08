module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.example.filecataloger',
    appCopyright: 'Copyright © 2024',
    name: 'FileCataloger',
    executableName: 'FileCataloger',
    // For local testing without Developer ID certificate
    osxSign: {
      identity: '-', // Use ad-hoc signing
      entitlements: './entitlements.plist',
      'entitlements-inherit': './entitlements.plist'
    },
    // Native modules need to be unpacked
    asarUnpack: [
      'dist/native/**/*.node',
      'node_modules/**/build/Release/*.node'
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'filecataloger'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'FileCataloger',
        format: 'UDZO'
      }
    }
  ],
  plugins: []
};