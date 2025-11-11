# Window Settings Quick Reference Card

## 🎯 Purpose

Quick lookup guide for FileCataloger window settings. Keep this open while modifying window code.

---

## 📍 Key File Locations

```bash
# Main Window Configuration
src/main/modules/window/shelf_manager.ts:232-271  # BrowserWindow config

# Window Management
src/main/modules/window/advanced_window_pool.ts    # Pooling system
src/main/modules/window/positioning_strategy.ts    # Position logic

# UI Components
src/renderer/pages/shelf/ShelfPage.tsx            # Main UI
src/renderer/stores/shelfStore.ts                 # State management

# Configuration
src/shared/constants.ts                           # Size/behavior constants
src/shared/types/shelf.ts                         # Type definitions
```

---

## ⚙️ Window Settings Cheat Sheet

### Visual Settings

```typescript
// TRANSPARENT FLOATING WINDOW (Current)
frame: false,
transparent: true,
backgroundColor: undefined,
hasShadow: false,
vibrancy: 'under-window'  // macOS blur

// SOLID WINDOW
frame: false,
transparent: false,
backgroundColor: '#FFFFFF',
hasShadow: true,
vibrancy: undefined

// STANDARD WINDOW (with title bar)
frame: true,
transparent: false,
backgroundColor: '#FFFFFF',
hasShadow: true
```

### Behavior Settings

```typescript
// FIXED SHELF (Current)
resizable: false,
movable: true,
minimizable: false,
maximizable: false,

// FLEXIBLE WINDOW
resizable: true,
movable: true,
minimizable: true,
maximizable: true,
minWidth: 300,
maxWidth: 600,

// PERSISTENT OVERLAY
alwaysOnTop: true,
skipTaskbar: true,
focusable: false  // Click-through
```

### Size Presets

```typescript
// CURRENT DEFAULT
width: 400,
height: 300,

// COMPACT
width: 250,
height: 200,

// LARGE
width: 600,
height: 400,

// SIDEBAR
width: 300,
height: screen.height - 100,

// TOOLBAR
width: screen.width - 100,
height: 80,
```

---

## 🔧 Common Modifications

### 1. Make Window Opaque

```typescript
// Change in shelf_manager.ts:234-236
transparent: false,            // was: true
backgroundColor: '#FFFFFF',    // was: undefined
hasShadow: true,              // was: false
```

### 2. Enable Resizing

```typescript
// Change in shelf_manager.ts:243
resizable: true,              // was: false
minWidth: 300,                // add
maxWidth: 600,                // add
minHeight: 200,               // add
maxHeight: 500,               // add
```

### 3. Always on Top

```typescript
// Change in shelf_manager.ts:249
alwaysOnTop: true,            // was: false
```

### 4. Add Title Bar

```typescript
// Change in shelf_manager.ts:232
frame: true,                  // was: false
transparent: false,           // must be false
titleBarStyle: 'default',    // was: 'customButtonsOnHover'
```

### 5. Change Pool Size

```typescript
// Change in advanced_window_pool.ts:16-18
warmPoolSize: 3,              // was: 2 (faster, more memory)
coldPoolSize: 2,              // was: 3 (adjust ratio)
```

---

## 🎨 React UI Adjustments

### For Transparent Windows

```tsx
// ShelfPage.tsx wrapper div
<div className="bg-transparent rounded-xl p-4">{/* Content */}</div>
```

### For Solid Windows

```tsx
// ShelfPage.tsx wrapper div
<div className="bg-white rounded-xl shadow-lg p-4">{/* Content */}</div>
```

### Add Drag Region (frameless)

```tsx
// Add to top of ShelfPage.tsx
<div className="h-8 w-full cursor-move" style={{ WebkitAppRegion: 'drag' }}>
  <button style={{ WebkitAppRegion: 'no-drag' }} onClick={handleClose}>
    Close
  </button>
</div>
```

### Handle Resizing

