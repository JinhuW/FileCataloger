# Debug Note: Drag + Shake Broken After Security Optimizations

## Issue Description
After implementing security enhancements, the drag + shake functionality is broken:
1. Shelf appears immediately on drag (without waiting for shake)
2. Shelf window fails to load due to CSP restrictions
3. Shelf is immediately hidden and destroyed

## Root Causes

### 1. CSP Blocking Webpack/React
The security configuration's Content Security Policy is blocking `unsafe-eval` which is required by webpack's development mode:
```
Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script
```

### 2. Incorrect Event Flow
Something is triggering shelf creation on `dragStart` instead of waiting for the `dragShake` event.

### 3. Auto-hide Timer Issues
The shelf is being immediately hidden due to the empty shelf auto-hide timer being triggered too quickly.

## Solution Applied

### 1. Fixed CSP for Development
The CSP was correctly configured with `unsafe-eval` but shelf windows had `webSecurity: true` which was blocking webpack's eval in development mode. Fixed by temporarily setting `webSecurity: false` for shelf windows in development.

### 2. Fixed Event Flow
The issue was that the user had modified the compiled dist files directly, adding shelf creation on drag start. Rebuilding from source fixed this issue.

### 3. Shelf Window Security Settings
Changed `webSecurity` from `true` to `false` in shelf window creation to allow webpack development mode to work properly.

## Resolution
1. Rebuilt the application from source to remove user modifications
2. Set `webSecurity: false` temporarily for development in shelf windows
3. Verified drag + shake functionality works correctly
4. Shelf now appears only when both drag and shake are detected