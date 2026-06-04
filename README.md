# skills-manager

skills-manager 是面向 Claude Code 与 Codex 用户的桌面端 skills 管理工具。它使用 Electron、React 和 TypeScript 构建，用于统一预览、安装、更新和移除本地 skills。

## 功能概览

- 从 GitHub、自部署 GitLab 仓库或本地目录预览可安装的 skills。
- 将选中的 skills 安装到 Claude Code、Codex 或两者。
- 查看由本应用管理的已安装 skills、来源、存储路径和安装时间。
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

该命令会启动 Electron Vite 开发环境，并默认启用本地隔离调试模式，避免安装、更新或移除 skills 时影响真实的 Claude Code 与 Codex 配置。

调试数据会写入当前仓库的 `.debug/` 目录：

```text
.debug/userData
.debug/claude/skills
.debug/codex/skills
```

`SKILLS_MANAGER_LOCAL_DEBUG=1` 的优先级最高；启用后会忽略 `CLAUDE_CONFIG_DIR` 与 `CODEX_HOME`。如需测试真实配置目录，可以直接运行不带该变量的 `electron-vite dev`。

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
- 开发模式下 `pnpm dev` 会设置 `SKILLS_MANAGER_LOCAL_DEBUG=1`，强制使用仓库内 `.debug/` 调试目录。

应用会在自身存储中维护安装记录，并将 skills 链接到对应 agent 的 skills 目录。

## Skill 来源

- GitHub 支持 `owner/repo` 简写和完整仓库 URL。
- 自部署 GitLab 支持 SSH clone 地址，例如 `git@gitlab.example.com:group/subgroup/repo.git`。
- 本地目录支持绝对路径和当前用户 home 目录下的 `~` 路径，例如 `/Users/me/skills` 或 `~/skills`。
- 本地目录可以是单个 skill 目录，也可以是包含多个 skills 的集合目录。
- GitLab 仅使用仓库默认分支，不支持指定分支、Tag 或子目录。
- GitLab 私有仓库使用本机已配置的 SSH Key。请预先配置 `ssh-agent` 和 `known_hosts`。
