# Installation

[简体中文](installation.zh-CN.md)

Homebrew is the recommended installation path on macOS:

```bash
brew install --cask haydenull/tap/skills-manager
```

You can also open the [Releases](https://github.com/haydenull/skills-manager/releases) page and manually download the installer for your system.

- Windows: choose the `.exe` setup file with `win-x64` in the name.
- macOS Apple Silicon: choose the `.dmg` file with `arm64` in the name.
- macOS Intel: choose the `.dmg` file with `x64` in the name.

## Windows

1. Open the `.exe` setup file.
2. Follow the installer prompts.
3. Open `Skills Manager` from the Start menu or desktop shortcut.

## macOS

### Homebrew

1. Run the install command:

```bash
brew install --cask haydenull/tap/skills-manager
```

2. Open `Skills Manager` from Applications.

### Manual Installation

1. Open the `.dmg` file.
2. Drag `Skills Manager` to the Applications folder.
3. Open Terminal and run the following command to remove the macOS quarantine flag:

```bash
xattr -d com.apple.quarantine /Applications/Skills\ Manager.app
```

4. Open `Skills Manager` from Applications.
