{
  "targets": [
    {
      "target_name": "mouse_tracker_darwin",
      "sources": [ "mouse_tracker_darwin.mm" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15",
        "OTHER_CFLAGS": [
          "-fobjc-arc"
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
          "sources": [ "mouse_tracker_darwin.mm" ]
        }]
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}