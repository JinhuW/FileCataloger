/**
 * @file error_codes.h
 * @brief Common error codes for native modules
 *
 * This header defines standardized error codes used across all native modules
 * to provide consistent error reporting to JavaScript.
 */

#ifndef NATIVE_COMMON_ERROR_CODES_H
#define NATIVE_COMMON_ERROR_CODES_H

#include <string>
#include <unordered_map>

namespace FileCataloger {

/**
 * Error codes for native module operations
 */
enum class ErrorCode {
    // Success
    SUCCESS = 0,

    // General errors (1-99)
    UNKNOWN_ERROR = 1,
    INVALID_ARGUMENT = 2,
    NOT_INITIALIZED = 3,
    ALREADY_INITIALIZED = 4,
    MEMORY_ALLOCATION_FAILED = 5,

    // Permission errors (100-199)
    ACCESSIBILITY_PERMISSION_DENIED = 100,
    SCREEN_RECORDING_PERMISSION_DENIED = 101,
    FILE_ACCESS_PERMISSION_DENIED = 102,

    // System errors (200-299)
    EVENT_TAP_CREATE_FAILED = 200,
    RUNLOOP_CREATE_FAILED = 201,
    THREAD_CREATE_FAILED = 202,
    PASTEBOARD_ACCESS_FAILED = 203,

    // Module-specific errors (300-399)
    MOUSE_TRACKER_START_FAILED = 300,
    MOUSE_TRACKER_STOP_FAILED = 301,
    DRAG_MONITOR_START_FAILED = 310,
    DRAG_MONITOR_STOP_FAILED = 311,

    // Callback errors (400-499)
    CALLBACK_NOT_SET = 400,
    CALLBACK_INVOKE_FAILED = 401,
    THREADSAFE_FUNCTION_CREATE_FAILED = 402
};

/**
 * Error information structure
 */
struct ErrorInfo {
    ErrorCode code;
    std::string message;
    std::string details;

    ErrorInfo(ErrorCode c, const std::string& msg, const std::string& det = "")
        : code(c), message(msg), details(det) {}
};

/**
 * Get human-readable error message for error code
 */
inline std::string GetErrorMessage(ErrorCode code) {
    static const std::unordered_map<ErrorCode, std::string> errorMessages = {
        {ErrorCode::SUCCESS, "Success"},
        {ErrorCode::UNKNOWN_ERROR, "Unknown error occurred"},
        {ErrorCode::INVALID_ARGUMENT, "Invalid argument provided"},
        {ErrorCode::NOT_INITIALIZED, "Module not initialized"},
        {ErrorCode::ALREADY_INITIALIZED, "Module already initialized"},
        {ErrorCode::MEMORY_ALLOCATION_FAILED, "Memory allocation failed"},

        {ErrorCode::ACCESSIBILITY_PERMISSION_DENIED, "Accessibility permission denied. Please grant permission in System Preferences > Security & Privacy > Accessibility"},
        {ErrorCode::SCREEN_RECORDING_PERMISSION_DENIED, "Screen recording permission denied"},
        {ErrorCode::FILE_ACCESS_PERMISSION_DENIED, "File access permission denied"},

        {ErrorCode::EVENT_TAP_CREATE_FAILED, "Failed to create CGEventTap. This may be due to missing accessibility permissions"},
        {ErrorCode::RUNLOOP_CREATE_FAILED, "Failed to create run loop source"},
        {ErrorCode::THREAD_CREATE_FAILED, "Failed to create monitoring thread"},
        {ErrorCode::PASTEBOARD_ACCESS_FAILED, "Failed to access system pasteboard"},

        {ErrorCode::MOUSE_TRACKER_START_FAILED, "Failed to start mouse tracker"},
        {ErrorCode::MOUSE_TRACKER_STOP_FAILED, "Failed to stop mouse tracker"},
        {ErrorCode::DRAG_MONITOR_START_FAILED, "Failed to start drag monitor"},
        {ErrorCode::DRAG_MONITOR_STOP_FAILED, "Failed to stop drag monitor"},

        {ErrorCode::CALLBACK_NOT_SET, "Callback function not set"},
        {ErrorCode::CALLBACK_INVOKE_FAILED, "Failed to invoke callback function"},
        {ErrorCode::THREADSAFE_FUNCTION_CREATE_FAILED, "Failed to create thread-safe function"}
    };

    auto it = errorMessages.find(code);
    if (it != errorMessages.end()) {
        return it->second;
    }
    return "Unknown error code: " + std::to_string(static_cast<int>(code));
}

} // namespace FileCataloger

#endif // NATIVE_COMMON_ERROR_CODES_H