#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <napi.h>
#import <thread>
#import <chrono>

class DragMonitor : public Napi::ObjectWrap<DragMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    DragMonitor(const Napi::CallbackInfo& info);
    ~DragMonitor();
    
private:
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value IsDragging(const Napi::CallbackInfo& info);
    Napi::Value GetDraggedItems(const Napi::CallbackInfo& info);
    
    void MonitorDragging();
    void CheckPasteboard();
    void NotifyDragStateChange(bool isDragging, NSArray* items = nil);
    
    static Napi::FunctionReference constructor;
    Napi::ThreadSafeFunction tsfn;
    std::thread* monitorThread;
    bool isMonitoring;
    bool currentDragState;
    NSInteger lastChangeCount;
    NSPasteboard* dragPasteboard;
    NSArray* currentDraggedItems;
    CFRunLoopRef runLoop;
};

Napi::FunctionReference DragMonitor::constructor;

Napi::Object DragMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    
    Napi::Function func = DefineClass(env, "DragMonitor", {
        InstanceMethod("start", &DragMonitor::Start),
        InstanceMethod("stop", &DragMonitor::Stop),
        InstanceMethod("isDragging", &DragMonitor::IsDragging),
        InstanceMethod("getDraggedItems", &DragMonitor::GetDraggedItems),
    });
    
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    
    exports.Set("DragMonitor", func);
    return exports;
}

DragMonitor::DragMonitor(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<DragMonitor>(info),
      monitorThread(nullptr),
      isMonitoring(false),
      currentDragState(false),
      lastChangeCount(-1),
      runLoop(nullptr) {
    
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function expected").ThrowAsJavaScriptException();
        return;
    }
    
    // Create ThreadSafeFunction for callback
    tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "DragMonitor",
        0,
        1
    );
    
    @autoreleasepool {
        dragPasteboard = [NSPasteboard pasteboardWithName:NSDragPboard];
        currentDraggedItems = nil;
    }
}

DragMonitor::~DragMonitor() {
    if (isMonitoring) {
        isMonitoring = false;
        
        // Stop the run loop
        if (runLoop) {
            CFRunLoopStop(runLoop);
        }
        
        // Wait for thread to finish
        if (monitorThread) {
            if (monitorThread->joinable()) {
                monitorThread->join();
            }
            delete monitorThread;
            monitorThread = nullptr;
        }
        
        // Release the thread safe function
        tsfn.Release();
    }
    
    @autoreleasepool {
        if (currentDraggedItems) {
            [currentDraggedItems release];
            currentDraggedItems = nil;
        }
    }
}

void DragMonitor::MonitorDragging() {
    @autoreleasepool {
        runLoop = CFRunLoopGetCurrent();
        
        // Create a timer to periodically check the pasteboard
        NSTimer* timer = [NSTimer scheduledTimerWithTimeInterval:0.1
            repeats:YES
            block:^(NSTimer* timer) {
                if (!isMonitoring) {
                    [timer invalidate];
                    CFRunLoopStop(runLoop);
                    return;
                }
                CheckPasteboard();
            }];
        
        // Also monitor for global drag events using accessibility API
        CGEventMask eventMask = CGEventMaskBit(kCGEventLeftMouseDragged) | 
                                CGEventMaskBit(kCGEventLeftMouseUp) |
                                CGEventMaskBit(kCGEventLeftMouseDown);
        
        CFMachPortRef eventTap = CGEventTapCreate(
            kCGSessionEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            eventMask,
            [](CGEventTapProxy proxy, CGEventType type, CGEventRef event, void* refcon) -> CGEventRef {
                DragMonitor* monitor = static_cast<DragMonitor*>(refcon);
                
                if (type == kCGEventLeftMouseDragged) {
                    // Check if this is a file drag
                    monitor->CheckPasteboard();
                } else if (type == kCGEventLeftMouseUp && monitor->currentDragState) {
                    // Drag ended
                    monitor->NotifyDragStateChange(false);
                }
                
                return event;
            },
            this
        );
        
        if (eventTap) {
            CFRunLoopSourceRef runLoopSource = CFMachPortCreateRunLoopSource(NULL, eventTap, 0);
            CFRunLoopAddSource(runLoop, runLoopSource, kCFRunLoopCommonModes);
            CGEventTapEnable(eventTap, true);
            
            // Run the event loop
            CFRunLoopRun();
            
            // Cleanup
            CFRunLoopRemoveSource(runLoop, runLoopSource, kCFRunLoopCommonModes);
            CFRelease(runLoopSource);
            CFRelease(eventTap);
        } else {
            // Fallback to just timer-based monitoring
            CFRunLoopRun();
        }
        
        [timer invalidate];
    }
}

