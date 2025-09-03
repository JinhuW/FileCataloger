#include <napi.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ApplicationServices/ApplicationServices.h>
#include <thread>
#include <atomic>
#include <chrono>

class MacOSMouseTracker : public Napi::ObjectWrap<MacOSMouseTracker> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    MacOSMouseTracker(const Napi::CallbackInfo& info);
    ~MacOSMouseTracker();

private:
    static Napi::FunctionReference constructor;
    
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value GetPosition(const Napi::CallbackInfo& info);
    Napi::Value IsTracking(const Napi::CallbackInfo& info);
    
    void TrackingLoop();
    
    std::thread* trackingThread;
    std::atomic<bool> isTracking;
    std::atomic<bool> shouldStop;
    
    struct MousePosition {
        double x;
        double y;
        int64_t timestamp;
        bool leftButtonDown;
    };
    
    std::atomic<MousePosition> currentPosition;
    Napi::ThreadSafeFunction tsfn;
    
    CFMachPortRef eventTap;
    CFRunLoopSourceRef runLoopSource;
    
    static CGEventRef MouseEventCallback(CGEventTapProxy proxy, 
                                          CGEventType type, 
                                          CGEventRef event, 
                                          void* refcon);
};

Napi::FunctionReference MacOSMouseTracker::constructor;

Napi::Object MacOSMouseTracker::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    
    Napi::Function func = DefineClass(env, "MacOSMouseTracker", {
        InstanceMethod("start", &MacOSMouseTracker::Start),
        InstanceMethod("stop", &MacOSMouseTracker::Stop),
        InstanceMethod("getPosition", &MacOSMouseTracker::GetPosition),
        InstanceMethod("isTracking", &MacOSMouseTracker::IsTracking)
    });
    
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    
    exports.Set("MacOSMouseTracker", func);
    return exports;
}

MacOSMouseTracker::MacOSMouseTracker(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<MacOSMouseTracker>(info), 
      trackingThread(nullptr),
      isTracking(false),
      shouldStop(false),
      eventTap(nullptr),
      runLoopSource(nullptr) {
    
    Napi::Env env = info.Env();
    
    // Initialize current position
    MousePosition pos = {0, 0, 0, false};
    currentPosition.store(pos);
    
    // Create ThreadSafeFunction for callbacks
    if (info.Length() > 0 && info[0].IsFunction()) {
        tsfn = Napi::ThreadSafeFunction::New(
            env,
            info[0].As<Napi::Function>(),
            "MouseTracker",
            0,
            1
        );
    }
}

MacOSMouseTracker::~MacOSMouseTracker() {
    if (isTracking.load()) {
        Stop(Napi::CallbackInfo(nullptr, nullptr));
    }
}

CGEventRef MacOSMouseTracker::MouseEventCallback(CGEventTapProxy proxy, 
                                                  CGEventType type, 
                                                  CGEventRef event, 
                                                  void* refcon) {
    MacOSMouseTracker* tracker = static_cast<MacOSMouseTracker*>(refcon);
    
    CGPoint location = CGEventGetLocation(event);
    MousePosition pos;
    pos.x = location.x;
    pos.y = location.y;
    pos.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    
    // Track left button state
    bool buttonStateChanged = false;
    MousePosition currentPos = tracker->currentPosition.load();
    pos.leftButtonDown = currentPos.leftButtonDown; // Keep current state by default
    
    if (type == kCGEventLeftMouseDown) {
        pos.leftButtonDown = true;
        buttonStateChanged = true;
    } else if (type == kCGEventLeftMouseUp) {
        pos.leftButtonDown = false;
        buttonStateChanged = true;
    } else if (type == kCGEventLeftMouseDragged) {
        pos.leftButtonDown = true;
    }
    
    tracker->currentPosition.store(pos);
    
    // Send update for mouse moves, drags, and button state changes
    if (type == kCGEventMouseMoved || 
        type == kCGEventLeftMouseDragged ||
        type == kCGEventRightMouseDragged ||
        type == kCGEventOtherMouseDragged ||
        buttonStateChanged) {
        
        // Call JavaScript callback if available
        if (tracker->tsfn) {
            auto callback = [pos](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object result = Napi::Object::New(env);
                result.Set("x", pos.x);
                result.Set("y", pos.y);
                result.Set("timestamp", pos.timestamp);
                result.Set("leftButtonDown", pos.leftButtonDown);
                jsCallback.Call({result});
            };
            
            tracker->tsfn.NonBlockingCall(callback);
        }
    }
    
    return event;
}

Napi::Value MacOSMouseTracker::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isTracking.load()) {
        return Napi::Boolean::New(env, true);
    }
    
    // Request accessibility permissions if needed
    if (!AXIsProcessTrustedWithOptions(nullptr)) {
        // Request permission
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
            Napi::Error::New(env, "Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Privacy > Accessibility")
                .ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
    }
    
    isTracking.store(true);
    shouldStop.store(false);
    
    // Start tracking thread
    trackingThread = new std::thread(&MacOSMouseTracker::TrackingLoop, this);
    
    return Napi::Boolean::New(env, true);
}

void MacOSMouseTracker::TrackingLoop() {
    // Create event tap - now also track mouse button events
    CGEventMask eventMask = (1 << kCGEventMouseMoved) | 
                           (1 << kCGEventLeftMouseDown) |
                           (1 << kCGEventLeftMouseUp) |
                           (1 << kCGEventLeftMouseDragged) |
                           (1 << kCGEventRightMouseDragged) |
                           (1 << kCGEventOtherMouseDragged);
    
    eventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,
        eventMask,
        MouseEventCallback,
        this
    );
    
    if (!eventTap) {
        isTracking.store(false);
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
    
    isTracking.store(false);
}

Napi::Value MacOSMouseTracker::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!isTracking.load()) {
        return Napi::Boolean::New(env, false);
    }
    
    shouldStop.store(true);
    
    if (trackingThread && trackingThread->joinable()) {
        trackingThread->join();
        delete trackingThread;
        trackingThread = nullptr;
    }
    
    if (tsfn) {
        tsfn.Release();
    }
    
    return Napi::Boolean::New(env, true);
}

Napi::Value MacOSMouseTracker::GetPosition(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    MousePosition pos = currentPosition.load();
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("x", pos.x);
    result.Set("y", pos.y);
    result.Set("timestamp", pos.timestamp);
    result.Set("leftButtonDown", pos.leftButtonDown);
    
    return result;
}

Napi::Value MacOSMouseTracker::IsTracking(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isTracking.load());
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return MacOSMouseTracker::Init(env, exports);
}

NODE_API_MODULE(mouse_tracker_darwin, InitAll)