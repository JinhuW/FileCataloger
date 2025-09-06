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
    Napi::Value HasActiveDrag(const Napi::CallbackInfo& info);
    Napi::Value GetFileCount(const Napi::CallbackInfo& info);
    Napi::Value GetDraggedFiles(const Napi::CallbackInfo& info);
    
    void MonitoringLoop();
    bool CheckForFileDrag();
    
    std::thread* monitoringThread;
    std::atomic<bool> isMonitoring;
    std::atomic<bool> shouldStop;
    std::atomic<bool> isDragging;
    std::atomic<int> lastPasteboardChangeCount;
    
    // Polling state variables
    std::atomic<bool> hasActiveDrag;
    std::atomic<int> fileCount;
    std::vector<std::string> draggedFilePaths;
    std::mutex filePathsMutex;
    
    // Track drag state with more precision and trajectory analysis
    struct DragState {
        CGPoint startPoint;
        CGPoint lastPoint;
        std::chrono::steady_clock::time_point startTime;
        std::chrono::steady_clock::time_point lastMoveTime;
        double totalDistance;
        int moveCount;
        bool hasFiles;
        
        // Trajectory analysis
        std::vector<CGPoint> trajectory;
        int directionChanges;
        double maxVelocity;
        double avgVelocity;
        bool hasCircularMotion;
        bool hasZigzagPattern;
    };
    
    DragState dragState;
    std::mutex dragStateMutex;
    
    CFMachPortRef eventTap;
    CFRunLoopSourceRef runLoopSource;
    
    static CGEventRef DragEventCallback(CGEventTapProxy proxy, 
                                        CGEventType type, 
                                        CGEventRef event, 
                                        void* refcon);
    
    // Trajectory analysis methods
    void AnalyzeTrajectory();
    bool DetectCircularMotion();
    bool DetectZigzagPattern();
    double CalculateAngle(CGPoint p1, CGPoint p2, CGPoint p3);
};

Napi::FunctionReference DarwinDragMonitor::constructor;

