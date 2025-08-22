# Tauri Application

A production-ready desktop application built with Tauri, React, and TypeScript, featuring comprehensive code quality tools and best practices.

## Tech Stack

### Frontend

- **Framework**: React 19+ with TypeScript 5+
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v7+
- **Icons**: Iconify
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: Zustand
- **Routing**: React Router v6
- **Testing**: Vitest + React Testing Library

### Backend

- **Framework**: Tauri 2.0+
- **Language**: Rust
- **Platform Support**: Windows, macOS, Linux

### Code Quality

- **Linting**: ESLint (Airbnb config)
- **Formatting**: Prettier
- **Git Hooks**: Husky + lint-staged
- **Commit Convention**: Conventional Commits
- **CI/CD**: GitHub Actions

## Prerequisites

- **Node.js**: v20.11.0 or higher (see `.nvmrc`)
- **Rust**: Latest stable version
- **Platform Dependencies**:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `webkit2gtk-4.1`, `libayatana-appindicator3-dev`, `librsvg2-dev`

For detailed prerequisites, visit: [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Getting Started

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tauri-app
```

2. Install Node.js dependencies:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Initialize git hooks:

```bash
yarn prepare
```

### Development

Run the application in development mode:

```bash
yarn tauri dev
```

This will:

- Start the Vite dev server for the frontend
- Compile and run the Rust backend
- Open the application window with hot-reload enabled

### Available Scripts

#### Development

- `yarn dev` - Start Vite dev server only
- `yarn tauri dev` - Start full Tauri development environment

#### Building

- `yarn build` - Build frontend for production
- `yarn tauri build` - Build complete application for distribution

#### Code Quality

- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues automatically
- `yarn format` - Format code with Prettier
- `yarn typecheck` - Check TypeScript types

#### Testing

- `yarn test` - Run tests in watch mode
- `yarn test:ui` - Run tests with UI interface
- `yarn test:coverage` - Generate test coverage report

## Project Structure

````
├── src/                    # Frontend source code
│   ├── components/         # Reusable React components
│   ├── features/          # Feature-based modules
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API and Tauri command services
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── test/              # Test setup and utilities
├── src-tauri/             # Rust backend source code
│   ├── src/              # Rust source files
│   ├── icons/            # Application icons
│   └── target/           # Build output (gitignored)
├── .github/               # GitHub Actions workflows
├── .husky/                # Git hooks
└── .vscode/               # VS Code settings and extensions

## Development Guidelines

### Code Style

This project enforces strict code quality standards:

- **TypeScript**: Strict mode enabled with no implicit any
- **ESLint**: Airbnb configuration with TypeScript support
- **Prettier**: Automatic code formatting on save
- **Import Sorting**: Automatic organization of imports

### Path Aliases

The following path aliases are configured:

- `@/*` - src directory
- `@components/*` - React components
- `@hooks/*` - Custom hooks
- `@utils/*` - Utility functions
- `@types/*` - TypeScript types
- `@services/*` - Service layer
- `@stores/*` - State management
- `@features/*` - Feature modules

### Git Workflow

#### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions or corrections
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `chore:` - Other changes

Example:
```bash
git commit -m "feat: add dark mode toggle to settings"
````

#### Pre-commit Hooks

The following checks run automatically before each commit:

- ESLint fixing
- Prettier formatting
- TypeScript type checking

### Testing

Write tests for:

- Components: Using React Testing Library
- Hooks: Using renderHook utility
- Utilities: Unit tests with Vitest
- Tauri Commands: Integration tests

Run tests before pushing:

```bash
yarn test:coverage
```

## Building for Production

### Desktop Application

Build the application for your current platform:

```bash
yarn tauri build
```

Build for specific platforms:

```bash
# Universal macOS binary
yarn tauri build -- --target universal-apple-darwin

# Windows
yarn tauri build -- --target x86_64-pc-windows-msvc

# Linux
yarn tauri build -- --target x86_64-unknown-linux-gnu
```

The built applications will be in `src-tauri/target/release/bundle/`.

### Mobile Support (Future)

Initialize mobile development:

```bash
yarn tauri android init
yarn tauri ios init
```

## CI/CD Pipeline

GitHub Actions automatically:

1. Run linting and formatting checks
2. Execute test suites with coverage
3. Type-check TypeScript code
4. Build applications for all platforms
5. Upload artifacts for releases

## Environment Variables

Configure environment variables in `.env.local`:

```env
VITE_APP_NAME=YourAppName
VITE_APP_VERSION=1.0.0
VITE_API_URL=http://localhost:3000
VITE_ENABLE_DEBUG=true
```

All frontend environment variables must be prefixed with `VITE_`.

## Troubleshooting

### Common Issues

1. **Build fails on macOS**: Ensure Xcode Command Line Tools are installed:

   ```bash
   xcode-select --install
   ```

2. **Linux build dependencies**: Install required packages:

   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
   ```

3. **Rust not found**: Install Rust from [rustup.rs](https://rustup.rs/)

4. **Node version mismatch**: Use nvm to install the correct version:
   ```bash
   nvm use
   ```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Run tests and ensure all pass
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop applications
- [React](https://react.dev/) - JavaScript library for building user interfaces
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## Support

For issues, questions, or suggestions, please open an issue on GitHub
