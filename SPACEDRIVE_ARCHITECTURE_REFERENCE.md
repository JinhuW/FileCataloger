# Spacedrive Architecture Reference

> **Project**: Spacedrive - Cross-platform universal file explorer
> **Repository**: https://github.com/spacedriveapp/spacedrive
> **Purpose**: Reference documentation for understanding Spacedrive's architecture and reusable patterns

## Overview

Spacedrive is a production-ready, cross-platform file management application built with Tauri 2.0, React, and Rust. It follows modern software engineering practices and demonstrates excellent patterns for desktop applications with multi-platform support.

## Project Structure

### Monorepo Organization (pnpm workspace)

```
spacedrive/
├── apps/                     # Application targets
│   ├── desktop/             # Tauri desktop app
│   ├── mobile/              # React Native mobile app
│   ├── web/                 # Web version
│   ├── landing/             # Marketing website (Next.js)
│   ├── server/              # Standalone server
│   └── storybook/           # Component documentation
├── core/                    # Rust backend core
├── crates/                  # Shared Rust crates
├── interface/               # Shared React interface
├── packages/                # Shared TypeScript packages
└── docs/                    # Documentation
```

### Workspace Dependencies

- **Package Manager**: pnpm 9.0+ with workspace configuration
- **Build System**: Turbo for monorepo builds
- **Version Control**: Git with structured commit conventions

## Technology Stack

### Frontend (React/TypeScript)

- **Framework**: React 18.2+ with TypeScript 5.6+
- **Build Tool**: Vite 5.4+ for fast development and builds
- **Desktop**: Tauri 2.0 for native desktop app
- **Mobile**: React Native with Expo
- **Styling**: Tailwind CSS 3.4+ with custom configuration
- **State Management**:
  - Valtio for reactive state
  - Zustand patterns (referenced in dependencies)
  - @tanstack/react-query for server state
- **Routing**: React Router 6.20.1 (memory router for desktop)
- **UI Components**:
  - Radix UI primitives (@radix-ui/\*)
  - Custom component library (@sd/ui)
  - Headless UI components
- **Forms**: React Hook Form 7.47+
- **Icons**: Phosphor Icons (@phosphor-icons/react)

### Backend (Rust)

- **Core Framework**: Custom Rust architecture with Tokio async runtime
- **Database**:
  - SQLite with Prisma Client Rust
  - Migrations management
  - Type-safe database queries
- **API Layer**: RSPC for type-safe client-server communication
- **File System**:
  - Cross-platform file operations
  - File watching with notify-rs
  - Virtual distributed filesystem engine
- **P2P Networking**: Custom peer-to-peer implementation
- **Encryption**: Custom crypto crate with secure implementations
- **Media Processing**: FFmpeg integration for thumbnails and metadata

### Desktop Integration (Tauri)

- **Tauri Version**: 2.0+ with latest configuration schema
- **Window Management**: Custom window effects and decorations
- **Security**: Comprehensive CSP configuration
- **Native Features**:
  - File system access
  - Drag and drop operations
  - System tray integration
  - Auto-updater with signed releases
  - Deep linking support

## Architecture Patterns

### Frontend Architecture

#### Component Organization

```
interface/
├── app/                     # Route components
│   ├── $libraryId/         # Library-scoped routes
│   └── onboarding/         # Onboarding flow
├── components/             # Shared UI components
├── hooks/                  # Custom React hooks
├── locales/               # Internationalization
└── util/                  # Utility functions
```

#### State Management Strategy

- **Global State**: Valtio for reactive global state
- **Server State**: TanStack Query for API data caching
- **Local State**: React hooks for component-local state
- **Explorer State**: Specialized store for file explorer functionality

#### Routing Strategy

- **Memory Router**: For desktop app (no URL bar)
- **Tab System**: Multi-tab interface with history management
- **Type-safe Routes**: Zod schema validation for route parameters

### Backend Architecture

#### Core Structure

```
core/
├── src/
│   ├── api/               # API endpoints and routing
│   ├── library/           # Library management
│   ├── location/          # File location handling
│   ├── node/              # Node/device management
│   ├── preferences/       # User preferences
│   ├── search/            # Search functionality
│   └── volume/            # Storage volume management
└── crates/                # Domain-specific sub-crates
    ├── cloud-services/    # Cloud integration
    ├── heavy-lifting/     # Resource-intensive operations
    ├── indexer-rules/     # File indexing rules
    └── sync/              # Data synchronization
```

#### Service Layer Pattern