Napi::Object DarwinDragMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    
    Napi::Function func = DefineClass(env, "DarwinDragMonitor", {
        InstanceMethod("start", &DarwinDragMonitor::Start),
        InstanceMethod("stop", &DarwinDragMonitor::Stop),
        InstanceMethod("isMonitoring", &DarwinDragMonitor::IsMonitoring),
        InstanceMethod("hasActiveDrag", &DarwinDragMonitor::HasActiveDrag),
        InstanceMethod("getFileCount", &DarwinDragMonitor::GetFileCount),
        InstanceMethod("getDraggedFiles", &DarwinDragMonitor::GetDraggedFiles)
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
      hasActiveDrag(false),
      fileCount(0),
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
    dragState.trajectory.clear();
    dragState.directionChanges = 0;
    dragState.maxVelocity = 0;
    dragState.avgVelocity = 0;
    dragState.hasCircularMotion = false;
    dragState.hasZigzagPattern = false;
    
    // No callbacks needed anymore - using polling instead
}

DarwinDragMonitor::~DarwinDragMonitor() {
    if (isMonitoring.load()) {
        // Clean up without calling Stop() which requires valid Napi environment
        shouldStop.store(true);
        
        if (monitoringThread && monitoringThread->joinable()) {
            monitoringThread->join();
            delete monitoringThread;
            monitoringThread = nullptr;
        }
        
        // Clear all state
        hasActiveDrag.store(false);
        fileCount.store(0);
        {
            std::lock_guard<std::mutex> lock(filePathsMutex);
            draggedFilePaths.clear();
        }
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
        
        // Enhanced file type detection - covers more drag sources
        bool hasFiles = [types containsObject:NSPasteboardTypeFileURL] ||           // Modern file URLs
                       [types containsObject:NSFilenamesPboardType] ||             // Legacy filenames
                       [types containsObject:@"public.file-url"] ||                // Public UTI for files
                       [types containsObject:@"public.folder"] ||                   // Folder UTI
                       [types containsObject:@"com.apple.pasteboard.promised-file-content"] || // Promised files
                       [types containsObject:@"com.apple.pasteboard.promised-file-url"] ||     // Promised URLs
                       [types containsObject:@"com.apple.finder.node"] ||          // Finder nodes
                       [types containsObject:@"com.apple.finder.promise"] ||       // Finder promises
                       [types containsObject:@"NSPromiseContentsPboardType"] ||    // Promise content
                       [types containsObject:@"com.apple.iWork.TSPNativeData"] || // iWork files
                       [types containsObject:@"com.apple.mail.attachment"] ||      // Mail attachments
                       [types containsObject:@"WebURLsWithTitlesPboardType"] ||    // Web downloads
                       [types containsObject:@"dyn.ah62d4rv4gu8y63n2nuuhg5pbsm4ca6dbsr4gnkduqf31k3pcr7u1e3basv61a3k"]; // Dynamic type
        
        // Check for image file drags
        if (!hasFiles) {
            hasFiles = [types containsObject:NSPasteboardTypePNG] ||
                      [types containsObject:NSPasteboardTypeTIFF] ||
                      [types containsObject:@"public.jpeg"] ||
                      [types containsObject:@"public.image"];
        }
        
        // Check for archive file drags
        if (!hasFiles) {
            hasFiles = [types containsObject:@"public.zip-archive"] ||
                      [types containsObject:@"public.archive"] ||
                      [types containsObject:@"com.pkware.zip-archive"];
        }
        
        // Log all types for debugging
        NSLog(@"[DragMonitor] Pasteboard types detected: %@", types);
        
        if (hasFiles) {
            lastPasteboardChangeCount.store(currentChangeCount);
            
            // Try to get file information
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
                // Store file paths for polling
                std::lock_guard<std::mutex> lock(filePathsMutex);
                draggedFilePaths.clear();
                
                for (NSUInteger i = 0; i < fileURLs.count; i++) {
                    NSURL* url = fileURLs[i];
                    NSString* path = [url path];
                    draggedFilePaths.push_back(std::string([path UTF8String]));
                }
                
                fileCount.store(static_cast<int>(fileURLs.count));
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
        monitor->dragState.trajectory.clear();
        monitor->dragState.trajectory.push_back(location);
        monitor->dragState.directionChanges = 0;
        monitor->dragState.maxVelocity = 0;
        monitor->dragState.avgVelocity = 0;
        monitor->dragState.hasCircularMotion = false;
        monitor->dragState.hasZigzagPattern = false;
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
        
        // Add to trajectory for analysis
        monitor->dragState.trajectory.push_back(location);
        
        // Track velocity
        auto timeDelta = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - monitor->dragState.lastMoveTime
        ).count();
        if (timeDelta > 0) {
            double velocity = moveDistance / timeDelta;
            monitor->dragState.maxVelocity = std::max(monitor->dragState.maxVelocity, velocity);
            monitor->dragState.avgVelocity = (monitor->dragState.avgVelocity * (monitor->dragState.moveCount - 1) + velocity) / monitor->dragState.moveCount;
        }
        
        // Analyze trajectory every 10 moves
        if (monitor->dragState.moveCount % 10 == 0) {
            monitor->AnalyzeTrajectory();
        }
        
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
                monitor->hasActiveDrag.store(true);
                
                // Store trajectory info for polling
                // No callbacks needed - JavaScript will poll for state
            }
        }
    }
    
    // Handle mouse up - drag end
    else if (type == kCGEventLeftMouseUp) {
        bool wasDragging = monitor->isDragging.exchange(false);
        
        if (wasDragging) {
            // Clear drag state for polling
            monitor->hasActiveDrag.store(false);
            monitor->fileCount.store(0);
            
            std::lock_guard<std::mutex> lock(monitor->filePathsMutex);
            monitor->draggedFilePaths.clear();
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
    
    // Clear all state
    hasActiveDrag.store(false);
    fileCount.store(0);
    {
        std::lock_guard<std::mutex> lock(filePathsMutex);
        draggedFilePaths.clear();
    }
    
    return Napi::Boolean::New(env, true);
}

Napi::Value DarwinDragMonitor::IsMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isMonitoring.load());
}

Napi::Value DarwinDragMonitor::HasActiveDrag(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, hasActiveDrag.load());
}

Napi::Value DarwinDragMonitor::GetFileCount(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, fileCount.load());
}

