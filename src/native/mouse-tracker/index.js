"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMouseTracker = createMouseTracker;
const node_tracker_1 = require("./node-tracker");
const darwin_native_tracker_1 = require("./darwin-native-tracker");
/**
 * Factory function to create appropriate mouse tracker for the current platform
 */
function createMouseTracker() {
    const platform = process.platform;
    try {
        switch (platform) {
            case 'darwin':
                // Try to use native macOS tracker with CGEventTap
                try {
                    const tracker = new darwin_native_tracker_1.DarwinNativeTracker();
                    console.log('Successfully initialized native macOS mouse tracker');
                    return tracker;
                }
                catch (nativeError) {
                    console.warn('Native macOS tracker unavailable, falling back to Node.js implementation');
                    console.warn('This is normal if native modules haven\'t been built yet.');
                    return new node_tracker_1.NodeMouseTracker();
                }
            case 'win32':
                // Native Windows tracker not yet implemented, use Node.js fallback  
                console.warn('Windows native tracker not yet implemented, using Node.js tracker');
                return new node_tracker_1.NodeMouseTracker();
            case 'linux':
                // Native Linux tracker not yet implemented, use Node.js fallback
                console.warn('Linux native tracker not yet implemented, using Node.js tracker');
                return new node_tracker_1.NodeMouseTracker();
            default:
                console.warn(`Unsupported platform: ${platform}, using Node.js fallback`);
                return new node_tracker_1.NodeMouseTracker();
        }
    }
    catch (error) {
        console.error('Failed to create mouse tracker, using Node.js fallback:', error);
        return new node_tracker_1.NodeMouseTracker();
    }
}
__exportStar(require("./base-tracker"), exports);
__exportStar(require("./node-tracker"), exports);
//# sourceMappingURL=index.js.map