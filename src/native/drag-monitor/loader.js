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
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Direct native module loading for Electron
function loadNativeModule() {
    const moduleName = 'drag_monitor_darwin.node';
    // In production, module is next to this file
    // In development, it's in the build directory
    const possiblePaths = [
        path.join(__dirname, moduleName),
        path.join(__dirname, 'build', 'Release', moduleName),
        path.join(process.cwd(), 'src', 'native', 'drag-monitor', 'build', 'Release', moduleName),
    ];
    for (const modulePath of possiblePaths) {
        if (fs.existsSync(modulePath)) {
            try {
                const nativeModule = require(modulePath);
                console.log(`✅ Native drag monitor loaded from: ${modulePath}`);
                return nativeModule;
            }
            catch (error) {
                console.error(`Failed to load from ${modulePath}:`, error.message);
            }
        }
    }
    throw new Error('Native drag monitor module not found. Run: npm run rebuild:native');
}
const nativeModule = loadNativeModule();
class MacDragMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.nativeMonitor = null;
        this.isMonitoring = false;
        if (!nativeModule || !nativeModule.DarwinDragMonitor) {
            throw new Error('Native module loaded but DarwinDragMonitor class not found');
        }
        // Create native monitor with callbacks
        this.nativeMonitor = new nativeModule.DarwinDragMonitor({
            onDragStart: (event) => {
                console.log('🎯 Native drag started', event);
                if (event.hasFiles) {
                    this.emit('dragStart', []);
                }
            },
            onDragEnd: (event) => {
                console.log('🛑 Native drag ended');
                this.emit('dragEnd');
            },
            onDragData: (event) => {
                if (event.files && event.files.length > 0) {
                    console.log(`📁 Dragging ${event.files.length} files`);
                    const items = event.files.map((file) => ({
                        path: file.path,
                        name: file.name || path.basename(file.path),
                        type: file.type === 'folder' ? 'folder' : 'file',
                        size: file.size,
                        extension: file.extension,
                        exists: file.exists !== false
                    }));
                    this.emit('dragStart', items);
                    this.emit('dragging', items);
                }
            }
        });
    }
    start() {
        if (this.isMonitoring)
            return true;
        try {
            const result = this.nativeMonitor.start();
            if (result) {
                this.isMonitoring = true;
                this.emit('started');
                console.log('✅ Native drag monitor started');
            }
            return result;
        }
        catch (error) {
            console.error('Failed to start drag monitor:', error.message);
            this.emit('error', error);
            return false;
        }
    }
    stop() {
        if (!this.isMonitoring)
            return false;
        try {
            const result = this.nativeMonitor.stop();
            if (result) {
                this.isMonitoring = false;
                this.emit('stopped');
            }
            return result;
        }
        catch (error) {
            console.error('Failed to stop drag monitor:', error.message);
            return false;
        }
    }
    destroy() {
        this.stop();
        this.nativeMonitor = null;
        this.removeAllListeners();
    }
}
exports.MacDragMonitor = MacDragMonitor;
function createDragMonitor() {
    return new MacDragMonitor();
}
//# sourceMappingURL=loader.js.map