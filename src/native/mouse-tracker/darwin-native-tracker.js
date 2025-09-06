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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DarwinNativeTracker = void 0;
const base_tracker_1 = require("./base-tracker");
const path = __importStar(require("path"));
/**
 * Native macOS mouse tracker using Core Graphics
 */
class DarwinNativeTracker extends base_tracker_1.BaseMouseTracker {
    constructor() {
        super();
        this.nativeTracker = null;
        this.pollingInterval = null;
        // Load the native module - try multiple paths
        // When running from dist, we need to look in the src directory
        const possiblePaths = [
            // Direct path from project root (most reliable)
            path.join(process.cwd(), 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
            // Look for the copied module in dist/main
            path.join(process.cwd(), 'dist', 'main', 'mouse_tracker_darwin.node'),
            // Webpack may bundle it with a hash
            path.join(__dirname, '..', '4ea58c2179beb80aedba968829348ba5.node'),
            // Relative to dist directory
            path.join(__dirname, '..', '..', '..', '..', 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
            // Development path
            path.join(__dirname, 'build', 'Release', 'mouse_tracker_darwin.node')
        ];
        let nativeModule = null;
        let loadedPath = '';
        for (const modulePath of possiblePaths) {
            try {
                nativeModule = require(modulePath);
                loadedPath = modulePath;
                console.log('✅ Successfully loaded native macOS tracker from:', loadedPath);
                break;
            }
            catch (err) {
                // Log which path failed for debugging
                console.debug(`Tried loading from: ${modulePath} - not found`);
                continue;
            }
        }
        if (!nativeModule) {
            throw new Error(`Failed to load native module from any of: ${possiblePaths.join(', ')}`);
        }
        try {
            // Create the tracker instance
            this.nativeTracker = new nativeModule.MacOSMouseTracker();
            console.log('Created MacOSMouseTracker instance');
            // Set up the mouse move callback
            this.nativeTracker.onMouseMove((x, y, leftButton, rightButton) => {
                const position = {
                    x,
                    y,
                    timestamp: Date.now(),
                    leftButtonDown: leftButton
                };
                // Log button state changes for debugging
                const currentPos = this.getCurrentPosition();
                if (currentPos.leftButtonDown !== leftButton) {
                    console.log(`🖱️ Left button ${leftButton ? 'pressed' : 'released'}`);
                }
                this.updatePosition(x, y, position);
            });
            // Set up button state change callback
            this.nativeTracker.onButtonStateChange((leftButton, rightButton) => {
                console.log(`🎯 Button state changed - Left: ${leftButton}, Right: ${rightButton}`);
                // Update current position with new button state
                const currentPos = this.getCurrentPosition();
                const position = {
                    x: currentPos.x,
                    y: currentPos.y,
                    timestamp: Date.now(),
                    leftButtonDown: leftButton
                };
                this.updatePosition(position.x, position.y, position);
                // Emit button state change event
                this.emit('buttonStateChange', {
                    leftButtonDown: leftButton,
                    rightButtonDown: rightButton,
                    timestamp: Date.now()
                });
            });
            console.log('Native macOS tracker initialized successfully');
        }
        catch (error) {
            console.error('Failed to load native module:', error);
            throw new Error(`Failed to initialize native macOS tracker: ${error}`);
        }
    }
    /**
     * Start tracking mouse position
     */
    start() {
        if (this.isActive) {
            console.warn('DarwinNativeTracker is already tracking');
            return;
        }
        try {
            const success = this.nativeTracker.start();
            if (success) {
                this.isActive = true;
                console.log('✅ Native macOS mouse tracking started with button detection');
                // Also start a fallback polling mechanism just in case
                this.startPolling();
            }
            else {
                throw new Error('Failed to start native tracker - may need accessibility permissions');
            }
        }
        catch (error) {
            console.error('Failed to start DarwinNativeTracker:', error);
            // Check for accessibility permission error
            if (error instanceof Error && error.message.includes('accessibility')) {
                console.error('\n⚠️  IMPORTANT: Accessibility permission required!');
                console.error('Please grant permission in:');
                console.error('System Preferences > Security & Privacy > Privacy > Accessibility');
                console.error('Add and enable your terminal or Electron app\n');
                // Emit error event
                this.emit('error', new Error('Accessibility permission required'));
            }
            this.handleError(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Start fallback polling for position updates
     */
    startPolling() {
        // Poll every 16ms (60 FPS) as a fallback
        this.pollingInterval = setInterval(() => {
            // The native module callbacks should handle updates
            // This is just a safety mechanism
        }, 16);
    }
    /**
     * Stop fallback polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    /**
     * Stop tracking mouse position
     */
    stop() {
        if (!this.isActive) {
            console.warn('DarwinNativeTracker is not tracking');
            return;
        }
        try {
            this.stopPolling();
            if (this.nativeTracker) {
                this.nativeTracker.stop();
            }
            this.isActive = false;
            console.log('Native macOS mouse tracking stopped');
        }
        catch (error) {
            console.error('Failed to stop DarwinNativeTracker:', error);
            this.handleError(error);
        }
    }
    /**
     * Initialize the native tracking
     */
    initializeTracking() {
        // Handled in start()
    }
    /**
     * Cleanup the native tracking
     */
    cleanupTracking() {
        // Handled in stop()
    }
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.isActive) {
            this.stop();
        }
        this.nativeTracker = null;
        super.destroy();
    }
}
exports.DarwinNativeTracker = DarwinNativeTracker;
//# sourceMappingURL=darwin-native-tracker.js.map