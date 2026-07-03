# Development

[简体中文](development.zh-CN.md)

## Setup

Install Node.js, then enable pnpm. This project requires:

```bash
pnpm@10.7.0
```

If pnpm is not installed, enable it via Corepack:

```bash
corepack enable
```

Install dependencies:

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev          # Start the development environment
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking
pnpm build        # Build the app
pnpm build:mac    # Package for macOS
pnpm build:win    # Package for Windows on Windows runners
```

In development mode, the app uses the `.debug/` directory in the repository as an isolated local environment and does not modify your real Claude Code or Codex skills directories.

Release builds are created by the GitHub Actions release workflow. Windows distributables are built on `windows-latest`.
