#include <node_api.h>
#include <ApplicationServices/ApplicationServices.h>
#include <Carbon/Carbon.h>
#include <thread>
#include <atomic>
#include <iostream>
#include <mutex>
#include <queue>

class MacOSMouseTracker {
private:
    napi_env env_;
    napi_threadsafe_function tsfn_move_;
    napi_threadsafe_function tsfn_button_;
    CFMachPortRef event_tap_;
    CFRunLoopSourceRef run_loop_source_;
    std::thread event_thread_;
    std::atomic<bool> running_;
    std::atomic<bool> left_button_down_;
    std::atomic<bool> right_button_down_;
    
    static MacOSMouseTracker* instance_;
    
public:
    MacOSMouseTracker(napi_env env) 
        : env_(env), 
          tsfn_move_(nullptr),
          tsfn_button_(nullptr),
          event_tap_(nullptr), 
          run_loop_source_(nullptr),
          running_(false),
          left_button_down_(false),
          right_button_down_(false) {
        instance_ = this;
    }
    
    ~MacOSMouseTracker() {
        Stop();
        if (tsfn_move_) {
            napi_release_threadsafe_function(tsfn_move_, napi_tsfn_release);
        }
        if (tsfn_button_) {
            napi_release_threadsafe_function(tsfn_button_, napi_tsfn_release);
        }
        instance_ = nullptr;
    }
    
    void SetMoveCallback(napi_value callback) {
        // Clean up old callback
        if (tsfn_move_) {
            napi_release_threadsafe_function(tsfn_move_, napi_tsfn_release);
            tsfn_move_ = nullptr;
        }
        
        // Create new thread-safe function
        napi_value async_resource_name;
        napi_create_string_utf8(env_, "MouseMoveCallback", NAPI_AUTO_LENGTH, &async_resource_name);
        
        napi_create_threadsafe_function(
            env_,
            callback,
            nullptr,
            async_resource_name,
            0,
            1,
            nullptr,
            nullptr,
            nullptr,
            CallJsMoveCallback,
            &tsfn_move_
        );
    }
    
    void SetButtonCallback(napi_value callback) {
        // Clean up old callback
        if (tsfn_button_) {
            napi_release_threadsafe_function(tsfn_button_, napi_tsfn_release);
            tsfn_button_ = nullptr;
        }
        
        // Create new thread-safe function
        napi_value async_resource_name;
        napi_create_string_utf8(env_, "ButtonStateCallback", NAPI_AUTO_LENGTH, &async_resource_name);
        
        napi_create_threadsafe_function(
            env_,
            callback,
            nullptr,
            async_resource_name,
            0,
            1,
            nullptr,
            nullptr,
            nullptr,
            CallJsButtonCallback,
            &tsfn_button_
        );
    }
    
    bool Start() {
        if (running_.load()) {
            return true;
        }
        
        // Check for accessibility permissions
        if (!AXIsProcessTrusted()) {
            std::cerr << "Accessibility permission not granted. Please enable in System Preferences." << std::endl;
            
            // Prompt user to grant permission
            NSDictionary* options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
            AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
            
            return false;
        }
        
        running_ = true;
        
        // Start event processing thread
        event_thread_ = std::thread([this]() {
            this->RunEventLoop();
        });
        
        return true;
    }
    
    void Stop() {
        if (!running_.load()) {
            return;
        }
        
        running_ = false;
        
        if (event_tap_) {
            CGEventTapEnable(event_tap_, false);
        }
        
        if (event_thread_.joinable()) {
            event_thread_.join();
        }
        
        if (run_loop_source_) {
            CFRelease(run_loop_source_);
            run_loop_source_ = nullptr;
        }
        
        if (event_tap_) {
            CFRelease(event_tap_);
            event_tap_ = nullptr;
        }
    }
    
private:
    void RunEventLoop() {
        // Set up event tap for mouse events
        CGEventMask event_mask = 
            CGEventMaskBit(kCGEventMouseMoved) |
            CGEventMaskBit(kCGEventLeftMouseDown) |
            CGEventMaskBit(kCGEventLeftMouseUp) |
            CGEventMaskBit(kCGEventRightMouseDown) |
            CGEventMaskBit(kCGEventRightMouseUp) |
            CGEventMaskBit(kCGEventLeftMouseDragged) |
            CGEventMaskBit(kCGEventRightMouseDragged);
        
        event_tap_ = CGEventTapCreate(
            kCGSessionEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            event_mask,
            EventCallback,
            this
        );
        
        if (!event_tap_) {
            std::cerr << "Failed to create event tap" << std::endl;
            running_ = false;
            return;
        }
        
        run_loop_source_ = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, event_tap_, 0);
        CFRunLoopAddSource(CFRunLoopGetCurrent(), run_loop_source_, kCFRunLoopCommonModes);
        CGEventTapEnable(event_tap_, true);
        
