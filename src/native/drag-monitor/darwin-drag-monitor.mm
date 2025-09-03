#include <napi.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ApplicationServices/ApplicationServices.h>
#include <AppKit/AppKit.h>
#include <thread>
#include <atomic>
#include <chrono>
#include <cmath>
#include <mutex>

class DarwinDragMonitor : public Napi::ObjectWrap<DarwinDragMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    DarwinDragMonitor(const Napi::CallbackInfo& info);
    ~DarwinDragMonitor();

private:
    static Napi::FunctionReference constructor;
    
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value IsMonitoring(const Napi::CallbackInfo& info);
    
    void MonitoringLoop();
    bool CheckForFileDrag();
    
    std::thread* monitoringThread;
    std::atomic<bool> isMonitoring;
    std::atomic<bool> shouldStop;
    std::atomic<bool> isDragging;
    std::atomic<int> lastPasteboardChangeCount;
    
    // Track drag state with more precision
    struct DragState {
        CGPoint startPoint;
        CGPoint lastPoint;
        std::chrono::steady_clock::time_point startTime;
        std::chrono::steady_clock::time_point lastMoveTime;
        double totalDistance;
        int moveCount;
        bool hasFiles;
    };
    
    DragState dragState;
    std::mutex dragStateMutex;
    
    Napi::ThreadSafeFunction dragStartCallback;
    Napi::ThreadSafeFunction dragEndCallback;
    Napi::ThreadSafeFunction dragDataCallback;
    
    CFMachPortRef eventTap;
    CFRunLoopSourceRef runLoopSource;
    
    static CGEventRef DragEventCallback(CGEventTapProxy proxy, 
                                        CGEventType type, 
                                        CGEventRef event, 
                                        void* refcon);
};

Napi::FunctionReference DarwinDragMonitor::constructor;

Napi::Object DarwinDragMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    
    Napi::Function func = DefineClass(env, "DarwinDragMonitor", {
        InstanceMethod("start", &DarwinDragMonitor::Start),
        InstanceMethod("stop", &DarwinDragMonitor::Stop),
        InstanceMethod("isMonitoring", &DarwinDragMonitor::IsMonitoring)
    });
    
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    
    exports.Set("DarwinDragMonitor", func);
    return exports;
}