Napi::Value DarwinDragMonitor::GetDraggedFiles(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Array files = Napi::Array::New(env);
    
    std::lock_guard<std::mutex> lock(filePathsMutex);
    for (size_t i = 0; i < draggedFilePaths.size(); i++) {
        Napi::Object fileInfo = Napi::Object::New(env);
        std::string filePath = draggedFilePaths[i];
        
        fileInfo.Set("path", filePath);
        fileInfo.Set("name", filePath.substr(filePath.find_last_of("/\\") + 1));
        
        // Check if file exists and get type
        @autoreleasepool {
            NSString* nsPath = [NSString stringWithUTF8String:filePath.c_str()];
            NSFileManager* fileManager = [NSFileManager defaultManager];
            
            BOOL isDirectory = NO;
            BOOL exists = [fileManager fileExistsAtPath:nsPath isDirectory:&isDirectory];
            
            fileInfo.Set("type", isDirectory ? "folder" : "file");
            fileInfo.Set("isDirectory", isDirectory);
            fileInfo.Set("isFile", !isDirectory);
            fileInfo.Set("exists", exists);
            
            // Get file extension
            NSString* extension = [nsPath pathExtension];
            if (extension && extension.length > 0) {
                fileInfo.Set("extension", std::string([extension UTF8String]));
            }
            
            // Get file size for files
            if (exists && !isDirectory) {
                NSError* error = nil;
                NSDictionary* attributes = [fileManager attributesOfItemAtPath:nsPath error:&error];
                if (attributes) {
                    NSNumber* fileSize = [attributes objectForKey:NSFileSize];
                    if (fileSize) {
                        fileInfo.Set("size", [fileSize longLongValue]);
                    }
                }
            }
        }
        
        files.Set(i, fileInfo);
    }
    
    return files;
}

// Trajectory analysis implementation
void DarwinDragMonitor::AnalyzeTrajectory() {
    if (dragState.trajectory.size() < 3) return;
    
    // Detect direction changes
    int directionChanges = 0;
    for (size_t i = 2; i < dragState.trajectory.size(); i++) {
        double angle = CalculateAngle(
            dragState.trajectory[i-2],
            dragState.trajectory[i-1],
            dragState.trajectory[i]
        );
        
        // Significant direction change (> 45 degrees)
        if (angle > M_PI / 4) {
            directionChanges++;
        }
    }
    dragState.directionChanges = directionChanges;
    
    // Detect patterns
    dragState.hasCircularMotion = DetectCircularMotion();
    dragState.hasZigzagPattern = DetectZigzagPattern();
}

bool DarwinDragMonitor::DetectCircularMotion() {
    if (dragState.trajectory.size() < 8) return false;
    
    // Check if start and end points are close (circular)
    CGPoint start = dragState.trajectory.front();
    CGPoint current = dragState.trajectory.back();
    double distance = sqrt(pow(current.x - start.x, 2) + pow(current.y - start.y, 2));
    
    // If we've moved significantly but are close to start, it's circular
    if (dragState.totalDistance > 100 && distance < 50) {
        return true;
    }
    
    // Check for curved motion by analyzing angles
    int curveCount = 0;
    for (size_t i = 3; i < dragState.trajectory.size(); i += 3) {
        double angle = CalculateAngle(
            dragState.trajectory[i-3],
            dragState.trajectory[i-1],
            dragState.trajectory[i]
        );
        
        // Consistent small angles indicate curved motion
        if (angle > 0.1 && angle < M_PI / 3) {
            curveCount++;
        }
    }
    
    return curveCount > dragState.trajectory.size() / 6;
}

bool DarwinDragMonitor::DetectZigzagPattern() {
    if (dragState.directionChanges < 3) return false;
    
    // Zigzag pattern has many direction changes relative to distance
    double changeRate = (double)dragState.directionChanges / dragState.trajectory.size();
    
    // High rate of direction changes indicates zigzag
    return changeRate > 0.3;
}

double DarwinDragMonitor::CalculateAngle(CGPoint p1, CGPoint p2, CGPoint p3) {
    // Calculate angle between three points
    double v1x = p2.x - p1.x;
    double v1y = p2.y - p1.y;
    double v2x = p3.x - p2.x;
    double v2y = p3.y - p2.y;
    
    double dot = v1x * v2x + v1y * v2y;
    double cross = v1x * v2y - v1y * v2x;
    
    return atan2(cross, dot);
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return DarwinDragMonitor::Init(env, exports);
}

NODE_API_MODULE(drag_monitor_darwin, InitAll)