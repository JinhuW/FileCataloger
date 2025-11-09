#include <napi.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ApplicationServices/ApplicationServices.h>
#include <AppKit/AppKit.h>
#include <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#include <thread>
#include <atomic>
#include <chrono>
#include <cmath>
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif
#include <mutex>
#include <queue>
#include <condition_variable>
#include <memory>

// RAII wrappers for CoreFoundation types
template<typename T>
struct CFDeleter {
    void operator()(T ref) {
        if (ref) CFRelease(ref);
    }
};

template<typename T>
using CFUniquePtr = std::unique_ptr<typename std::remove_pointer<T>::type, CFDeleter<T>>;

// RAII wrapper for CFRunLoopTimer
class CFTimerWrapper {
private:
    CFRunLoopTimerRef timer_;
    CFRunLoopRef runLoop_;

public:
    CFTimerWrapper() : timer_(nullptr), runLoop_(nullptr) {}

    ~CFTimerWrapper() {
        if (timer_ && runLoop_) {
            CFRunLoopRemoveTimer(runLoop_, timer_, kCFRunLoopCommonModes);
            CFRunLoopTimerInvalidate(timer_);
            CFRelease(timer_);
        }
    }

    void create(CFTimeInterval interval, CFRunLoopTimerCallBack callback, void* info) {
        CFRunLoopTimerContext context = {0, info, NULL, NULL, NULL};
        timer_ = CFRunLoopTimerCreate(
            kCFAllocatorDefault,
            CFAbsoluteTimeGetCurrent() + interval,
            interval,
            0, 0,
            callback,
            &context
        );
        runLoop_ = CFRunLoopGetCurrent();
        if (timer_ && runLoop_) {
            CFRunLoopAddTimer(runLoop_, timer_, kCFRunLoopCommonModes);
        }
    }

    bool isValid() const { return timer_ != nullptr; }
};

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
    void RunAnalysisThread();
    
    std::thread* monitoringThread;
    std::atomic<bool> isMonitoring;
    std::atomic<bool> shouldStop;
    std::atomic<bool> isDragging;
    std::atomic<int> lastPasteboardChangeCount;
    std::chrono::steady_clock::time_point mouseDownTime;

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

        // Trajectory analysis with bounded size
        static constexpr size_t MAX_TRAJECTORY_POINTS = 100;
        std::deque<CGPoint> trajectory;  // Use deque for efficient front removal
        int directionChanges;
        double maxVelocity;
        double avgVelocity;
        bool hasCircularMotion;
        bool hasZigzagPattern;
    };
    
    // Use double buffering for lock-free drag state updates
    DragState dragStateBuffers[2];
    std::atomic<int> activeDragBuffer{0};
    std::atomic<bool> dragStateUpdating{false};
    
    CFMachPortRef eventTap;
    CFRunLoopSourceRef runLoopSource;

    // Background analysis thread
    std::thread analysisThread;
    std::atomic<bool> analysisRunning{false};
    std::mutex analysisQueueMutex;
    std::condition_variable analysisCV;
    struct AnalysisTask {
        std::chrono::steady_clock::time_point timestamp;
        std::deque<CGPoint> trajectory;  // Copy for thread safety
    };
    std::queue<AnalysisTask> analysisQueue;

    // Delayed file path clearing to prevent race condition
    CFTimerWrapper clearPathsTimer;
    std::atomic<bool> hasPendingClear{false};
    
    static CGEventRef DragEventCallback(CGEventTapProxy proxy, 
                                        CGEventType type, 
                                        CGEventRef event, 
                                        void* refcon);
    
    // Trajectory analysis methods
    void AnalyzeTrajectory();
    bool DetectCircularMotion();
    bool DetectZigzagPattern();
    double CalculateAngle(CGPoint p1, CGPoint p2, CGPoint p3);

    // Delayed file path clearing
    void ScheduleClearFilePaths();
    static void ClearFilePathsCallback(CFRunLoopTimerRef timer, void* info);
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
    
    // Initialize both drag state buffers
    for (int i = 0; i < 2; i++) {
        dragStateBuffers[i].startPoint = {0, 0};
        dragStateBuffers[i].lastPoint = {0, 0};
        dragStateBuffers[i].startTime = std::chrono::steady_clock::now();
        dragStateBuffers[i].lastMoveTime = std::chrono::steady_clock::now();
        dragStateBuffers[i].totalDistance = 0;
        dragStateBuffers[i].moveCount = 0;
        dragStateBuffers[i].hasFiles = false;
        dragStateBuffers[i].trajectory.clear();
        dragStateBuffers[i].directionChanges = 0;
        dragStateBuffers[i].maxVelocity = 0;
        dragStateBuffers[i].avgVelocity = 0;
        dragStateBuffers[i].hasCircularMotion = false;
        dragStateBuffers[i].hasZigzagPattern = false;
    }
    
    // No callbacks needed anymore - using polling instead
}

