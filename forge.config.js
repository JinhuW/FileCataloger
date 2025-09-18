const now = new Date();
// Short timestamp for DMG (to stay under 27 char limit)
const shortTimestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD format
const buildDate = now.toLocaleDateString('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).replace(/\//g, '-');

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.example.filecataloger',
    appCopyright: 'Copyright © 2024',
    name: `FileCataloger-${buildDate}`,
    executableName: 'FileCataloger',
    // For local testing without Developer ID certificate
    osxSign: {
      identity: '-', // Use ad-hoc signing
      entitlements: './entitlements.plist',
      'entitlements-inherit': './entitlements.plist'
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
        name: `FileCataloger-${shortTimestamp}`,
        format: 'UDZO'
      }
    }
  ],
  plugins: []
};
