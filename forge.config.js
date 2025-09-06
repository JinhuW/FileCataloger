const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    appBundleId: 'com.example.dropover-clone',
    appCopyright: 'Copyright © 2024',
    // Code signing configuration (uncomment when ready for distribution)
    // osxSign: {
    //   identity: 'Developer ID Application: Your Name',
    //   'hardened-runtime': true,
    //   entitlements: './entitlements.plist',
    //   'entitlements-inherit': './entitlements.plist',
    //   'signature-flags': 'library'
    // },
    // osxNotarize: {
    //   appleId: process.env.APPLE_ID,
    //   appleIdPassword: process.env.APPLE_ID_PASSWORD
    // }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'dropover_clone'
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
        name: 'Dropover Clone',
        format: 'UDZO'
      }
    }
  ],
  plugins: []
};