- **Command Pattern**: RSPC commands for client-server communication
- **Repository Pattern**: Database access abstraction
- **Event System**: Publish-subscribe for internal events
- **Job System**: Background task processing

### Cross-Platform Strategy

#### Platform Abstraction

- **Desktop**: Tauri with React frontend
- **Mobile**: React Native with shared TypeScript logic
- **Web**: React with web-specific adaptations
- **Server**: Headless Rust binary

#### Code Sharing

- **Interface Package**: Shared React components and logic
- **Client Package**: Shared API client code
- **UI Package**: Design system components
- **Core Logic**: Rust backend shared across platforms

## Key Implementation Patterns

### Type Safety

- **End-to-end Types**: RSPC generates TypeScript types from Rust
- **Schema Validation**: Zod for runtime type checking
- **Strict TypeScript**: No implicit any, strict null checks
- **Database Types**: Prisma generates type-safe database client

### Error Handling

- **Rust Errors**: thiserror for structured error types
- **TypeScript Errors**: Result types and proper error boundaries
- **User Feedback**: Toast notifications and error pages
- **Logging**: Structured logging with tracing crate

### Performance Optimizations

- **Virtual Scrolling**: For large file lists
- **Lazy Loading**: Code splitting and dynamic imports
- **Caching**: Multi-layer caching strategy
- **Background Processing**: Heavy operations in background threads

### Security

- **Content Security Policy**: Strict CSP for Tauri webview
- **Input Validation**: Server-side validation for all inputs
- **File Access**: Sandboxed file system access
- **Crypto**: Custom cryptographic implementations

## Development Environment

### Build Configuration

- **Frontend**: Vite with TypeScript path aliases
- **Backend**: Cargo workspace with optimized profiles
- **Development**: Hot reload with Tauri dev mode
- **Production**: Optimized builds with code splitting

### Code Quality Tools

- **Linting**: ESLint with TypeScript and React rules
- **Formatting**: Prettier with consistent configuration
- **Type Checking**: TypeScript strict mode
- **Rust Quality**: Clippy with pedantic lints

### Testing Strategy

- **Unit Tests**: Vitest for frontend, standard Rust tests
- **Integration Tests**: End-to-end testing setup
- **Type Tests**: Compilation-time type verification

## Notable Implementation Details

### File Explorer

- **Virtual Grid**: Efficient rendering of large file lists
- **Drag and Drop**: Native OS drag and drop integration
- **Context Menus**: Platform-specific context menu handling
- **Preview System**: Quick preview for various file types

### Database Design

- **SQLite**: Embedded database with WAL mode
- **Migrations**: Versioned schema changes
- **Indexing**: Optimized indexes for search performance
- **Relationships**: Well-structured relational design

### Internationalization

- **i18next**: Full internationalization support
- **Language Detection**: Automatic language detection
- **Plural Rules**: Proper plural form handling
- **RTL Support**: Right-to-left language support

## Reusable Patterns for FileCataloger

### Recommended Adoptions

1. **Monorepo Structure**: Use pnpm workspace for better dependency management
2. **RSPC Pattern**: Type-safe client-server communication
3. **Component Architecture**: Feature-based component organization
4. **State Management**: TanStack Query + local state hooks
5. **Error Handling**: Structured error types and boundaries
6. **Development Workflow**: Turbo + Vite for fast development
7. **Code Quality**: Comprehensive linting and formatting setup

### Architecture Lessons

1. **Separation of Concerns**: Clear boundaries between UI, business logic, and data
2. **Type Safety**: End-to-end type safety prevents runtime errors
3. **Performance First**: Virtual rendering and caching are essential for file management
4. **Platform Abstraction**: Design for multi-platform from the start
5. **Background Processing**: Heavy operations should never block the UI

### Configuration Patterns

1. **Workspace Configuration**: Centralized dependency management
2. **Build Optimization**: Development vs production optimization strategies
3. **Security Configuration**: Comprehensive CSP and sandboxing
4. **Platform-Specific Builds**: Target-specific optimizations

## References

- **Main Repository**: https://github.com/spacedriveapp/spacedrive
- **Documentation**: Comprehensive docs/ directory with architecture details
- **Dependencies**: See package.json and Cargo.toml files for exact versions
- **Build Scripts**: scripts/ directory contains setup and build automation

---

_This document serves as an architectural reference for understanding Spacedrive's production-ready patterns and implementation strategies. Use it to guide architectural decisions and identify reusable patterns for similar projects._
