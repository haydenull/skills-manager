# skills-manager

skills-manager 是面向 Claude Code 与 Codex 用户的桌面端 skills 管理工具。它使用 Electron、React 和 TypeScript 构建，用于统一预览、安装、更新和移除本地 skills。

## 功能概览

- 从 GitHub 仓库预览可安装的 skills。
- 将选中的 skills 安装到 Claude Code、Codex 或两者。
- 查看由本应用管理的已安装 skills、来源、存储路径和更新时间。
- 更新已安装 skills，并同步到对应 agent 的 skills 目录。
- 从指定 agent 或应用存储中移除 skills。
- 在界面中查看安装、更新、移除等操作日志。

## 技术栈

- Electron 39
- React 19
- TypeScript 5
- HeroUI React
- Tailwind CSS 4
- electron-vite
- electron-builder
- pnpm 10.7.0

## 环境要求

请使用 pnpm 安装依赖。仓库通过 `packageManager` 锁定为：

```bash
pnpm@10.7.0
```

如果本机未启用 pnpm，可以先启用 Corepack：

```bash
corepack enable
```

## 安装依赖

```bash
pnpm install
```

安装完成后会执行 `postinstall`，用于安装 Electron 应用依赖。

## 本地开发

```bash
pnpm dev
```

该命令会启动 Electron Vite 开发环境。

## 代码检查

```bash
pnpm lint
pnpm typecheck
```

- `pnpm lint` 使用 ESLint 检查代码。
- `pnpm typecheck` 同时检查 Node 与 Web 两套 TypeScript 配置。

## 构建

```bash
pnpm build
```

该命令会先执行 TypeScript 类型检查，再运行 `electron-vite build`。

平台打包命令：

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

也可以生成未打包目录：

```bash
pnpm build:unpack
```

## 项目结构

```text
src/
├── main/       # Electron 主进程，负责窗口、IPC 和本地 skills 操作
├── preload/    # preload 桥接层，向 renderer 暴露受控 API
├── shared/     # main、preload、renderer 共享类型
└── renderer/   # React 渲染进程和页面 UI
```

更多目录说明见 [docs/file-tree.md](docs/file-tree.md)。

## 配置说明

- Claude Code skills 默认目录：`~/.claude/skills`
- Codex skills 默认目录：`~/.codex/skills`
- 可通过 `CLAUDE_CONFIG_DIR` 覆盖 Claude Code 配置目录。
- 可通过 `CODEX_HOME` 覆盖 Codex 配置目录。

应用会在自身存储中维护安装记录，并将 skills 链接到对应 agent 的 skills 目录。
