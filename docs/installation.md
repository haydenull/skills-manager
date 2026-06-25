# Installation

[简体中文](installation.zh-CN.md)

Only macOS builds are currently available.

1. Open the [Releases](https://github.com/haydenull/skills-manager/releases) page.
2. Download the `.dmg` installer for your Mac:
   - Apple Silicon: choose the file with `arm64` in the name.
   - Intel Mac: choose the file with `x64` in the name.
3. Open the `.dmg` file.
4. Drag `Skills Manager` to the Applications folder.
5. Open Terminal and run the following command to remove the macOS quarantine flag:

```bash
xattr -d com.apple.quarantine /Applications/Skills\ Manager.app
```

6. Open `Skills Manager` from Applications.
