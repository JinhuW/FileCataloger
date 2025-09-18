const path = require('path');

class BuildInfoPlugin {
  constructor(options = {}) {
    this.filename = options.filename || 'build-info.json';
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('BuildInfoPlugin', (compilation, callback) => {
      // Generate build information
      const buildInfo = {
        timestamp: new Date().toISOString(),
        version: require(path.join(compiler.context, 'package.json')).version,
        buildDate: new Date().toLocaleDateString(),
        buildTime: new Date().toLocaleTimeString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        webpack: compiler.webpack.version,
        mode: compiler.options.mode || 'production'
      };

      // Convert to JSON
      const buildInfoJson = JSON.stringify(buildInfo, null, 2);

      // Add to compilation assets
      compilation.assets[this.filename] = {
        source: () => buildInfoJson,
        size: () => buildInfoJson.length
      };

      console.log('Build info generated:', buildInfo);
      callback();
    });
  }
}

module.exports = BuildInfoPlugin;