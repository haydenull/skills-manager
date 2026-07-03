# 安装说明

[English](installation.md)

1. 打开 [Releases](https://github.com/haydenull/skills-manager/releases) 页面。
2. 下载适合当前系统的安装包：
   - Windows：选择文件名包含 `win-x64` 的 `.exe` 安装包。
   - macOS Apple Silicon：选择文件名包含 `arm64` 的 `.dmg` 安装包。
   - macOS Intel：选择文件名包含 `x64` 的 `.dmg` 安装包。

## Windows

1. 双击打开 `.exe` 安装包。
2. 按安装向导完成安装。
3. 从开始菜单或桌面快捷方式打开 `Skills Manager`。

## macOS

1. 双击打开 `.dmg` 文件。
2. 将 `Skills Manager` 拖到"应用程序"目录。
3. 打开终端，执行以下命令解除 macOS 隔离标记：

```bash
xattr -d com.apple.quarantine /Applications/Skills\ Manager.app
```

4. 从"应用程序"中打开 `Skills Manager`。
