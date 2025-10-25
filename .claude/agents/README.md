# Claude Code Agents for FileCataloger

This directory contains specialized code review agents for the FileCataloger Electron application. These agents provide domain-specific expertise for comprehensive code quality analysis.

## Agent Hierarchy

### Tier 1: Master Orchestrator

- **[code-reviewer](./code-reviewer.md)** (opus, blue) - Master orchestrator that coordinates specialized reviewers

### Tier 2: Domain Specialists

- **[native-module-reviewer](./native-module-reviewer.md)** (sonnet, purple) - C++ native modules, N-API, macOS APIs
- **[main-process-reviewer](./main-process-reviewer.md)** (sonnet, cyan) - Electron main process, Node.js backend
- **[renderer-process-reviewer](./renderer-process-reviewer.md)** (opus, green) - React components, UI, hooks, accessibility
- **[ipc-security-reviewer](./ipc-security-reviewer.md)** (opus, red) - IPC security, preload scripts, context isolation
- **[state-management-reviewer](./state-management-reviewer.md)** (sonnet, yellow) - Zustand stores, selectors, state optimization
- **[window-management-reviewer](./window-management-reviewer.md)** (sonnet, orange) - BrowserWindow, shelf management, multi-monitor
- **[performance-reviewer](./performance-reviewer.md)** (sonnet, magenta) - Performance optimization, profiling, hot paths
- **[configuration-reviewer](./configuration-reviewer.md)** (sonnet, gray) - Build configs, TypeScript, webpack, package.json

### Tier 3: Quality & Integration

- **[test-quality-reviewer](./test-quality-reviewer.md)** (opus, teal) - Test coverage, quality, patterns, flakiness
- **[integration-reviewer](./integration-reviewer.md)** (sonnet, indigo) - Cross-layer integration, end-to-end workflows
- **[accessibility-reviewer](./accessibility-reviewer.md)** (sonnet, purple) - WCAG compliance, keyboard nav, screen readers

### Tier 4: Feature Planning

- **[electron-architect-planner](./electron-architect-planner.md)** (sonnet, yellow) - Feature design, implementation planning
- **[electron-test-writer](./electron-test-writer.md)** (sonnet, purple) - Test creation for all layers

### Legacy/Deprecated

- **[electron-code-reviewer](./electron-code-reviewer.md)** (opus, green) - DEPRECATED - Use specialized agents instead

## Agent Selection Guide

### By File Type

| File Pattern                | Primary Agent              | Secondary Agent           |
| --------------------------- | -------------------------- | ------------------------- |
| `src/native/**/*.cpp`       | native-module-reviewer     | performance-reviewer      |
| `src/main/**/*.ts`          | main-process-reviewer      | -                         |
| `src/main/ipc/*.ts`         | ipc-security-reviewer      | main-process-reviewer     |
| `src/main/modules/window/*` | window-management-reviewer | main-process-reviewer     |
| `src/renderer/**/*.tsx`     | renderer-process-reviewer  | accessibility-reviewer    |
| `src/renderer/stores/*.ts`  | state-management-reviewer  | renderer-process-reviewer |
| `src/preload/*.ts`          | ipc-security-reviewer      | -                         |
| `**/*.test.ts`              | test-quality-reviewer      | -                         |
| `package.json`              | configuration-reviewer     | -                         |
| `tsconfig*.json`            | configuration-reviewer     | -                         |
| `webpack.*.js`              | configuration-reviewer     | -                         |
| `binding.gyp`               | native-module-reviewer     | configuration-reviewer    |

### By Review Scenario

| Scenario                       | Recommended Agents                                 |
| ------------------------------ | -------------------------------------------------- |
| **New Feature Implementation** | code-reviewer → delegates to specialized agents    |
| **Performance Issues**         | performance-reviewer + relevant domain agent       |
| **Security Audit**             | ipc-security-reviewer + native-module-reviewer     |
| **Accessibility Compliance**   | accessibility-reviewer + renderer-process-reviewer |
| **Test Coverage Gap**          | test-quality-reviewer + electron-test-writer       |
| **Build/Config Issues**        | configuration-reviewer                             |
| **Cross-Layer Feature**        | integration-reviewer + relevant domain agents      |
| **Architecture Planning**      | electron-architect-planner                         |

## Using Agents

### Single Domain Review

```bash
# Review React component
Use renderer-process-reviewer for src/renderer/components/NewComponent.tsx

# Review native module
Use native-module-reviewer for src/native/mouse-tracker/

# Review IPC security
Use ipc-security-reviewer for src/main/ipc/handlers.ts
```

