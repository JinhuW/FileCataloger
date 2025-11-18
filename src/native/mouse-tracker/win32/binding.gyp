# binding.gyp - Build configuration for Windows mouse tracker native module
#
# This file configures the compilation of the C++ mouse tracking module for Windows.
# It uses node-gyp to build a native Node.js addon that interfaces with Win32 hooks.
#
# Build command: node-gyp rebuild
# Output: build/Release/mouse_tracker_win32.node
#
# Requirements:
# - Visual Studio Build Tools (or full Visual Studio)
# - Python 3.x
# - node-gyp installed globally
#
# Windows APIs used:
# - SetWindowsHookEx: Low-level mouse hook
# - User32: Window and input handling

{
  "targets": [
    {
      "target_name": "mouse_tracker_win32",
      "sources": [ "mouse_tracker_win32.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "RuntimeTypeInfo": "true",
              "AdditionalOptions": ["/EHsc", "/std:c++17", "/O2"]
            }
          },
          "libraries": [
            "-luser32.lib"
          ]
        }]
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE" ]
    }
  ]
}
