/**
 * @fileoverview Native module error codes
 *
 * This file defines error codes that match the C++ native modules
 * to provide consistent error handling across the application.
 */

export enum NativeErrorCode {
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
  THREADSAFE_FUNCTION_CREATE_FAILED = 402,
}

export interface NativeError {
  code: NativeErrorCode;
  message: string;
}

/**
 * Get a human-readable description for an error code
 */
export function getNativeErrorDescription(code: NativeErrorCode): string {
  switch (code) {
    case NativeErrorCode.SUCCESS:
      return 'Operation completed successfully';
    case NativeErrorCode.UNKNOWN_ERROR:
      return 'An unknown error occurred';
    case NativeErrorCode.INVALID_ARGUMENT:
      return 'Invalid argument provided';
    case NativeErrorCode.NOT_INITIALIZED:
      return 'Module not initialized';
    case NativeErrorCode.ALREADY_INITIALIZED:
      return 'Module already initialized';
    case NativeErrorCode.MEMORY_ALLOCATION_FAILED:
      return 'Memory allocation failed';
    case NativeErrorCode.ACCESSIBILITY_PERMISSION_DENIED:
      return 'Accessibility permission required. Please grant permission in System Preferences > Security & Privacy > Accessibility';
    case NativeErrorCode.SCREEN_RECORDING_PERMISSION_DENIED:
      return 'Screen recording permission required';
    case NativeErrorCode.FILE_ACCESS_PERMISSION_DENIED:
      return 'File access permission required';
    case NativeErrorCode.EVENT_TAP_CREATE_FAILED:
      return 'Failed to create event tap. This may be due to missing accessibility permissions';
    case NativeErrorCode.RUNLOOP_CREATE_FAILED:
      return 'Failed to create run loop source';
    case NativeErrorCode.THREAD_CREATE_FAILED:
      return 'Failed to create monitoring thread';
    case NativeErrorCode.PASTEBOARD_ACCESS_FAILED:
      return 'Failed to access system pasteboard';
    case NativeErrorCode.MOUSE_TRACKER_START_FAILED:
      return 'Failed to start mouse tracker';
    case NativeErrorCode.MOUSE_TRACKER_STOP_FAILED:
      return 'Failed to stop mouse tracker';
    case NativeErrorCode.DRAG_MONITOR_START_FAILED:
      return 'Failed to start drag monitor';
    case NativeErrorCode.DRAG_MONITOR_STOP_FAILED:
      return 'Failed to stop drag monitor';
    case NativeErrorCode.CALLBACK_NOT_SET:
      return 'Callback function not set';
    case NativeErrorCode.CALLBACK_INVOKE_FAILED:
      return 'Failed to invoke callback function';
    case NativeErrorCode.THREADSAFE_FUNCTION_CREATE_FAILED:
      return 'Failed to create thread-safe function';
    default:
      return `Unknown error code: ${code}`;
  }
}
