# 开发说明

[English](development.md)

## 准备环境

请先安装 Node.js，并启用 pnpm。本项目使用的包管理器版本为：

```bash
pnpm@10.7.0
```

如果本机还没有 pnpm，可以通过 Corepack 启用：

```bash
corepack enable
```

安装依赖：

```bash
pnpm install
```

## 常用命令

```bash
pnpm dev          # 启动开发环境
pnpm lint         # 运行 ESLint
pnpm typecheck    # 运行 TypeScript 类型检查
pnpm build        # 构建应用
pnpm build:mac    # 打包 macOS 应用
```

开发模式会使用仓库内的 `.debug/` 目录作为本地开发隔离环境，不会直接改动真实的 Claude Code 或 Codex skills 目录。
