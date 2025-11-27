# FileCataloger Documentation

**Last Updated:** 2025-11-27

Welcome to the FileCataloger documentation! This folder contains comprehensive guides for understanding, developing, and troubleshooting the application.

---

## 📚 Documentation Index

### Core Documentation (Start Here)

#### 1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System Architecture

**Read this if you want to:**

- Understand how FileCataloger works
- Learn about the multi-process architecture
- Understand window management and pooling
- See IPC communication patterns
- Learn about state management (Zustand)

**Key Topics:**

- Multi-process architecture (Main, Renderer, Preload)
- Window management and two-layer design
- Native module integration (C++)
- Performance optimizations
- Module relationships

#### 2. [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Feature Implementation

**Read this if you want to:**

- Implement new features
- Add new component types
- Understand the meta-component system
- Follow best practices and patterns

**Key Topics:**

- Meta-component system (Notion-like)
- AI naming component guide
- Adding new component types
- Implementation patterns
- Code examples

#### 3. [DEBUG_NOTES.md](./DEBUG_NOTES.md) - Bug History & Solutions

**Read this if you want to:**

- Fix a known issue
- Understand past bugs
- Prevent recurring problems
- Learn from mistakes

**Key Topics:**

- Bug #1: Component template persistence
- Bug #2: Pattern instance persistence
- Bug #3: React infinite loops
- Bug #4: Shelf auto-hide during drag
- Bug #5: Click+shake false positives
- Bug #6: Drag session duplicates

#### 4. [OPTIMIZATION_HISTORY.md](./OPTIMIZATION_HISTORY.md) - Performance Improvements

**Read this if you want to:**

- Understand optimization efforts
- See performance metrics
- Learn what was improved and why
- Plan future optimizations

**Key Topics:**

- Phase 1: Main process refactoring (72% reduction)
- Phase 2: Renderer optimizations
- Performance metrics
- Future optimization plans

#### 5. [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) - Developer Quick Reference

**Read this if you want to:**

- Quick reference for common tasks
- Code navigation help
- Utility usage examples
- Debugging tips
- Window settings reference

**Key Topics:**

- Common development tasks
- Code navigation patterns
- Utilities reference
- Window configuration presets
- Debugging guide
- IPC channel reference

#### 6. [WINDOW_ARCHITECTURE_GUIDE.md](./WINDOW_ARCHITECTURE_GUIDE.md) - Window Configuration Guide

**Read this if you want to:**

- Modify window settings
- Understand window configuration options
- Learn about two-layer architecture
- See effects of different settings

**Key Topics:**

- Complete BrowserWindow configuration
- Common modifications (transparent, resizable, etc.)
- Performance implications
- Platform-specific considerations
- Testing window changes

---

## 🚀 Quick Start by Role

### New Developer

**Start here:**

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
2. Review [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) - Learn common tasks
3. Skim [DEBUG_NOTES.md](./DEBUG_NOTES.md) - Know the pitfalls
4. Check [WINDOW_ARCHITECTURE_GUIDE.md](./WINDOW_ARCHITECTURE_GUIDE.md) - If working on windows

### Implementing a Feature

**Start here:**

1. Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - See patterns
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand where it fits
3. Reference [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) - For specifics

### Debugging an Issue

**Start here:**

1. Check [DEBUG_NOTES.md](./DEBUG_NOTES.md) - Is it a known issue?
2. Use [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) - Debugging guide
3. Refer to [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the flow

### Performance Investigation

**Start here:**

1. Read [OPTIMIZATION_HISTORY.md](./OPTIMIZATION_HISTORY.md) - Past improvements
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) - Performance optimizations section
3. Use [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) - Performance monitoring

---

## 📖 Documentation Map

