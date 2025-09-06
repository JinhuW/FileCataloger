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
exports.MacDragMonitor = void 0;
exports.createDragMonitor = createDragMonitor;
exports.isNativeModuleAvailable = isNativeModuleAvailable;
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Try to load the native module directly
let nativeModule = null;
try {
    // First try: Direct require of the node file that webpack copies
    // Webpack should copy drag_monitor_darwin.node to dist/main/
    nativeModule = require('./drag_monitor_darwin.node');
    console.log('✅ Loaded native drag monitor via direct require');
}
catch (e1) {
    console.log('Direct require failed, trying alternate paths...');
    try {
        // Second try: Load from build directory
        nativeModule = require('./build/Release/drag_monitor_darwin.node');
        console.log('✅ Loaded native drag monitor from build directory');
    }
    catch (e2) {
        try {
            // Third try: Use absolute path
            const modulePath = path.join(process.cwd(), 'dist', 'main', 'drag_monitor_darwin.node');
            if (fs.existsSync(modulePath)) {
                nativeModule = require(modulePath);
                console.log('✅ Loaded native drag monitor from absolute path:', modulePath);
            }
        }
        catch (e3) {
            console.error('❌ Could not load native drag monitor module');
        }
    }
}
// Log the module load result
if (nativeModule) {
    console.log('🔍 Native module load result:', {
        hasModule: true,
        hasDarwinDragMonitor: !!(nativeModule.DarwinDragMonitor),
        moduleKeys: Object.keys(nativeModule)
    });
}
else {
    console.log('🔍 Native module load result: Module not loaded');
}
class MacDragMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.nativeMonitor = null;
        this.isMonitoring = false;
        this.initializeNativeMonitor();
    }
    initializeNativeMonitor() {
        if (!nativeModule) {
            throw new Error('Native drag monitor module not available. Run: cd src/native/drag-monitor && node-gyp rebuild');
        }
        if (!nativeModule.DarwinDragMonitor) {
            throw new Error('DarwinDragMonitor class not found in native module');
        }
        try {
            // Create callbacks object for native monitor
            const callbacks = {
                onDragStart: (event) => {
                    console.log('🎯 Native drag started', event);
                    // Check if we have file data
                    if (event.hasFiles) {
                        console.log('📁 Files detected in drag operation');
                        // Emit empty array first, files will come in onDragData
                        this.emit('dragStart', []);
                    }
                    if (event.trajectory) {
                        console.log('📈 Drag trajectory:', event.trajectory);
                    }
                },
                onDragEnd: (event) => {
                    console.log('🛑 Native drag ended', event);
                    this.emit('dragEnd');
                },
                onDragData: (event) => {
                    console.log('📁 Native drag data received:', event);
                    if (event.files && event.files.length > 0) {
                        console.log(`📂 Processing ${event.files.length} dragged items`);
                        const items = event.files.map((file) => {
                            const item = {
                                path: file.path,
                                name: file.name || path.basename(file.path),
                                type: (file.type === 'folder' ? 'folder' : 'file'),
                                isDirectory: file.type === 'folder',
                                isFile: file.type === 'file',
                                size: file.size,
                                extension: file.extension,
                                exists: file.exists !== false
                            };
                            console.log(`  - ${item.type}: ${item.name}`);
                            return item;
                        });
                        // Emit both dragStart and dragging with file data
                        this.emit('dragStart', items);
                        this.emit('dragging', items);
                    }
                }
            };
            // Create native monitor instance with callbacks
            this.nativeMonitor = new nativeModule.DarwinDragMonitor(callbacks);
            console.log('✅ Native DarwinDragMonitor instance created successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize native drag monitor:', error);
            console.error('Error details:', error.message);
            throw error;
        }
    }
    start() {
        if (this.isMonitoring) {
            return false;
        }
        if (!this.nativeMonitor) {
            return false;
        }
        try {
            const result = this.nativeMonitor.start();
            if (result) {
                this.isMonitoring = true;
                this.emit('started');
                console.log('✅ Native drag monitor started successfully');
            }
            else {
                console.warn('⚠️ Native drag monitor failed to start - may need accessibility permissions');
            }
            return result;
        }
        catch (error) {
            console.error('❌ Failed to start drag monitor:', error);
            this.emit('error', error);
            return false;
        }
    }
    stop() {
        if (!this.isMonitoring) {
            return false;
        }
        if (!this.nativeMonitor) {
            return false;
        }
        try {
            const result = this.nativeMonitor.stop();
            if (result) {
                this.isMonitoring = false;
                this.emit('stopped');
            }
            return result;
        }
        catch (error) {
            console.error('❌ Failed to stop drag monitor:', error);
            this.emit('error', error);
            return false;
        }
    }
    isDragging() {
        return this.nativeMonitor?.isMonitoring() || false;
    }
    getDraggedItems() {
        return [];
    }
    destroy() {
        if (this.isMonitoring) {
            this.stop();
        }
        this.nativeMonitor = null;
        this.removeAllListeners();
    }
}
exports.MacDragMonitor = MacDragMonitor;
function createDragMonitor() {
    try {
        return new MacDragMonitor();
    }
    catch (error) {
        console.error('❌ Could not create MacDragMonitor:', error);
        return null;
    }
}
function isNativeModuleAvailable() {
    return nativeModule !== null && nativeModule.DarwinDragMonitor !== undefined;
}
//# sourceMappingURL=index.js.map