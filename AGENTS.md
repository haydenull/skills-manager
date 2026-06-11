# Repository Guidelines

## 1. 项目概述

skills-manager 是面向 Claude Code 与 Codex 用户的桌面端 skills 管理工具。
目标是用 Electron 应用统一管理本地 skills 资源与相关配置。

## 2. 技术栈

- **包管理**: pnpm 10.7.0，使用 `pnpm-lock.yaml` 锁定依赖。
- **运行壳层**: Electron 39.2.6，入口产物为 `out/main/index.js`。
- **构建工具**: electron-vite 5.0.0，配置集中在 `electron.vite.config.ts`。
- **前端框架**: React 19.2.1 + React DOM 19.2.1。
- **语言**: TypeScript 5.9.3，分 Node 与 Web 两套 tsconfig。
- **UI 组件**: HeroUI React 3.1.0。
- **样式**: Tailwind CSS 4.3.0，通过 `@tailwindcss/vite` 接入。
- **数据格式**: yaml 2.9.0，用于 YAML 读写相关逻辑。
- **Lint**: ESLint 9.39.1，使用 electron-toolkit、React、Hooks、Refresh 规则。
- **Format**: Prettier 3.7.4，ESLint 配置已接入 prettier 兼容规则。
- **打包**: electron-builder 26.0.12，配置文件为 `electron-builder.yml`。
- **路径别名**: renderer 使用 `@renderer/*` 指向 `src/renderer/src/*`。
- **共享类型**: 跨 main、preload、renderer 的类型放在 `src/shared/`。

## 3. 开发规则

- 修改主进程逻辑时优先查看 `src/main/`，不要把 Node 能力放进 renderer。
- 修改 renderer UI 时只使用 `src/renderer/src/` 下的 React 入口与资源。
- preload 暴露的 API 需要同步维护 `src/preload/index.ts` 与 `src/preload/index.d.ts`。
- 跨进程类型必须放在 `src/shared/`，避免 main、preload、renderer 重复声明。
- 不要直接编辑 `out/`、`dist/`、`node_modules/` 等生成目录。
- 保持现有代码风格：两个空格、单引号、无分号、文件职责单一。
- 没有明确需求时，不添加抽象层、兼容垫片、功能开关或大范围重构。
- 若新增 `docs/` 文档，必须同步更新本文档的“文档索引”。

## 4. 常用命令

- `pnpm install`
  安装依赖，并触发 `postinstall` 安装 Electron app deps。

- `pnpm dev`
  启动 Electron Vite 开发环境。

- `pnpm lint`
  使用 ESLint 检查仓库代码，启用缓存。

- `pnpm typecheck`
  同时执行 Node 与 Web TypeScript 类型检查。

- `pnpm build`
  类型检查通过后执行 `electron-vite build`。

## 5. 文档索引

- `docs/file-tree.md` - 项目目录结构、关键文件职责和生成目录说明。
- `docs/installation.md` - macOS 安装包下载、安装和解除隔离标记说明。
- `docs/development.md` - 开发环境准备、常用命令和本地开发隔离说明。