        // Run the event loop
        while (running_.load()) {
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, false);
        }
        
        CFRunLoopRemoveSource(CFRunLoopGetCurrent(), run_loop_source_, kCFRunLoopCommonModes);
    }
    
    static CGEventRef EventCallback(CGEventTapProxy proxy, CGEventType type, 
                                   CGEventRef event, void* user_info) {
        MacOSMouseTracker* tracker = static_cast<MacOSMouseTracker*>(user_info);
        
        CGPoint location = CGEventGetLocation(event);
        bool button_state_changed = false;
        
        switch(type) {
            case kCGEventLeftMouseDown:
                tracker->left_button_down_ = true;
                button_state_changed = true;
                break;
            case kCGEventLeftMouseUp:
                tracker->left_button_down_ = false;
                button_state_changed = true;
                break;
            case kCGEventRightMouseDown:
                tracker->right_button_down_ = true;
                button_state_changed = true;
                break;
            case kCGEventRightMouseUp:
                tracker->right_button_down_ = false;
                button_state_changed = true;
                break;
            default:
                // Handle mouse move and drag events
                break;
        }
        
        // Send position update using thread-safe function
        if (tracker->tsfn_move_) {
            MouseData* data = new MouseData{
                static_cast<double>(location.x),
                static_cast<double>(location.y),
                tracker->left_button_down_.load(),
                tracker->right_button_down_.load()
            };
            
            napi_call_threadsafe_function(
                tracker->tsfn_move_,
                data,
                napi_tsfn_nonblocking
            );
        }
        
        // Send button state change if needed
        if (button_state_changed && tracker->tsfn_button_) {
            ButtonData* data = new ButtonData{
                tracker->left_button_down_.load(),
                tracker->right_button_down_.load()
            };
            
            napi_call_threadsafe_function(
                tracker->tsfn_button_,
                data,
                napi_tsfn_nonblocking
            );
        }
        
        return event; // Pass through the event
    }
    
    struct MouseData {
        double x;
        double y;
        bool left_button;
        bool right_button;
    };
    
    struct ButtonData {
        bool left_button;
        bool right_button;
    };
    
    static void CallJsMoveCallback(napi_env env, napi_value js_callback, void* context, void* data) {
        if (!env || !data) {
            return;
        }
        
        MouseData* mouse_data = static_cast<MouseData*>(data);
        
        // Create position object
        napi_value position_obj;
        napi_create_object(env, &position_obj);
        
        napi_value x_val, y_val, timestamp_val, left_button_val, right_button_val;
        napi_create_double(env, mouse_data->x, &x_val);
        napi_create_double(env, mouse_data->y, &y_val);
        // Convert to milliseconds for JavaScript Date compatibility
        auto now = std::chrono::system_clock::now();
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
        napi_create_double(env, static_cast<double>(ms), &timestamp_val);
        napi_get_boolean(env, mouse_data->left_button, &left_button_val);
        napi_get_boolean(env, mouse_data->right_button, &right_button_val);
        
        napi_set_named_property(env, position_obj, "x", x_val);
        napi_set_named_property(env, position_obj, "y", y_val);
        napi_set_named_property(env, position_obj, "timestamp", timestamp_val);
        napi_set_named_property(env, position_obj, "leftButtonDown", left_button_val);
        napi_set_named_property(env, position_obj, "rightButtonDown", right_button_val);
        
        napi_value global;
        napi_get_global(env, &global);
        
        napi_value argv[] = { position_obj };
        napi_value result;
        napi_call_function(env, global, js_callback, 1, argv, &result);
        
        delete mouse_data;
    }
    
    static void CallJsButtonCallback(napi_env env, napi_value js_callback, void* context, void* data) {
        if (!env || !data) {
            return;
        }
        
        ButtonData* button_data = static_cast<ButtonData*>(data);
        
        napi_value left_button_val, right_button_val;
        napi_get_boolean(env, button_data->left_button, &left_button_val);
        napi_get_boolean(env, button_data->right_button, &right_button_val);
        
        napi_value global;
        napi_get_global(env, &global);
        
        napi_value argv[] = { left_button_val, right_button_val };
        napi_value result;
        napi_call_function(env, global, js_callback, 2, argv, &result);
        
        delete button_data;
    }
};

