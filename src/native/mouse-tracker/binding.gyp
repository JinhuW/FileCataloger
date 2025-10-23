# binding.gyp - Build configuration for macOS mouse tracker native module
#
# This file configures the compilation of the C++ mouse tracking module for macOS.
# It uses node-gyp to build a native Node.js addon that interfaces with CGEventTap.
#
# Build command: node-gyp rebuild
# Output: build/Release/mouse_tracker_darwin.node
#
# Requirements:
# - Xcode Command Line Tools
# - Python 3.x
# - node-gyp installed globally
#
# Frameworks used:
# - CoreGraphics: CGEventTap API for mouse tracking
# - ApplicationServices: System-level event access
# - Foundation: Objective-C runtime support
# - Carbon: Additional event handling utilities

{
  "targets": [
    {
      "target_name": "mouse_tracker_darwin",
      "sources": [
        "src/native/mac/mouse_tracker_mac.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "src/internal",
        "../common"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags": [ "-O3", "-ffast-math", "-march=native" ],
      "cflags_cc": [ "-O3", "-ffast-math", "-march=native", "-std=c++17" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "GCC_OPTIMIZATION_LEVEL": "3",
        "LLVM_LTO": "YES",
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "OTHER_CPLUSPLUSFLAGS": [
          "-ffast-math",
          "-funroll-loops"
        ],
        "OTHER_CFLAGS": [
          "-fobjc-arc",
          "-ffast-math"
        ]
      },
      "link_settings": {
        "libraries": [
          "-framework CoreGraphics",
          "-framework ApplicationServices",
          "-framework Foundation",
          "-framework Carbon"
        ]
      },
      "conditions": [
        ["OS=='mac'", {
          "sources": [ "src/native/mac/mouse_tracker_mac.mm" ]
        }]
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}