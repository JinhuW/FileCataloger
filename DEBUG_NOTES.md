# Debug Notes

## React Hooks Dependency Issues

### Problem

React components may fail silently when useCallback/useEffect/useMemo hooks have missing or incorrect dependencies. This can cause:

- Components not rendering
- White/blank screens
- Functions using stale closures
- Circular dependency issues when functions reference each other

### Detection Methods

1. **During Development (yarn dev)**
   - Look for console warnings about exhaustive-deps
   - Watch for components that don't appear but show no errors
   - Check for "Cannot access X before initialization" errors

2. **During Linting (yarn lint)**

   ```bash
   yarn lint
   # Look for: React Hook useCallback has missing dependencies
   ```

3. **Enable Strict ESLint Rules**
   - Set `'react-hooks/exhaustive-deps': 'error'` in .eslintrc.js
   - This will fail the build if dependencies are missing

4. **Runtime Detection**
   - Add error boundary components to catch render errors
   - Use React DevTools to check if components are mounting

### Common Patterns to Avoid

```typescript
// BAD - performRename used before defined
const handleRename = useCallback(() => {
  performRename(); // Error: Cannot access before initialization
}, [performRename]);

const performRename = useCallback(() => {
  // ...
}, []);

// GOOD - define in correct order
const performRename = useCallback(() => {
  // ...
}, []);

const handleRename = useCallback(() => {
  performRename();
}, [performRename]);
```

### Prevention

1. Always run `yarn lint` before committing
2. Pay attention to ESLint warnings in your editor
3. When using callbacks that reference each other, define them in dependency order
4. Use the ESLint auto-fix when safe: `yarn lint --fix`

## Shelf UI Not Appearing - Detection Strategy

### Problem

When drag + shake doesn't trigger the shelf UI, there's often no visible error in the logs.

### Enhanced Logging Points

1. **Main Process (shelf creation flow)**

   ```typescript
   // src/main/modules/window/shelf-manager.ts
   logger.info('Creating shelf window', { shelfId, position });
   logger.info('Shelf window created successfully', { shelfId });
   ```

2. **Renderer Process (shelf.tsx)**

   ```typescript
   // Application mount
   logger.info('Shelf window DOM loaded, attempting to mount React app');
   logger.info('Root element found, creating React root');
   logger.info('React render call completed');

   // Component lifecycle
   logger.info('ShelfWindow component initializing');
   logger.info('ShelfWindow component mounted');
   logger.info('ShelfWindow rendering with config:', config);

   // Global error handlers
   window.addEventListener('error', (event) => {
     logger.error('Global error caught:', { ... });
   });
   ```

3. **Component Error Boundaries**
   - Wrap main components in ErrorBoundary
   - Log errors with full stack traces
   - Show visible error in window if render fails

### Debugging Checklist

1. **Check Main Process Logs**

   ```bash
   # Look for shelf creation logs
   tail -f ~/Library/Application Support/FileCataloger/logs/main.log | grep -i shelf
   ```

2. **Check Renderer Process Console**
   - Open DevTools in Electron (Cmd+Opt+I)
   - Look for lifecycle logs
   - Check for uncaught errors

3. **Common Failure Points**
   - Missing dependencies in useCallback/useEffect
   - Import errors (especially circular dependencies)
   - Component throwing during render
   - Window API not available
   - CSS/styling issues making component invisible

4. **Visual Debugging**
   - Add a visible background color temporarily
   - Log component dimensions
   - Check z-index and positioning

### Quick Debug Commands

```bash
# Watch for shelf-related logs in real-time
yarn dev 2>&1 | grep -E "shelf|Shelf|error|Error|mounted|rendering"

# Check for React errors
yarn lint | grep -E "exhaustive-deps|Hook"

# Clear cache and rebuild
rm -rf dist && yarn build
```