DarwinDragMonitor::~DarwinDragMonitor() {
    if (isMonitoring.load()) {
        // Clean up without calling Stop() which requires valid Napi environment
        shouldStop.store(true);
        analysisRunning.store(false);

        // Notify analysis thread to wake up and exit
        analysisCV.notify_all();

        if (analysisThread.joinable()) {
            analysisThread.join();
        }

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
        @try {
            NSPasteboard* dragPasteboard = [NSPasteboard pasteboardWithName:NSPasteboardNameDrag];
            if (!dragPasteboard) return false;

            NSInteger currentChangeCount = [dragPasteboard changeCount];

            // UPDATED FIX: Allow drag detection even if pasteboard hasn't changed yet
            // Some drags (especially from Finder) don't update the pasteboard immediately
            // We'll rely on file type detection to determine if it's a real drag
            // Only skip if we've explicitly stored a change count AND it's the same
            int storedCount = lastPasteboardChangeCount.load();
            if (storedCount >= 0 && currentChangeCount == storedCount) {
                // Check if enough time has passed since mouse down (grace period for pasteboard update)
                // If pasteboard still hasn't changed after 200ms, it's probably not a file drag
                auto now = std::chrono::steady_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - mouseDownTime).count();

                if (elapsed > 500) {  // Increased grace period for Finder drags
                    NSLog(@"[DragMonitor] Pasteboard unchanged after 500ms (changeCount: %ld), ignoring - likely click+shake, not drag",
                          static_cast<long>(currentChangeCount));
                    return false;
                }
                // Within grace period - continue checking for files
                NSLog(@"[DragMonitor] Pasteboard unchanged but within grace period (%lldms), checking for files...", elapsed);
            } else if (currentChangeCount > storedCount) {
                NSLog(@"[DragMonitor] Pasteboard changed during drag (%d → %ld) - real drag detected!",
                      storedCount,
                      static_cast<long>(currentChangeCount));
            }

            NSArray* types = [dragPasteboard types];
            if (!types || types.count == 0) {
                return false;
            }

            // CRITICAL FIX: Filter out Chromium internal drag types
            // These are NOT file drags from Finder - they're internal Electron UI drags
            bool isChromiumDrag = [types containsObject:@"org.chromium.chromium-initiated-drag"] ||
                                 [types containsObject:@"org.chromium.chromium-renderer-initiated-drag"];

            if (isChromiumDrag) {
                // Don't treat Chromium internal drags as file drags
                NSLog(@"[DragMonitor] Ignoring Chromium internal drag (not a file drag)");
                return false;
            }

            // Enhanced file type detection - covers more drag sources
            bool hasFiles = [types containsObject:NSPasteboardTypeFileURL] ||           // Modern file URLs
                           [types containsObject:(__bridge NSString*)kUTTypeFileURL] || // Modern file URL UTI
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
            NSLog(@"[DragMonitor] Has files: %@, Change count: %d -> %ld",
                  hasFiles ? @"YES" : @"NO",
                  lastPasteboardChangeCount.load(),
                  static_cast<long>(currentChangeCount));

            if (hasFiles) {
                lastPasteboardChangeCount.store(currentChangeCount);

                // Try to get file information with safe error handling
                NSArray* fileURLs = nil;

                @try {
                    // Try multiple methods to extract file URLs
                    if ([types containsObject:NSPasteboardTypeFileURL]) {
                        // Modern way - works for most drags including Desktop
                        fileURLs = [dragPasteboard readObjectsForClasses:@[[NSURL class]]
                                                                options:@{NSPasteboardURLReadingFileURLsOnlyKey: @YES}];
                    }

                    if ((!fileURLs || fileURLs.count == 0) && [types containsObject:(__bridge NSString*)kUTTypeFileURL]) {
                        // Alternative method using UTI - covers legacy applications
                        NSArray* filenames = [dragPasteboard readObjectsForClasses:@[[NSString class]] options:nil];
                        if (filenames && filenames.count > 0) {
                            NSMutableArray* urls = [NSMutableArray arrayWithCapacity:filenames.count];
                            for (NSString* filename in filenames) {
                                if ([filename isKindOfClass:[NSString class]] && filename.length > 0) {
                                    NSURL* url = [NSURL fileURLWithPath:filename];
                                    if (url) [urls addObject:url];
                                }
                            }
                            fileURLs = urls;
                        }
                    }

                    // Try public.file-url if other methods failed
                    if ((!fileURLs || fileURLs.count == 0) && [types containsObject:@"public.file-url"]) {
                        NSString* urlString = [dragPasteboard stringForType:@"public.file-url"];
                        if (urlString && [urlString isKindOfClass:[NSString class]] && urlString.length > 0) {
                            NSURL* url = [NSURL URLWithString:urlString];
                            if (url && [url isFileURL]) {
                                fileURLs = @[url];
                            }
                        }
                    }

                    // Handle promised files (common when dragging from certain apps)
                    if ((!fileURLs || fileURLs.count == 0) && [types containsObject:@"com.apple.pasteboard.promised-file-url"]) {
                        NSLog(@"[DragMonitor] Attempting to read promised file URLs");

                        // Try to get promised file URLs
                        NSArray* promisedURLs = [dragPasteboard readObjectsForClasses:@[[NSURL class]]
                                                                             options:@{NSPasteboardURLReadingContentsConformToTypesKey: @[@"com.apple.pasteboard.promised-file-url"]}];
                        if (promisedURLs && promisedURLs.count > 0) {
                            fileURLs = promisedURLs;
                            NSLog(@"[DragMonitor] Found %lu promised file URLs", (unsigned long)promisedURLs.count);
                        }
                    }

                    // Try Apple URL pasteboard type
                    if ((!fileURLs || fileURLs.count == 0) && [types containsObject:@"Apple URL pasteboard type"]) {
                        NSLog(@"[DragMonitor] Attempting to read Apple URL pasteboard type");

                        // Read the URL data
                        NSData* urlData = [dragPasteboard dataForType:@"Apple URL pasteboard type"];
                        if (urlData && urlData.length > 0) {
                            // Apple URL format is often a property list
                            NSPropertyListFormat format;
                            NSError* error = nil;
                            id plist = [NSPropertyListSerialization propertyListWithData:urlData
                                                                                options:NSPropertyListImmutable
                                                                                format:&format
                                                                                  error:&error];

                            if (plist && [plist isKindOfClass:[NSArray class]]) {
                                NSMutableArray* urls = [NSMutableArray array];
                                for (id item in (NSArray*)plist) {
                                    NSString* urlString = nil;
                                    if ([item isKindOfClass:[NSString class]]) {
                                        urlString = item;
                                    } else if ([item isKindOfClass:[NSURL class]]) {
                                        urlString = [(NSURL*)item absoluteString];
                                    }

                                    if (urlString) {
                                        NSURL* url = [NSURL URLWithString:urlString];
                                        if (url && [url isFileURL]) {
                                            [urls addObject:url];
                                        }
                                    }
                                }
                                if (urls.count > 0) {
                                    fileURLs = urls;
                                    NSLog(@"[DragMonitor] Found %lu file URLs from Apple URL pasteboard", (unsigned long)urls.count);
                                }
                            }
                        }
                    }
                } @catch (NSException* exception) {
                    NSLog(@"[DragMonitor] Exception reading pasteboard data: %@", exception);
                    // Continue execution but skip file URL extraction
                    fileURLs = nil;
                }

                if (fileURLs && fileURLs.count > 0) {
                    NSLog(@"[DragMonitor] Found %lu file URLs", (unsigned long)fileURLs.count);
                    @try {
                        // Store file paths for polling
                        std::lock_guard<std::mutex> lock(filePathsMutex);
                        draggedFilePaths.clear();

                        for (NSUInteger i = 0; i < fileURLs.count; i++) {
                            NSURL* url = fileURLs[i];
                            if ([url isKindOfClass:[NSURL class]] && [url isFileURL]) {
                                NSString* path = [url path];
                                if (path && path.length > 0) {
                                    const char* utf8Path = [path UTF8String];
                                    if (utf8Path) {
                                        draggedFilePaths.push_back(std::string(utf8Path));
                                    }
                                }
                            }
                        }

                        fileCount.store(static_cast<int>(draggedFilePaths.size()));
                    } @catch (NSException* exception) {
                        NSLog(@"[DragMonitor] Exception processing file URLs: %@", exception);
                        // Reset state on error
                        std::lock_guard<std::mutex> lock(filePathsMutex);
                        draggedFilePaths.clear();
                        fileCount.store(0);
                        return false;
                    }
                } else {
                    NSLog(@"[DragMonitor] No file URLs found despite hasFiles=true");
                    NSLog(@"[DragMonitor] Available types: %@", types);
                    // CRITICAL FIX: Don't return true if no actual file URLs were found
                    return false;
                }

                // Only return true if we actually found file URLs
                return fileURLs && fileURLs.count > 0;
            }

            return false;
        } @catch (NSException* exception) {
            NSLog(@"[DragMonitor] Fatal exception in CheckForFileDrag: %@", exception);
            return false;
        }
    }
}

