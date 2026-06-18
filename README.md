# skills-manager

skills-manager 是一个桌面端 Skills 管理工具，用于统一安装、更新、调试和移除 Claude Code 与 Codex 使用的本地 skills。

## 功能

- 支持从 GitHub、自部署 GitLab 和本地目录安装 skills。
- 支持更新检查：GitHub 依赖目录 tree sha，GitLab 和本地目录依赖 `sha256` 文件哈希。
- 支持调试模式，可临时切换到本地 Skill 目录。

## 安装

安装应用见 [安装说明](docs/installation.md)。

## 使用说明

### 配置 GitLab Token

从自部署 GitLab 安装 Skill 前，需要先在“设置”页面配置对应 host 的 Personal access token。

1. 打开顶部导航中的“设置”页面。
2. 在 `GitLab Host` 中填写 GitLab 域名，例如 `gitlab.example.com`。
3. 在 `GitLab Token` 中填写 Personal access token。
4. 点击“保存”。

应用会按 host 保存 token，并在访问对应 GitLab API 时使用。Token 至少需要具备读取仓库内容的权限。

### 安装 Skill

1. 打开顶部导航中的“安装新 Skill”页面。
2. 在来源输入框中填写 Skill 来源。
3. 点击“预览”，查看可安装的 skills。
4. 勾选要安装的 Skill。
5. 选择要安装到的目标 Agent：Claude Code、Codex，或两者都选。
6. 点击“安装”完成安装。

支持的来源格式：

- GitHub 仓库简写，例如 `owner/repo`
- GitHub 仓库完整 URL
- 自部署 GitLab HTTPS 地址，例如 `https://gitlab.example.com/group/repo`
- 自部署 GitLab 目录地址，例如 `https://gitlab.example.com/group/repo/-/tree/main/skills`
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
- 配置或删除自部署 GitLab 的 Personal access token
- 检查应用更新，并打开 Releases 下载页
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

开发环境和常用命令见 [开发说明](docs/development.md)。