### Multi-Domain Review

```bash
# Use master orchestrator
Use code-reviewer to orchestrate review of changed files

# The orchestrator will:
1. Analyze changed files
2. Launch specialized agents in parallel
3. Synthesize results into unified report
```

### Parallel Agent Execution

When reviewing multiple domains, agents can be launched in parallel:

```typescript
// Launch multiple agents concurrently
Task({ subagent_type: 'native-module-reviewer', ... })
Task({ subagent_type: 'main-process-reviewer', ... })
Task({ subagent_type: 'ipc-security-reviewer', ... })
```

## Agent Capabilities

### Review Focus Areas

| Agent                      | Primary Focus                              | Key Strengths                         |
| -------------------------- | ------------------------------------------ | ------------------------------------- |
| native-module-reviewer     | Memory safety, RAII, macOS APIs            | C++ expertise, memory leak detection  |
| main-process-reviewer      | Event-driven patterns, module lifecycle    | AsyncMutex, event routing             |
| renderer-process-reviewer  | React patterns, hooks, UI/UX               | Component optimization, accessibility |
| ipc-security-reviewer      | Security vulnerabilities, input validation | Attack scenarios, Zod schemas         |
| state-management-reviewer  | Zustand optimization, selectors            | Re-render prevention, Map usage       |
| window-management-reviewer | BrowserWindow, positioning                 | Multi-monitor, macOS behaviors        |
| performance-reviewer       | Hot paths, profiling                       | Event batching, memory pooling        |
| configuration-reviewer     | Build optimization, TypeScript             | Native module builds, webpack         |
| test-quality-reviewer      | Coverage gaps, test patterns               | Flakiness detection, mocking          |
| integration-reviewer       | End-to-end workflows                       | Cross-layer data flow                 |
| accessibility-reviewer     | WCAG compliance                            | Screen reader, keyboard nav           |

### Model Assignments

| Model      | Agents                                                                                 | Use Case                                 |
| ---------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Opus**   | code-reviewer, renderer-process-reviewer, ipc-security-reviewer, test-quality-reviewer | Critical reviews requiring deep analysis |
| **Sonnet** | All other agents                                                                       | Balanced performance and quality         |

## Best Practices

### 1. Choose the Right Agent

- Use specialized agents for domain-specific reviews
- Use code-reviewer for multi-domain orchestration
- Use integration-reviewer for cross-layer features

### 2. Provide Context

- Include file paths being reviewed
- Describe the nature of changes
- Specify any particular concerns

### 3. Parallel Execution

- Launch independent agents concurrently
- Wait for all results before synthesizing
- Use code-reviewer to coordinate

### 4. Handle Conflicts

- When agents disagree, consider context
- Balance performance vs maintainability
- Document trade-off decisions

### 5. Priority Management

- P0: Critical security/crash issues
- P1: Performance/memory leaks
- P2: Functionality issues
- P3: Code quality/maintainability
- P4: Style/minor optimizations

## Agent Output Format

All agents follow a consistent output format:

```markdown
## 📊 Overview

- Scope and assessment summary
- Key metrics and scores

## 🚨 Critical Issues (Must Fix)

- Security vulnerabilities
- Memory leaks
- Crashes/data loss

## ⚠️ Important Issues (Should Fix)

- Performance problems
- Accessibility violations
- Test coverage gaps

## 💡 Suggestions (Consider)

- Optimizations
- Best practices
- Refactoring opportunities

## ✅ Strengths

- Well-implemented patterns
- Good practices observed

## 📈 Metrics

- Relevant measurements
- Coverage/performance data
```

## Creating New Agents

When creating new agents, follow this template:

```yaml
---
name: agent-name
description: Clear description of agent's purpose and when to use it
model: sonnet # or opus for critical agents
color: color-name
---
[Agent prompt with specialized expertise and review methodology]
```

## Maintenance

### Adding Agents

1. Create new `.md` file in this directory
2. Follow the template structure
3. Update this README with the new agent
4. Test the agent with sample code

### Updating Agents

1. Modify the agent's `.md` file
2. Test with relevant code samples
3. Update this README if capabilities change

### Deprecating Agents

1. Mark as DEPRECATED in description
2. Point to replacement agents
3. Update this README

## Feedback

For issues or suggestions about these agents, please report at:
https://github.com/anthropics/claude-code/issues