CGEventRef DarwinDragMonitor::DragEventCallback(CGEventTapProxy proxy,
                                                CGEventType type,
                                                CGEventRef event,
                                                void* refcon) {
    DarwinDragMonitor* monitor = static_cast<DarwinDragMonitor*>(refcon);

    // CRITICAL: Always return event immediately to avoid blocking desktop interactions
    // Use lock-free double buffering instead of mutex
    bool expected = false;
    if (!monitor->dragStateUpdating.compare_exchange_weak(expected, true)) {
        // Another thread is updating, skip this event
        return event;
    }

    // Get the inactive buffer for updates
    int currentBuffer = monitor->activeDragBuffer.load();
    int updateBuffer = 1 - currentBuffer;
    DragState& dragState = monitor->dragStateBuffers[updateBuffer];

    CGPoint location = CGEventGetLocation(event);
    
    // Handle mouse down - potential drag start
    if (type == kCGEventLeftMouseDown) {
        // If there's a pending clear, execute it immediately to prevent stale data
        if (monitor->hasPendingClear.load()) {
            NSLog(@"[DragMonitor] New drag starting - clearing stale file paths immediately");
            std::lock_guard<std::mutex> lock(monitor->filePathsMutex);
            monitor->draggedFilePaths.clear();
            monitor->hasPendingClear.store(false);
        }

        // Reset drag state
        dragState.startPoint = location;
        dragState.lastPoint = location;
        dragState.startTime = std::chrono::steady_clock::now();
        dragState.lastMoveTime = std::chrono::steady_clock::now();
        dragState.totalDistance = 0;
        dragState.moveCount = 0;
        dragState.hasFiles = false;
        dragState.trajectory.clear();
        dragState.trajectory.push_back(location);
        dragState.directionChanges = 0;
        dragState.maxVelocity = 0;
        dragState.avgVelocity = 0;
        dragState.hasCircularMotion = false;
        dragState.hasZigzagPattern = false;
        monitor->isDragging.store(false);

        // CRITICAL: Capture initial pasteboard state at mouse down
        // This prevents detecting click+shake as drag (pasteboard has files from click)
        @autoreleasepool {
            NSPasteboard* dragPasteboard = [NSPasteboard pasteboardWithName:NSPasteboardNameDrag];
            if (dragPasteboard) {
                // Store the pasteboard change count at mouse down
                // We only consider it a real drag if changeCount INCREASES during drag
                monitor->lastPasteboardChangeCount.store([dragPasteboard changeCount]);
                monitor->mouseDownTime = std::chrono::steady_clock::now();
                NSLog(@"[DragMonitor] Mouse down - captured pasteboard changeCount: %ld",
                      static_cast<long>([dragPasteboard changeCount]));
            }
        }
    }
    
    // Handle mouse dragged
    else if (type == kCGEventLeftMouseDragged) {
        auto now = std::chrono::steady_clock::now();
        
        // Calculate movement
        double dx = location.x - dragState.lastPoint.x;
        double dy = location.y - dragState.lastPoint.y;
        double moveDistance = sqrt(dx * dx + dy * dy);

        // Update drag state
        dragState.totalDistance += moveDistance;
        dragState.lastPoint = location;
        dragState.moveCount++;
        dragState.lastMoveTime = now;

        // Add to trajectory for analysis with size limit
        dragState.trajectory.push_back(location);
        if (dragState.trajectory.size() > DragState::MAX_TRAJECTORY_POINTS) {
            dragState.trajectory.pop_front();  // Remove oldest point
        }
        
        // Track velocity
        auto timeDelta = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - dragState.lastMoveTime
        ).count();
        if (timeDelta > 0) {
            double velocity = moveDistance / timeDelta;
            dragState.maxVelocity = std::max(dragState.maxVelocity, velocity);
            dragState.avgVelocity = (dragState.avgVelocity * (dragState.moveCount - 1) + velocity) / dragState.moveCount;
        }
        
        // Queue trajectory analysis every 10 moves
        if (dragState.moveCount % 10 == 0 && dragState.trajectory.size() > 3) {
            std::lock_guard<std::mutex> lock(monitor->analysisQueueMutex);
            monitor->analysisQueue.push({
                std::chrono::steady_clock::now(),
                dragState.trajectory  // Copy trajectory
            });
            monitor->analysisCV.notify_one();
        }
        
        // Calculate time since drag started
        auto dragDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - dragState.startTime
        ).count();
        
        // Check for file drag only after minimum drag distance and time
        // CRITICAL: These thresholds prevent false positives from clicks+shake
        // User must actually DRAG files, not just click and shake
        const double MIN_DRAG_DISTANCE = 25.0;  // pixels - require real drag movement
        const int MIN_DRAG_TIME = 50;          // milliseconds - time to initiate drag
        const int MIN_MOVE_COUNT = 5;           // number of drag events - sustained movement
        
        bool shouldCheckForFiles =
            dragState.totalDistance >= MIN_DRAG_DISTANCE &&
            dragDuration >= MIN_DRAG_TIME &&
            dragState.moveCount >= MIN_MOVE_COUNT;

        // ADDITIONAL CHECK: Verify actual drag distance from start point
        // This prevents click+shake from triggering (user clicks file, shakes in place)
        double distanceFromStart = sqrt(
            pow(location.x - dragState.startPoint.x, 2) +
            pow(location.y - dragState.startPoint.y, 2)
        );
        const double MIN_DISTANCE_FROM_START = 20.0; // Must move 20px away from click point

        bool isActualDrag = distanceFromStart >= MIN_DISTANCE_FROM_START;

        if (shouldCheckForFiles && isActualDrag && !dragState.hasFiles && !monitor->isDragging.load()) {
            // CRITICAL FIX: Only mark as dragging if files are actually found
            // Perform file detection FIRST, before marking as dragging
            if (monitor->CheckForFileDrag()) {
                // Files confirmed - now mark as dragging
                dragState.hasFiles = true;
                monitor->isDragging.store(true);
                monitor->hasActiveDrag.store(true);
                NSLog(@"[DragMonitor] Files detected during drag event");
            } else {
                // No files found - this is just a mouse drag (e.g., clicking on desktop)
                // Don't mark as dragging to avoid false positives
                NSLog(@"[DragMonitor] Mouse drag detected but no files found (not a file drag)");
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

            // Reset pasteboard change count to force fresh detection on next drag
            monitor->lastPasteboardChangeCount.store(-1);

            // FIX: Schedule delayed clearing instead of immediate clearing
            // This gives the renderer time to retrieve file paths via IPC
            NSLog(@"[DragMonitor] Drag ended - scheduling file path clearing in 1 second");
            monitor->ScheduleClearFilePaths();
        }

        // Reset state
        dragState.hasFiles = false;
        dragState.totalDistance = 0;
        dragState.moveCount = 0;
    }

    // Swap buffers atomically
    monitor->activeDragBuffer.store(updateBuffer);
    monitor->dragStateUpdating.store(false);

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
    analysisRunning.store(true);

    // Start analysis thread
    analysisThread = std::thread(&DarwinDragMonitor::RunAnalysisThread, this);

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

    // Set up a timer for more efficient pasteboard monitoring using RAII
    CFTimerWrapper pasteboardTimer;
    pasteboardTimer.create(
        0.01,  // 10ms interval (100Hz)
        [](CFRunLoopTimerRef timer, void* info) {
            DarwinDragMonitor* monitor = static_cast<DarwinDragMonitor*>(info);
            // Only check pasteboard during active drag
            if (monitor->isDragging.load() && !monitor->hasActiveDrag.load()) {
                if (monitor->CheckForFileDrag()) {
                    monitor->hasActiveDrag.store(true);
                    NSLog(@"[DragMonitor] Files detected via timer");
                }
            }
        },
        this
    );

    if (!pasteboardTimer.isValid()) {
        NSLog(@"[DragMonitor] Failed to create pasteboard monitoring timer");
        // Continue without timer - fallback to less efficient monitoring
    }

    // Run the event loop
    while (!shouldStop.load()) {
        CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.5, false);  // Longer timeout OK with timer
    }

    // Timer cleanup is automatic via RAII
    
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
    analysisRunning.store(false);

    // Notify analysis thread to wake up and exit
    analysisCV.notify_all();

    if (analysisThread.joinable()) {
        analysisThread.join();
    }

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
    // Get current active buffer for read-only access
    int currentBuffer = activeDragBuffer.load();
    const DragState& dragState = dragStateBuffers[currentBuffer];

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

    // Analyze patterns
    bool hasCircularMotion = DetectCircularMotion();
    bool hasZigzagPattern = DetectZigzagPattern();

    // Log significant trajectory patterns
    if (directionChanges > 5 || hasCircularMotion || hasZigzagPattern) {
        NSLog(@"[DragMonitor] Trajectory analysis: changes=%d, circular=%d, zigzag=%d",
              directionChanges, hasCircularMotion, hasZigzagPattern);
    }
}