DarwinDragMonitor::DarwinDragMonitor(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<DarwinDragMonitor>(info), 
      monitoringThread(nullptr),
      isMonitoring(false),
      shouldStop(false),
      isDragging(false),
      lastPasteboardChangeCount(-1),
      eventTap(nullptr),
      runLoopSource(nullptr) {
    
    // Initialize drag state
    dragState.startPoint = {0, 0};
    dragState.lastPoint = {0, 0};
    dragState.startTime = std::chrono::steady_clock::now();
    dragState.lastMoveTime = std::chrono::steady_clock::now();
    dragState.totalDistance = 0;
    dragState.moveCount = 0;
    dragState.hasFiles = false;
    
    Napi::Env env = info.Env();
    
    // Create ThreadSafeFunctions for callbacks
    if (info.Length() > 0 && info[0].IsObject()) {
        Napi::Object callbacks = info[0].As<Napi::Object>();
        
        if (callbacks.Has("onDragStart") && callbacks.Get("onDragStart").IsFunction()) {
            dragStartCallback = Napi::ThreadSafeFunction::New(
                env,
                callbacks.Get("onDragStart").As<Napi::Function>(),
                "DragStart",
                0,
                1
            );
        }
        
        if (callbacks.Has("onDragEnd") && callbacks.Get("onDragEnd").IsFunction()) {
            dragEndCallback = Napi::ThreadSafeFunction::New(
                env,
                callbacks.Get("onDragEnd").As<Napi::Function>(),
                "DragEnd",
                0,
                1
            );
        }
        
        if (callbacks.Has("onDragData") && callbacks.Get("onDragData").IsFunction()) {
            dragDataCallback = Napi::ThreadSafeFunction::New(
                env,
                callbacks.Get("onDragData").As<Napi::Function>(),
                "DragData",
                0,
                1
            );
        }
    }
}

DarwinDragMonitor::~DarwinDragMonitor() {
    if (isMonitoring.load()) {
        Stop(Napi::CallbackInfo(nullptr, nullptr));
    }
}

bool DarwinDragMonitor::CheckForFileDrag() {
    @autoreleasepool {
        NSPasteboard* dragPasteboard = [NSPasteboard pasteboardWithName:NSPasteboardNameDrag];
        if (!dragPasteboard) return false;
        
        NSInteger currentChangeCount = [dragPasteboard changeCount];
        
        // Only process if pasteboard has changed
        if (currentChangeCount <= lastPasteboardChangeCount.load()) {
            return false;
        }
        
        NSArray* types = [dragPasteboard types];
        
        // Check for multiple file-related pasteboard types
        // This covers dragging from Desktop, Finder, web browsers, and other apps
        bool hasFiles = [types containsObject:NSPasteboardTypeFileURL] ||           // Modern file URLs
                       [types containsObject:NSFilenamesPboardType] ||             // Legacy filenames
                       [types containsObject:@"public.file-url"] ||                // Public UTI for files
                       [types containsObject:@"com.apple.pasteboard.promised-file-content"] || // Promised files
                       [types containsObject:@"dyn.ah62d4rv4gu8y63n2nuuhg5pbsm4ca6dbsr4gnkduqf31k3pcr7u1e3basv61a3k"] || // Dynamic type for files
                       [types containsObject:@"NSPromiseContentsPboardType"];      // Promise content
        
        // Also check if it contains file promises (for downloads from browsers)
        if (!hasFiles && [types containsObject:@"com.apple.pasteboard.promised-file-url"]) {
            hasFiles = true;
        }
        
        // Log all types for debugging
        NSLog(@"[DragMonitor] Pasteboard types detected: %@", types);
        
        if (hasFiles) {
            lastPasteboardChangeCount.store(currentChangeCount);
            
            // Try to get file information
            if (dragDataCallback) {
                NSArray* fileURLs = nil;
                
                // Try multiple methods to extract file URLs
                if ([types containsObject:NSPasteboardTypeFileURL]) {
                    // Modern way - works for most drags including Desktop
                    fileURLs = [dragPasteboard readObjectsForClasses:@[[NSURL class]] 
                                                            options:@{NSPasteboardURLReadingFileURLsOnlyKey: @YES}];
                } 
                
                if ((!fileURLs || fileURLs.count == 0) && [types containsObject:NSFilenamesPboardType]) {
                    // Legacy way - still used by some apps
                    NSArray* filenames = [dragPasteboard propertyListForType:NSFilenamesPboardType];
                    if (filenames) {
                        NSMutableArray* urls = [NSMutableArray arrayWithCapacity:filenames.count];
                        for (NSString* filename in filenames) {
                            NSURL* url = [NSURL fileURLWithPath:filename];
                            if (url) [urls addObject:url];
                        }
                        fileURLs = urls;
                    }
                }
                
                // Try public.file-url if other methods failed
                if ((!fileURLs || fileURLs.count == 0) && [types containsObject:@"public.file-url"]) {
                    NSString* urlString = [dragPasteboard stringForType:@"public.file-url"];
                    if (urlString) {
                        NSURL* url = [NSURL URLWithString:urlString];
                        if (url) {
                            fileURLs = @[url];
                        }
                    }
                }
                
                if (fileURLs && fileURLs.count > 0) {
                    auto callback = [fileURLs](Napi::Env env, Napi::Function jsCallback) {
                        Napi::Array files = Napi::Array::New(env);
                        
                        for (NSUInteger i = 0; i < fileURLs.count; i++) {
                            NSURL* url = fileURLs[i];
                            Napi::Object fileInfo = Napi::Object::New(env);
                            fileInfo.Set("path", std::string([[url path] UTF8String]));
                            fileInfo.Set("name", std::string([[url lastPathComponent] UTF8String]));
                            files.Set(i, fileInfo);
                        }
                        
                        Napi::Object result = Napi::Object::New(env);
                        result.Set("type", "files");
                        result.Set("files", files);
                        result.Set("timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::system_clock::now().time_since_epoch()
                        ).count());
                        jsCallback.Call({result});
                    };
                    
                    dragDataCallback.NonBlockingCall(callback);
                }
            }
            
            return true;
        }
        
        return false;
    }
}

