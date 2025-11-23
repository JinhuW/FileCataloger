# binding.gyp - Build configuration for Windows drag monitor native module
#
# This file configures the compilation of the C++ drag monitoring module for Windows.
# It uses node-gyp to build a native Node.js addon that monitors file drags.
#
# Build command: node-gyp rebuild
# Output: build/Release/drag_monitor_win32.node
#
# Requirements:
# - Visual Studio Build Tools (or full Visual Studio)
# - Python 3.x
# - node-gyp installed globally
#
# Windows APIs used:
# - Clipboard API: For monitoring drag operations
# - OLE/COM: For IDataObject handling
# - Shell32: For file path extraction

{
  "targets": [
    {
      "target_name": "drag_monitor_win32",
      "sources": [ "drag_monitor_win32.cpp" ],
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
            "-luser32.lib",
            "-lole32.lib",
            "-lshell32.lib",
            "-luuid.lib"
          ]
        }]
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE" ]
    }
  ]
}
