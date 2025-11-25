# binding.gyp - Build configuration for cross-platform drag monitor native module
#
# This file configures the compilation of the drag monitoring module.
# It builds a native addon that monitors file drag operations.
#
# Build command: node-gyp rebuild
# Output:
#   macOS: build/Release/drag_monitor_darwin.node
#   Windows: build/Release/drag_monitor_win.node
#
# Requirements:
# - macOS: Xcode Command Line Tools
# - Windows: Visual Studio Build Tools 2019+
# - Python 3.x
# - node-gyp installed globally
#
# APIs used:
# - macOS: NSPasteboard for drag content, CGEventTap for mouse tracking
# - Windows: OLE/COM APIs, SetWindowsHookEx for mouse tracking

{
  "targets": [
    {
      "target_name": "drag_monitor_<(OS)",
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "src/internal",
        "../common"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "target_name": "drag_monitor_darwin",
          "sources": [
            "src/native/mac/drag_monitor_mac.mm"
          ],
          "cflags": ["-O3", "-ffast-math"],
          "cflags_cc": ["-O3", "-ffast-math", "-std=c++17"],
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
            ],
            "OTHER_LDFLAGS": [
              "-framework", "CoreGraphics",
              "-framework", "ApplicationServices",
              "-framework", "AppKit",
              "-framework", "Foundation",
              "-framework", "UniformTypeIdentifiers"
            ]
          }
        }],
        ["OS=='win'", {
          "target_name": "drag_monitor_win",
          "sources": [
            "src/native/win/drag_monitor_win.cc"
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
            "user32.lib",
            "ole32.lib",
            "shell32.lib",
            "oleaut32.lib"
          ]
        }]
      ]
    }
  ]
}
