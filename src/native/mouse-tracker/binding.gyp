# binding.gyp - Build configuration for cross-platform mouse tracker native module
#
# This file configures the compilation of the C++ mouse tracking module.
# It uses node-gyp to build a native Node.js addon.
#
# Build command: node-gyp rebuild
# Output:
#   macOS: build/Release/mouse_tracker_darwin.node
#   Windows: build/Release/mouse_tracker_win.node
#
# Requirements:
# - macOS: Xcode Command Line Tools
# - Windows: Visual Studio Build Tools 2019+
# - Python 3.x
# - node-gyp installed globally
#
# APIs used:
# - macOS: CGEventTap for mouse tracking
# - Windows: SetWindowsHookEx (WH_MOUSE_LL) for low-level mouse hooks

{
  "targets": [
    {
      "target_name": "mouse_tracker_<(OS)",
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
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='mac'", {
          "target_name": "mouse_tracker_darwin",
          "sources": [
            "src/native/mac/mouse_tracker_mac.mm"
          ],
          "cflags": [ "-O3", "-ffast-math" ],
          "cflags_cc": [ "-O3", "-ffast-math", "-std=c++17" ],
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
          }
        }],
        ["OS=='win'", {
          "target_name": "mouse_tracker_win",
          "sources": [
            "src/native/win/mouse_tracker_win.cc"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "RuntimeTypeInfo": "true",
              "AdditionalOptions": [ "/std:c++17", "/O2", "/GL" ]
            },
            "VCLinkerTool": {
              "LinkTimeCodeGeneration": 1
            }
          },
          "libraries": [
            "user32.lib"
          ]
        }]
      ]
    }
  ]
}