void DragMonitor::CheckPasteboard() {
    @autoreleasepool {
        NSInteger changeCount = [dragPasteboard changeCount];
        
        if (changeCount != lastChangeCount) {
            lastChangeCount = changeCount;
            
            // Check if there are file URLs on the pasteboard
            NSArray* types = [dragPasteboard types];
            bool hasFiles = [types containsObject:NSFilenamesPboardType] ||
                           [types containsObject:NSURLPboardType] ||
                           [types containsObject:(__bridge NSString*)kUTTypeFileURL];
            
            if (hasFiles) {
                NSMutableArray* items = [NSMutableArray array];
                
                // Get file paths
                NSArray* files = [dragPasteboard propertyListForType:NSFilenamesPboardType];
                if (files) {
                    for (NSString* path in files) {
                        // Get file attributes
                        NSFileManager* fm = [NSFileManager defaultManager];
                        NSDictionary* attrs = [fm attributesOfItemAtPath:path error:nil];
                        NSString* fileType = [attrs fileType];
                        
                        NSDictionary* item = @{
                            @"path": path,
                            @"name": [path lastPathComponent],
                            @"isDirectory": @([fileType isEqualToString:NSFileTypeDirectory]),
                            @"isFile": @([fileType isEqualToString:NSFileTypeRegular]),
                            @"size": attrs[NSFileSize] ?: @0
                        };
                        [items addObject:item];
                    }
                }
                
                // Also check for URLs
                NSArray* urls = [dragPasteboard readObjectsForClasses:@[[NSURL class]] options:nil];
                if (urls && urls.count > 0) {
                    for (NSURL* url in urls) {
                        if ([url isFileURL]) {
                            NSString* path = [url path];
                            // Avoid duplicates
                            BOOL exists = NO;
                            for (NSDictionary* item in items) {
                                if ([item[@"path"] isEqualToString:path]) {
                                    exists = YES;
                                    break;
                                }
                            }
                            
                            if (!exists) {
                                NSFileManager* fm = [NSFileManager defaultManager];
                                NSDictionary* attrs = [fm attributesOfItemAtPath:path error:nil];
                                NSString* fileType = [attrs fileType];
                                
                                NSDictionary* item = @{
                                    @"path": path,
                                    @"name": [path lastPathComponent],
                                    @"isDirectory": @([fileType isEqualToString:NSFileTypeDirectory]),
                                    @"isFile": @([fileType isEqualToString:NSFileTypeRegular]),
                                    @"size": attrs[NSFileSize] ?: @0
                                };
                                [items addObject:item];
                            }
                        }
                    }
                }
                
                if (items.count > 0) {
                    NotifyDragStateChange(true, items);
                }
            } else if (currentDragState) {
                // No files on pasteboard but we were dragging
                NotifyDragStateChange(false);
            }
        }
    }
}

