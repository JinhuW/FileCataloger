# FileCataloger Optimization Plan

> **Principle**: This is a small utility application. Keep solutions simple and avoid over-engineering.

## Executive Summary

FileCataloger is a well-architected Electron app with solid security practices and thoughtful optimizations. The main opportunities are:

1. Reducing existing over-engineering
2. Adding critical test coverage
3. Fixing minor code quality issues
4. Simplifying large components

**Current State**: Production-quality architecture, but some areas are more complex than needed for a small app.

---

## Priority 1: Quick Wins (1-2 Days)

### 1.1 Replace Console.log with Logger

**Issue**: 8 instances of `console.warn`/`console.error` in renderer code violate the logging standard.

**Files to fix**:
| File | Line | Change |
|------|------|--------|
| `src/renderer/features/fileRename/FileRenamePreviewList/FileRenamePreviewList.tsx` | ~2 instances | → `Logger.warn()` |
| `src/renderer/features/fileRename/ComponentLibrary/TemplatePackSection.tsx` | ~2 instances | → `Logger.error()` |
| `src/renderer/api/patterns.ts` | ~1 instance | → `Logger.warn()` |

**Effort**: 30 minutes

### 1.2 Complete TODO Comments

**Current TODOs that need attention**:

```typescript
// src/renderer/components/domain/ErrorBoundary.tsx
// TODO: Implement error reporting
→ Decision: Either implement IPC call to main process error handler, or remove TODO if not needed

// src/renderer/hooks/useShelfItems.ts (2x)
// TODO: Consider rolling back optimistic update
→ Decision: Add try-catch with rollback, or document why rollback isn't needed
```

**Effort**: 1-2 hours

---

## Priority 2: Reduce Over-Engineering (1-2 Days)

### 2.1 Simplify PerformanceMonitor

**Current**: 668 lines with predictive alerts, trend analysis, adaptive intervals
**Problem**: Features not actively used; complexity not justified for small app

**Recommendation**: Slim down to ~250 lines

```typescript
// Keep:
- Memory monitoring with threshold alerts
- Simple CPU monitoring
- Memory cleanup triggers
- Basic logging

// Remove or simplify:
- Predictive trend analysis (unused)
- Complex adaptive interval adjustment
- Performance score calculation
- Trend history beyond last 5 samples
```

**File**: `src/main/modules/utils/performance_monitor.ts`
**Effort**: 2-3 hours

### 2.2 Evaluate State Machine Complexity

**Current**: 7 states in `drag_shelf_state_machine.ts` (480 lines)

```
IDLE → DRAGGING → SHAKE_DETECTED → SHELF_CREATING → SHELF_ACTIVE → DROP_IN_PROGRESS → CLEANING_UP
```

**Questions to answer**:

1. Are all 7 states actively preventing bugs?
2. Could SHAKE_DETECTED and SHELF_CREATING be combined?
3. Is DROP_IN_PROGRESS distinct from SHELF_ACTIVE?

**Recommendation**: Review if simpler 4-5 state machine works:

```
IDLE → DRAGGING → SHELF_ACTIVE → CLEANING_UP
```

**Effort**: 3-4 hours (review + potential simplification)

### 2.3 Simplify Pattern Persistence

**Current**: 703 lines in `pattern_persistence_manager.ts`
**Features**: Save, load, migration, compression, backup, validation

**For a small app, consider**:

- Is compression needed for small pattern files?
- Are migration scripts needed, or can we version simply?
- Is backup redundancy necessary?

**Effort**: 2-3 hours (review + potential simplification)

---

## Priority 3: Component Refactoring (3-5 Days)

### 3.1 Split RenamePatternBuilder.tsx

**Current**: 1,081 lines (way too large for maintainability)

**Proposed split**:

```
RenamePatternBuilder/
├── RenamePatternBuilder.tsx      (300 lines - main orchestrator)
├── PatternComponentList.tsx      (200 lines - chip display/reorder)
├── PatternPreviewSection.tsx     (150 lines - live preview)
├── PatternToolbar.tsx            (100 lines - action buttons)
├── usePatternBuilder.ts          (200 lines - logic hook)
└── index.ts                      (barrel export)
```

**Benefits**:

- Easier testing
- Better re-render isolation
- Improved maintainability
- Clearer responsibilities

**Effort**: 1-2 days

### 3.2 Extract Window Pooling Logic

**Current**: `shelf_manager.ts` (777 lines) mixes window management with pooling

**Recommendation**: Already have `advanced_window_pool.ts` (464 lines) - ensure ShelfManager delegates properly and doesn't duplicate logic.

**Review points**:

- Is there duplicate positioning logic?
- Can dock calculation be extracted?

**Effort**: 3-4 hours

---

## Priority 4: Test Coverage (5-7 Days)

### 4.1 Critical Path Tests

**Current**: Only 3 test files (~800 lines total)

**Add tests for**:

| Module                  | Priority | Reason             |
| ----------------------- | -------- | ------------------ |
| `ShelfManager`          | HIGH     | Core functionality |
| `DragShakeDetector`     | HIGH     | User-facing input  |
| `ApplicationController` | MEDIUM   | Orchestration      |
| `PatternStore`          | MEDIUM   | Data integrity     |
| `shelfStore`            | MEDIUM   | State management   |

**Recommended test structure**:

```
tests/
├── main/
│   ├── shelfManager.test.ts
│   ├── dragShakeDetector.test.ts
│   └── applicationController.test.ts
├── renderer/
│   ├── stores/
│   │   ├── shelfStore.test.ts
│   │   └── patternStore.test.ts
│   └── components/
│       └── ShelfItemComponent.test.tsx
└── integration/
    └── ipc.test.ts
```

**Effort**: 5-7 days for meaningful coverage

### 4.2 IPC Integration Tests

**Test that**:

- All 50+ whitelisted channels work
- Invalid channels are rejected
- Rate limiting functions correctly
- Error responses are formatted correctly

**Effort**: 1-2 days

---

## Priority 5: Event Listener Audit (1 Day)

### 5.1 Verify EventRegistry Usage

**Issue**: Found 42 event listener registrations but only ~25 cleanup operations

**Audit checklist**:

- [ ] All module-to-module listeners use EventRegistry
- [ ] Shelf destruction cleans up all listeners
- [ ] Window close cleans up associated listeners
- [ ] No orphaned listeners after 5 shelf open/close cycles

**Files to audit**:

- `src/main/modules/core/application_controller.ts`
- `src/main/modules/core/shelf_lifecycle_manager.ts`
- `src/main/modules/core/drag_drop_coordinator.ts`
- `src/main/modules/window/shelf_manager.ts`

**Effort**: 4-6 hours

---

## Priority 6: Code Quality (2-3 Days)

### 6.1 Reduce Singleton Overuse

**Current singletons**: Logger, ErrorHandler, PreferencesManager, PerformanceMonitor, etc.

**For testing, consider**:

- Keep Logger and ErrorHandler as singletons (justified)
- Make PreferencesManager injectable for tests
- Make PerformanceMonitor optional/injectable

**Effort**: 1 day

### 6.2 Document Deep Call Chains

**Current issue**: 4-5 level call chains make debugging harder

```
IPC Handler → ApplicationController → ShelfLifecycleManager → ShelfManager → AdvancedWindowPool
```

**Recommendation**: Add debug logging at key transition points, not refactor (keep architecture).

**Effort**: 2-3 hours

---

## What NOT to Change

These are well-designed and appropriate:

1. **Event-driven architecture** - Good for decoupling
2. **Zustand stores** - Clean Map-based storage with Immer
3. **IPC security model** - Excellent whitelist implementation
4. **Native module integration** - Proper abstractions
5. **Window pooling** - Justified optimization
6. **Event batching** - Effective performance optimization
7. **AsyncMutex** - Simple and effective

---

## Summary Table

| Task                        | Priority | Effort   | Impact            |
| --------------------------- | -------- | -------- | ----------------- |
| Replace console.log         | P1       | 30 min   | Code quality      |
| Complete TODOs              | P1       | 2 hrs    | Completeness      |
| Simplify PerformanceMonitor | P2       | 3 hrs    | Reduce complexity |
| Review state machine        | P2       | 4 hrs    | Reduce complexity |
| Split RenamePatternBuilder  | P3       | 2 days   | Maintainability   |
| Add critical tests          | P4       | 5-7 days | Reliability       |
| Audit event listeners       | P5       | 1 day    | Memory safety     |
| Reduce singletons           | P6       | 1 day    | Testability       |

**Total estimated effort**: 10-14 days for all items

---

## Recommended Order of Execution

### Phase 1: Quick Fixes (Day 1)

1. Replace console.log with Logger
2. Complete TODO comments
3. Event listener audit

### Phase 2: Simplification (Days 2-3)

4. Simplify PerformanceMonitor
5. Review state machine complexity

### Phase 3: Refactoring (Days 4-6)

6. Split RenamePatternBuilder
7. Extract any duplicate logic

### Phase 4: Testing (Days 7-14)

8. Add critical path tests
9. Add IPC integration tests

---

## Metrics to Track

After optimization, verify:

| Metric                   | Current | Target                      |
| ------------------------ | ------- | --------------------------- |
| PerformanceMonitor LOC   | 668     | ~300                        |
| RenamePatternBuilder LOC | 1,081   | ~300 (main) + ~500 (splits) |
| Test coverage (renderer) | ~5%     | 30%+                        |
| Test coverage (main)     | 0%      | 20%+                        |
| Console.log instances    | 8       | 0                           |
| Incomplete TODOs         | 4       | 0                           |

---

## Notes

- This plan prioritizes practical improvements over theoretical perfection
- Each phase can be done independently
- Skip items that don't apply after investigation
- Don't add complexity while reducing it elsewhere
