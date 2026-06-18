# 安装说明

当前发布的安装包仅提供 macOS 版本。

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