void DragMonitor::NotifyDragStateChange(bool isDragging, NSArray* items) {
    if (currentDragState == isDragging && !items) {
        return; // No change
    }
    
    currentDragState = isDragging;
    
    @autoreleasepool {
        if (currentDraggedItems) {
            [currentDraggedItems release];
        }
        currentDraggedItems = items ? [items retain] : nil;
        
        // Prepare data for JavaScript callback
        auto callback = [isDragging, items](Napi::Env env, Napi::Function jsCallback) {
            Napi::Object result = Napi::Object::New(env);
            result.Set("isDragging", Napi::Boolean::New(env, isDragging));
            
            if (items && items.count > 0) {
                Napi::Array jsItems = Napi::Array::New(env, items.count);
                NSUInteger index = 0;
                
                for (NSDictionary* item in items) {
                    Napi::Object jsItem = Napi::Object::New(env);
                    jsItem.Set("path", Napi::String::New(env, [item[@"path"] UTF8String]));
                    jsItem.Set("name", Napi::String::New(env, [item[@"name"] UTF8String]));
                    jsItem.Set("isDirectory", Napi::Boolean::New(env, [item[@"isDirectory"] boolValue]));
                    jsItem.Set("isFile", Napi::Boolean::New(env, [item[@"isFile"] boolValue]));
                    jsItem.Set("size", Napi::Number::New(env, [item[@"size"] longLongValue]));
                    
                    jsItems.Set(index++, jsItem);
                }
                
                result.Set("items", jsItems);
            } else {
                result.Set("items", Napi::Array::New(env, 0));
            }
            
            jsCallback.Call({result});
        };
        
        napi_status status = tsfn.BlockingCall(callback);
        if (status != napi_ok) {
            // Handle error
        }
    }
}

Napi::Value DragMonitor::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isMonitoring) {
        return Napi::Boolean::New(env, false);
    }
    
    isMonitoring = true;
    
    // Start monitoring in a separate thread
    monitorThread = new std::thread(&DragMonitor::MonitorDragging, this);
    
    return Napi::Boolean::New(env, true);
}

Napi::Value DragMonitor::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!isMonitoring) {
        return Napi::Boolean::New(env, false);
    }
    
    isMonitoring = false;
    
    // Stop the run loop
    if (runLoop) {
        CFRunLoopStop(runLoop);
    }
    
    // Wait for thread to finish
    if (monitorThread) {
        if (monitorThread->joinable()) {
            monitorThread->join();
        }
        delete monitorThread;
        monitorThread = nullptr;
    }
    
    // Reset state
    currentDragState = false;
    lastChangeCount = -1;
    
    @autoreleasepool {
        if (currentDraggedItems) {
            [currentDraggedItems release];
            currentDraggedItems = nil;
        }
    }
    
    // Release the thread safe function
    tsfn.Release();
    
    return Napi::Boolean::New(env, true);
}

Napi::Value DragMonitor::IsDragging(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, currentDragState);
}

Napi::Value DragMonitor::GetDraggedItems(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    @autoreleasepool {
        if (currentDraggedItems && currentDraggedItems.count > 0) {
            Napi::Array items = Napi::Array::New(env, currentDraggedItems.count);
            NSUInteger index = 0;
            
            for (NSDictionary* item in currentDraggedItems) {
                Napi::Object jsItem = Napi::Object::New(env);
                jsItem.Set("path", Napi::String::New(env, [item[@"path"] UTF8String]));
                jsItem.Set("name", Napi::String::New(env, [item[@"name"] UTF8String]));
                jsItem.Set("isDirectory", Napi::Boolean::New(env, [item[@"isDirectory"] boolValue]));
                jsItem.Set("isFile", Napi::Boolean::New(env, [item[@"isFile"] boolValue]));
                jsItem.Set("size", Napi::Number::New(env, [item[@"size"] longLongValue]));
                
                items.Set(index++, jsItem);
            }
            
            return items;
        }
    }
    
    return Napi::Array::New(env, 0);
}

// Initialize the module
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return DragMonitor::Init(env, exports);
}

NODE_API_MODULE(drag_monitor_darwin, InitAll)