MacOSMouseTracker* MacOSMouseTracker::instance_ = nullptr;

// N-API wrapper functions
static napi_value CreateTracker(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_value this_arg;
    void* data;
    
    napi_get_cb_info(env, info, &argc, args, &this_arg, &data);
    
    MacOSMouseTracker* tracker = new MacOSMouseTracker(env);
    
    if (argc > 0) {
        tracker->SetMoveCallback(args[0]);
    }
    
    napi_wrap(env, this_arg, tracker, 
        [](napi_env env, void* data, void* hint) {
            delete static_cast<MacOSMouseTracker*>(data);
        }, nullptr, nullptr);
    
    return this_arg;
}

static napi_value Start(napi_env env, napi_callback_info info) {
    napi_value this_arg;
    void* data;
    
    napi_get_cb_info(env, info, nullptr, nullptr, &this_arg, &data);
    
    MacOSMouseTracker* tracker;
    napi_unwrap(env, this_arg, reinterpret_cast<void**>(&tracker));
    
    bool success = tracker->Start();
    
    napi_value result;
    napi_get_boolean(env, success, &result);
    
    return result;
}

static napi_value Stop(napi_env env, napi_callback_info info) {
    napi_value this_arg;
    void* data;
    
    napi_get_cb_info(env, info, nullptr, nullptr, &this_arg, &data);
    
    MacOSMouseTracker* tracker;
    napi_unwrap(env, this_arg, reinterpret_cast<void**>(&tracker));
    
    tracker->Stop();
    
    napi_value result;
    napi_get_undefined(env, &result);
    
    return result;
}

static napi_value OnMouseMove(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_value this_arg;
    void* data;
    
    napi_get_cb_info(env, info, &argc, args, &this_arg, &data);
    
    if (argc < 1) {
        napi_throw_error(env, nullptr, "Callback function required");
        return nullptr;
    }
    
    MacOSMouseTracker* tracker;
    napi_unwrap(env, this_arg, reinterpret_cast<void**>(&tracker));
    
    tracker->SetMoveCallback(args[0]);
    
    napi_value result;
    napi_get_undefined(env, &result);
    
    return result;
}

static napi_value OnButtonStateChange(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_value this_arg;
    void* data;
    
    napi_get_cb_info(env, info, &argc, args, &this_arg, &data);
    
    if (argc < 1) {
        napi_throw_error(env, nullptr, "Callback function required");
        return nullptr;
    }
    
    MacOSMouseTracker* tracker;
    napi_unwrap(env, this_arg, reinterpret_cast<void**>(&tracker));
    
    tracker->SetButtonCallback(args[0]);
    
    napi_value result;
    napi_get_undefined(env, &result);
    
    return result;
}

// Module initialization
static napi_value Init(napi_env env, napi_value exports) {
    napi_value tracker_class;
    
    napi_property_descriptor properties[] = {
        { "start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "stop", nullptr, Stop, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "onMouseMove", nullptr, OnMouseMove, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "onButtonStateChange", nullptr, OnButtonStateChange, nullptr, nullptr, nullptr, napi_default, nullptr }
    };
    
    napi_define_class(env, "MacOSMouseTracker", NAPI_AUTO_LENGTH,
                     CreateTracker, nullptr, 4, properties, &tracker_class);
    
    napi_set_named_property(env, exports, "MacOSMouseTracker", tracker_class);
    
    return exports;
}

NAPI_MODULE(mouse_tracker_darwin, Init)