CGEventRef DarwinDragMonitor::DragEventCallback(CGEventTapProxy proxy, 
                                                CGEventType type, 
                                                CGEventRef event, 
                                                void* refcon) {
    DarwinDragMonitor* monitor = static_cast<DarwinDragMonitor*>(refcon);
    CGPoint location = CGEventGetLocation(event);
    
    std::lock_guard<std::mutex> lock(monitor->dragStateMutex);
    
    // Handle mouse down - potential drag start
    if (type == kCGEventLeftMouseDown) {
        // Reset drag state
        monitor->dragState.startPoint = location;
        monitor->dragState.lastPoint = location;
        monitor->dragState.startTime = std::chrono::steady_clock::now();
        monitor->dragState.lastMoveTime = std::chrono::steady_clock::now();
        monitor->dragState.totalDistance = 0;
        monitor->dragState.moveCount = 0;
        monitor->dragState.hasFiles = false;
        monitor->isDragging.store(false);
    }
    
    // Handle mouse dragged
    else if (type == kCGEventLeftMouseDragged) {
        auto now = std::chrono::steady_clock::now();
        
        // Calculate movement
        double dx = location.x - monitor->dragState.lastPoint.x;
        double dy = location.y - monitor->dragState.lastPoint.y;
        double moveDistance = sqrt(dx * dx + dy * dy);
        
        // Update drag state
        monitor->dragState.totalDistance += moveDistance;
        monitor->dragState.lastPoint = location;
        monitor->dragState.moveCount++;
        monitor->dragState.lastMoveTime = now;
        
        // Calculate time since drag started
        auto dragDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - monitor->dragState.startTime
        ).count();
        
        // Check for file drag only after minimum drag distance and time
        // This helps filter out accidental clicks
        const double MIN_DRAG_DISTANCE = 3.0;   // pixels - reduced for faster detection
        const int MIN_DRAG_TIME = 10;           // milliseconds - much faster response
        const int MIN_MOVE_COUNT = 1;           // number of drag events - immediate check
        
        bool shouldCheckForFiles = 
            monitor->dragState.totalDistance >= MIN_DRAG_DISTANCE &&
            dragDuration >= MIN_DRAG_TIME &&
            monitor->dragState.moveCount >= MIN_MOVE_COUNT;
        
        if (shouldCheckForFiles && !monitor->dragState.hasFiles && !monitor->isDragging.load()) {
            // Check if this is a file drag
            if (monitor->CheckForFileDrag()) {
                monitor->dragState.hasFiles = true;
                monitor->isDragging.store(true);
                
                // Notify drag start
                if (monitor->dragStartCallback) {
                    auto callback = [](Napi::Env env, Napi::Function jsCallback) {
                        Napi::Object result = Napi::Object::New(env);
                        result.Set("timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::system_clock::now().time_since_epoch()
                        ).count());
                        result.Set("hasFiles", true);
                        jsCallback.Call({result});
                    };
                    
                    monitor->dragStartCallback.NonBlockingCall(callback);
                }
            }
        }
    }
    
    // Handle mouse up - drag end
    else if (type == kCGEventLeftMouseUp) {
        bool wasDragging = monitor->isDragging.exchange(false);
        
        if (wasDragging && monitor->dragEndCallback) {
            // Notify drag end
            auto callback = [](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object result = Napi::Object::New(env);
                result.Set("timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()
                ).count());
                jsCallback.Call({result});
            };
            
            monitor->dragEndCallback.NonBlockingCall(callback);
        }
        
        // Reset state
        monitor->dragState.hasFiles = false;
        monitor->dragState.totalDistance = 0;
        monitor->dragState.moveCount = 0;
    }
    
    return event;
}

Napi::Value DarwinDragMonitor::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isMonitoring.load()) {
        return Napi::Boolean::New(env, true);
    }
    
    // Request accessibility permissions if needed
    if (!AXIsProcessTrustedWithOptions(nullptr)) {
        CFStringRef keys[] = { kAXTrustedCheckOptionPrompt };
        CFBooleanRef values[] = { kCFBooleanTrue };
        CFDictionaryRef options = CFDictionaryCreate(
            kCFAllocatorDefault,
            (const void**)keys,
            (const void**)values,
            1,
            &kCFTypeDictionaryKeyCallBacks,
            &kCFTypeDictionaryValueCallBacks
        );
        
        bool trusted = AXIsProcessTrustedWithOptions(options);
        CFRelease(options);
        
        if (!trusted) {
            Napi::Error::New(env, "Accessibility permission required for drag monitoring")
                .ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
    }
    
    isMonitoring.store(true);
    shouldStop.store(false);
    
    // Start monitoring thread
    monitoringThread = new std::thread(&DarwinDragMonitor::MonitoringLoop, this);
    
    return Napi::Boolean::New(env, true);
}

void DarwinDragMonitor::MonitoringLoop() {
    // Create event tap for mouse events
    CGEventMask eventMask = (1 << kCGEventLeftMouseDown) | 
                           (1 << kCGEventLeftMouseUp) |
                           (1 << kCGEventLeftMouseDragged);
    
    eventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,
        eventMask,
        DragEventCallback,
        this
    );
    
    if (!eventTap) {
        isMonitoring.store(false);
        return;
    }
    
    runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);
    
    // Run the event loop
    while (!shouldStop.load()) {
        CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, false);
    }
    
    // Cleanup
    CGEventTapEnable(eventTap, false);
    CFRunLoopRemoveSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
    CFRelease(runLoopSource);
    CFRelease(eventTap);
    
    isMonitoring.store(false);
}

Napi::Value DarwinDragMonitor::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!isMonitoring.load()) {
        return Napi::Boolean::New(env, false);
    }
    
    shouldStop.store(true);
    
    if (monitoringThread && monitoringThread->joinable()) {
        monitoringThread->join();
        delete monitoringThread;
        monitoringThread = nullptr;
    }
    
    if (dragStartCallback) {
        dragStartCallback.Release();
    }
    
    if (dragEndCallback) {
        dragEndCallback.Release();
    }
    
    if (dragDataCallback) {
        dragDataCallback.Release();
    }
    
    return Napi::Boolean::New(env, true);
}

Napi::Value DarwinDragMonitor::IsMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isMonitoring.load());
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return DarwinDragMonitor::Init(env, exports);
}

NODE_API_MODULE(drag_monitor_darwin, InitAll)