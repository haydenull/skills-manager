# skills-manager

skills-manager 是一个桌面端 Skills 管理工具，用于统一安装、更新、调试和移除 Claude Code 与 Codex 使用的本地 skills。

## 功能

- 支持从 GitHub、自部署 GitLab 和本地目录安装 skills。
- 支持更新检查：GitHub 依赖目录 tree sha，GitLab 和本地目录依赖 `sha256` 文件哈希。
- 支持调试模式，可临时切换到本地 Skill 目录。

## 安装

当前仅支持 macOS。

1. 打开 [Releases](https://github.com/haydenull/skills-manager/releases) 页面。
2. 下载适合当前 Mac 芯片的 `.dmg` 安装包：
   - Apple Silicon：选择文件名包含 `arm64` 的安装包。
   - Intel Mac：选择文件名包含 `x64` 的安装包。
3. 双击打开 `.dmg` 文件。
4. 将 `Skills Manager` 拖到“应用程序”目录。
5. 打开终端，执行以下命令解除 macOS 隔离标记：

```bash
xattr -d com.apple.quarantine /Applications/Skills\ Manager.app
```

6. 从“应用程序”中打开 `Skills Manager`。

## 使用说明

### 安装 Skill

1. 打开左侧的“安装”页面。
2. 在来源输入框中填写 Skill 来源。
3. 点击“预览”，查看可安装的 skills。
4. 勾选要安装的 Skill。
5. 选择要安装到的目标 Agent：Claude Code、Codex，或两者都选。
6. 点击“安装”完成安装。

支持的来源格式：

- GitHub 仓库简写，例如 `owner/repo`
- GitHub 仓库完整 URL
- 自部署 GitLab SSH 地址，例如 `git@gitlab.example.com:group/repo.git`
- 本地目录，例如 `/Users/me/skills` 或 `~/skills`

本地目录既可以是单个 skill 目录，也可以是包含多个 skills 的集合目录。

### 管理已安装 Skill

在“已安装 Skill”页面可以查看由本应用管理的 skills，并执行以下操作：

- 刷新列表和更新状态
- 将某个 Skill 添加到 Claude Code 或 Codex
- 从某个 Agent 移除 Skill
- 更新有新版本的 Skill
- 进入或退出调试模式
- 打开 Skill 存储目录
- 完全删除 Skill

列表中的“可更新”标记表示该 Skill 的来源有新内容可同步。

### 调试 Skill

在“已安装 Skill”页面点击调试按钮后，应用会要求选择一个本地 Skill 目录。该目录必须包含 `SKILL.md`，并且其中声明的 Skill 名称需要与当前 Skill 一致。

进入调试后，应用会把该 Skill 在 Claude Code 或 Codex 中的入口切换到所选本地目录。处于调试中的 Skill 会显示“调试中”标记，并在来源信息下显示当前调试目录。

退出调试后，应用会恢复到应用存储中的正式版本。

### 设置

在“设置”页面可以：

- 切换深色或浅色外观
- 检查、下载并安装应用更新
- 打开应用数据目录
- 打开 Claude Code skills 目录
- 打开 Codex skills 目录

默认目录：

- Claude Code skills：`~/.claude/skills`
- Codex skills：`~/.codex/skills`

也可以通过环境变量覆盖默认目录：

- `CLAUDE_CONFIG_DIR`：覆盖 Claude Code 配置目录
- `CODEX_HOME`：覆盖 Codex 配置目录

## 开发

### 准备环境

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

### 常用命令

```bash
pnpm dev          # 启动开发环境
pnpm lint         # 运行 ESLint
pnpm typecheck    # 运行 TypeScript 类型检查
pnpm build        # 构建应用
pnpm build:mac    # 打包 macOS 应用
```

开发模式会使用仓库内的 `.debug/` 目录作为本地开发隔离环境，不会直接改动真实的 Claude Code 或 Codex skills 目录。