```
FileCataloger Docs
│
├── ARCHITECTURE.md
│   ├── System Overview
│   ├── Multi-Process Architecture
│   ├── Window Management (Two-Layer)
│   ├── IPC Communication
│   ├── State Management
│   └── Performance Optimizations
│
├── IMPLEMENTATION_GUIDE.md
│   ├── Meta-Component System
│   ├── AI Naming Component
│   ├── Adding Component Types
│   └── Implementation Patterns
│
├── DEBUG_NOTES.md
│   ├── Bug #1: Template Persistence
│   ├── Bug #2: Pattern Persistence
│   ├── Bug #3: React Loops
│   ├── Bug #4: Shelf Auto-Hide
│   ├── Bug #5: Click+Shake
│   └── Bug #6: Duplicate Shelves
│
├── OPTIMIZATION_HISTORY.md
│   ├── Phase 1: Main Process Refactoring
│   ├── Phase 2: Renderer Optimizations
│   ├── Ongoing Plans
│   └── Performance Metrics
│
├── DEVELOPMENT_REFERENCE.md
│   ├── Quick Start
│   ├── Project Structure
│   ├── Code Navigation
│   ├── Common Tasks
│   ├── Utilities Reference
│   ├── Window Settings
│   └── Debugging Guide
│
└── WINDOW_ARCHITECTURE_GUIDE.md
    ├── Window Configuration Settings
    ├── How to Modify Window Behavior
    ├── Common Modifications
    ├── Effects and Dependencies
    └── Testing Changes
```

---

## 🎯 Common Scenarios

### "I need to understand how windows are created"

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) → Window Management section
2. Check [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) → Code Navigation → Shelf Creation Flow

### "I'm getting a React infinite loop error"

1. Go to [DEBUG_NOTES.md](./DEBUG_NOTES.md) → Bug #3
2. Follow the solution pattern with refs and debouncing

### "I want to add a new component type"

1. Read [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) → Adding New Component Types
2. Follow the step-by-step guide

### "Performance is slow, what should I check?"

1. Read [OPTIMIZATION_HISTORY.md](./OPTIMIZATION_HISTORY.md) → Performance Metrics
2. Use [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) → Performance Monitoring
3. Check [ARCHITECTURE.md](./ARCHITECTURE.md) → Performance Optimizations

### "How do I add an IPC channel?"

1. Go to [DEVELOPMENT_REFERENCE.md](./DEVELOPMENT_REFERENCE.md) → Common Tasks → Adding a New IPC Channel
2. Follow the 4-step process

---

## 📊 Documentation Stats

- **Total Documents:** 6 (consolidated from 23)
- **Total Pages:** ~60+ pages of content
- **Coverage:**
  - Architecture: ✅ Comprehensive
  - Implementation: ✅ Complete
  - Debugging: ✅ All major bugs documented
  - Optimization: ✅ Full history
  - Reference: ✅ Quick access
  - Window Config: ✅ Detailed guide

---

## 🔄 Keeping Docs Updated

### When to Update

**ARCHITECTURE.md:**

- Adding new modules or services
- Changing IPC patterns
- Modifying window behavior
- Performance optimizations

**IMPLEMENTATION_GUIDE.md:**

- Adding new feature types
- New implementation patterns
- Better practices discovered

**DEBUG_NOTES.md:**

- **CRITICAL**: Every time you fix a bug!
- Add the problem, root cause, solution
- Include prevention guidelines

**OPTIMIZATION_HISTORY.md:**

- After completing optimization phases
- When metrics improve significantly
- New performance targets

**DEVELOPMENT_REFERENCE.md:**

- New utilities added
- New common tasks
- Updated keyboard shortcuts
- New debugging techniques

---

## 💡 Tips

1. **Search across docs**: Use Cmd+Shift+F in your editor to search all docs
2. **Keep them current**: Update docs when you change code
3. **Link between docs**: Reference related sections in other docs
4. **Add examples**: Code examples are more valuable than prose
5. **Document WHY**: Not just what, but why decisions were made

---

## 🆘 Need Help?

If you can't find what you're looking for:

1. **Check the Table of Contents** in each document
2. **Search for keywords** across all docs
3. **Review related sections** - docs are cross-linked
4. **Check git history** - See how code evolved
5. **Ask the team** - Update docs with the answer!

---

**Documentation maintained by the FileCataloger team**

For the main project README, see: [../README.md](../README.md)

For development guidelines, see: [../CLAUDE.md](../CLAUDE.md)
