# binding.gyp - Build configuration for macOS drag monitor native module
#
# This file configures the compilation of the drag monitoring module for macOS.
# It builds a native addon that monitors NSPasteboard for file drag operations.
#
# Build command: node-gyp rebuild
# Output: build/Release/drag_monitor_darwin.node
#
# Requirements:
# - Xcode Command Line Tools
# - Python 3.x
# - node-gyp installed globally
#
# Frameworks used:
# - Foundation: NSPasteboard and file operations
# - AppKit: macOS UI framework for drag operations
# - CoreGraphics: Additional graphics support

{
  "targets": [
    {
      "target_name": "drag_monitor_darwin",
      "sources": ["darwin-drag-monitor.mm"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_LDFLAGS": [
          "-framework", "CoreGraphics",
          "-framework", "ApplicationServices",
          "-framework", "AppKit",
          "-framework", "Foundation"
        ]
      },
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}