bool DarwinDragMonitor::DetectCircularMotion() {
    int currentBuffer = activeDragBuffer.load();
    const DragState& dragState = dragStateBuffers[currentBuffer];

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
    
    return static_cast<size_t>(curveCount) > dragState.trajectory.size() / 6;
}

bool DarwinDragMonitor::DetectZigzagPattern() {
    int currentBuffer = activeDragBuffer.load();
    const DragState& dragState = dragStateBuffers[currentBuffer];

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

void DarwinDragMonitor::RunAnalysisThread() {
    while (analysisRunning.load()) {
        std::unique_lock<std::mutex> lock(analysisQueueMutex);

        // Wait for tasks or shutdown
        analysisCV.wait(lock, [this] {
            return !analysisQueue.empty() || !analysisRunning.load();
        });

        while (!analysisQueue.empty()) {
            auto task = std::move(analysisQueue.front());
            analysisQueue.pop();

            lock.unlock();

            // Perform trajectory analysis in background
            int directionChanges = 0;
            for (size_t i = 2; i < task.trajectory.size(); i++) {
                double angle = CalculateAngle(
                    task.trajectory[i-2],
                    task.trajectory[i-1],
                    task.trajectory[i]
                );
                if (angle > M_PI / 4) {
                    directionChanges++;
                }
            }

            // Check for patterns
            bool hasCircularMotion = false;
            bool hasZigzagPattern = false;

            // Circular motion detection
            if (task.trajectory.size() >= 8) {
                CGPoint start = task.trajectory.front();
                CGPoint current = task.trajectory.back();
                double distance = sqrt(pow(current.x - start.x, 2) + pow(current.y - start.y, 2));

                // Calculate total distance
                double totalDistance = 0;
                for (size_t i = 1; i < task.trajectory.size(); i++) {
                    double dx = task.trajectory[i].x - task.trajectory[i-1].x;
                    double dy = task.trajectory[i].y - task.trajectory[i-1].y;
                    totalDistance += sqrt(dx * dx + dy * dy);
                }

                if (totalDistance > 100 && distance < 50) {
                    hasCircularMotion = true;
                }
            }

            // Zigzag pattern detection
            if (directionChanges >= 3) {
                double changeRate = (double)directionChanges / task.trajectory.size();
                hasZigzagPattern = changeRate > 0.3;
            }

            // Store results atomically (would need additional atomic storage)
            // For now, just log results
            if (hasCircularMotion || hasZigzagPattern) {
                NSLog(@"[DragMonitor] Trajectory analysis: circular=%d, zigzag=%d, changes=%d",
                      hasCircularMotion, hasZigzagPattern, directionChanges);
            }

            lock.lock();
        }
    }
}

// Schedule delayed file path clearing to prevent race condition
void DarwinDragMonitor::ScheduleClearFilePaths() {
    // Cancel any existing timer
    clearPathsTimer.~CFTimerWrapper();
    new (&clearPathsTimer) CFTimerWrapper();

    // Create one-shot timer for 1 second delay
    CFRunLoopTimerContext context = {0, this, NULL, NULL, NULL};
    CFRunLoopTimerRef timer = CFRunLoopTimerCreate(
        kCFAllocatorDefault,
        CFAbsoluteTimeGetCurrent() + 0.5,  // Fire in 0.5 second
        0,  // Non-repeating (one-shot)
        0, 0,
        ClearFilePathsCallback,
        &context
    );

    if (timer) {
        CFRunLoopRef runLoop = CFRunLoopGetMain();
        CFRunLoopAddTimer(runLoop, timer, kCFRunLoopCommonModes);
        hasPendingClear.store(true);
        NSLog(@"[DragMonitor] Scheduled file path clearing timer (1 second delay)");
        CFRelease(timer);
    }
}

// Static callback for timer
void DarwinDragMonitor::ClearFilePathsCallback(CFRunLoopTimerRef timer, void* info) {
    DarwinDragMonitor* monitor = static_cast<DarwinDragMonitor*>(info);

    NSLog(@"[DragMonitor] Clearing file paths (delayed clearing executed)");

    std::lock_guard<std::mutex> lock(monitor->filePathsMutex);
    monitor->draggedFilePaths.clear();
    monitor->hasPendingClear.store(false);

    NSLog(@"[DragMonitor] File paths cleared successfully");
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return DarwinDragMonitor::Init(env, exports);
}

NODE_API_MODULE(drag_monitor_darwin, InitAll)