```tsx
// Add resize observer in ShelfPage.tsx
useEffect(() => {
  const handleResize = () => {
    const [width, height] = window.outerSize;
    // Update layout based on new size
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

## 🐛 Quick Fixes

### Window is Black/White (not transparent)

```typescript
// Check ALL of these:
frame: false,                 // ✓ Must be false
transparent: true,            // ✓ Must be true
backgroundColor: undefined,   // ✓ Must be undefined
// Also check React: className="bg-transparent"
```

### Can't Drag Window

```tsx
// Add to React component:
<div style={{ WebkitAppRegion: 'drag' }}>{/* Draggable area */}</div>
```

### Window Flickers on Show

```typescript
// In shelf_manager.ts:258
show: (false, // Create hidden
  // After setup:
  window.once('ready-to-show', () => {
    window.show();
  }));
```

### High CPU with Transparency

```typescript
// Option 1: Remove effects
vibrancy: undefined,          // Remove blur
hasShadow: false,            // Remove shadow

// Option 2: Go opaque
transparent: false,
backgroundColor: '#FFFFFF',
```

### Wrong Monitor Position

```typescript
// In positioning_strategy.ts
const display = screen.getDisplayNearestPoint(mousePos);
const x = display.bounds.x + (display.bounds.width - width) / 2;
const y = display.bounds.y + (display.bounds.height - height) / 2;
```

---

## 📊 Performance Impact

| Setting             | CPU  | GPU  | Memory | FPS Impact  |
| ------------------- | ---- | ---- | ------ | ----------- |
| `transparent: true` | +15% | +25% | +10MB  | -10fps      |
| `vibrancy` effect   | +20% | +30% | +15MB  | -15fps      |
| `hasShadow: true`   | +5%  | +10% | +5MB   | -5fps       |
| Large window size   | +10% | +15% | +20MB  | -5fps       |
| Window pooling (5)  | -    | -    | +50MB  | +90% faster |

---

## 🚀 Testing Commands

```bash
# Development mode (auto-reload)
yarn dev

# Check types after changes
yarn typecheck

# Test window specifically
yarn test:window

# Full quality check
yarn quality:check

# Performance monitoring
# Open: Cmd+Option+I (Mac)
# Go to: Performance tab
```

---

## ⚡ Quick Decision Tree

```
Need transparent background?
├─ Yes → frame: false, transparent: true
│   └─ Need blur? → vibrancy: 'under-window'
└─ No → transparent: false, backgroundColor: '#color'
    └─ Need title bar? → frame: true

Need user resizing?
├─ Yes → resizable: true, add min/max sizes
└─ No → resizable: false

Need always visible?
├─ Yes → alwaysOnTop: true
│   └─ Hide from taskbar? → skipTaskbar: true
└─ No → alwaysOnTop: false

Performance issues?
├─ High GPU → Remove transparency/vibrancy
├─ High Memory → Reduce pool size
└─ Slow creation → Increase warm pool
```

---

## 📝 Copy-Paste Templates

### Floating Transparent Shelf (Default)

```typescript
{
  frame: false,
  transparent: true,
  backgroundColor: undefined,
  hasShadow: false,
  resizable: false,
  width: 400,
  height: 300,
  show: false,
  vibrancy: 'under-window',
  webPreferences: {
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

### Solid Resizable Window

```typescript
{
  frame: false,
  transparent: false,
  backgroundColor: '#FFFFFF',
  hasShadow: true,
  resizable: true,
  minWidth: 300,
  maxWidth: 600,
  minHeight: 200,
  maxHeight: 500,
  width: 400,
  height: 300,
  show: false,
  webPreferences: {
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

### Always-on-Top Badge

```typescript
{
  frame: false,
  transparent: true,
  backgroundColor: undefined,
  hasShadow: false,
  resizable: false,
  width: 200,
  height: 60,
  alwaysOnTop: true,
  skipTaskbar: true,
  show: false,
  webPreferences: {
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

---

## ✅ Pre-Change Checklist

Before modifying window settings:

- [ ] Understand current behavior
- [ ] Check platform compatibility
- [ ] Consider performance impact
- [ ] Plan React UI changes
- [ ] Have rollback ready

After changes:

- [ ] Run `yarn typecheck`
- [ ] Test with `yarn dev`
- [ ] Check all interactions
- [ ] Monitor performance
- [ ] Test on multi-monitor

---

**Remember:** Window settings affect both Electron (main) and React (renderer). Always test both layers!
