# Contributing to FileCataloger

First off, thank you for considering contributing to FileCataloger! It's people like you that make FileCataloger such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by respect and professionalism. By participating, you are expected to uphold this standard. Please report unacceptable behavior by opening an issue.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find that you don't need to create one. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what you expected
- **Include screenshots or animated GIFs** if possible
- **Include your environment details**: OS version, Node.js version, etc.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to most users
- **List any similar features** in other applications if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the development setup** instructions in README.md
3. **Make your changes** following our coding standards
4. **Add tests** if you're adding functionality
5. **Ensure all tests pass** (`yarn test`)
6. **Run quality checks** (`yarn quality:check`)
7. **Update documentation** if needed
8. **Commit with clear messages** following conventional commits

#### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format
3. Ensure your PR description clearly describes the problem and solution
4. Link any related issues in the PR description
5. Request review from maintainers

## Development Guidelines

### TypeScript Style Guide

We follow the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html):

- Use TypeScript for all code (no JavaScript)
- Enable strict mode in TypeScript
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, never use `var`

### Code Quality Standards

Before submitting a PR, ensure:

```bash
# Type checking passes
yarn typecheck

# Linting passes
yarn lint

# Code is formatted
yarn format

# All tests pass
yarn test

# Native modules validate
yarn test:native:validate

# Complete quality check
yarn quality:check
```

### Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(shelf): add drag-and-drop reordering
fix(native): resolve memory leak in mouse tracker
docs(readme): update installation instructions
```

### Architecture Guidelines

When making changes, respect the application architecture:

- **Main Process**: Node.js environment, system integration
- **Renderer Process**: React UI, browser environment
- **Preload Scripts**: IPC bridge, context isolation
- **Native Modules**: C++ addons for platform-specific features

Read `CLAUDE.md` for detailed architecture documentation.

### Testing Requirements

- **Unit Tests**: Required for new business logic
- **Integration Tests**: Required for IPC communication changes
- **Native Module Tests**: Required for C++ changes
- **UI Tests**: Recommended for significant UI changes

### Platform-Specific Development

#### macOS Development

- Requires Xcode Command Line Tools
- Test on both Intel and Apple Silicon if possible
- Verify Accessibility permissions work correctly

#### Windows Development (Experimental)

- Requires Visual Studio Build Tools
- Test on both x64 and ARM64 if possible
- Follow Win32 API best practices

### Documentation Standards

- Update inline code comments for complex logic
- Update README.md for user-facing changes
- Update CLAUDE.md for architectural changes
- Add JSDoc for public APIs and exported functions

## Project Structure

Familiarize yourself with the project structure:

```
FileCataloger/
├── src/
│   ├── main/           # Main process (Node.js)
│   ├── renderer/       # Renderer process (React)
│   ├── preload/        # Preload scripts
│   ├── native/         # Native C++ modules
│   └── shared/         # Shared types and constants
├── config/             # Build and tool configurations
├── scripts/            # Development and build scripts
└── docs/               # Additional documentation
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: See SECURITY.md
- **Architecture**: Read CLAUDE.md

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes for significant contributions
- CHANGELOG.md credits

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to FileCataloger! 🎉
