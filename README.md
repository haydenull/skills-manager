# skills-manager

[简体中文](README.zh-CN.md)

skills-manager is a desktop Skills management tool for installing, updating, debugging, and removing local skills used by Claude Code and Codex.

## Features

- Install skills from GitHub, self-hosted GitLab, or local directories.
- Update checking: GitHub and GitLab use repository tree metadata when available; local directories and clone fallbacks use `sha256` content hashes.
- Debug mode: temporarily switch a skill to a local directory for development.

## Installation

See [Installation Guide](docs/installation.md).

## Usage

### Configure GitLab Token

Before installing skills from a self-hosted GitLab, configure a Personal access token for that host on the Settings page.

1. Open the **Settings** page from the top navigation.
2. Enter the GitLab domain in `GitLab Host`, e.g. `gitlab.example.com`.
3. Enter your Personal access token in `GitLab Token`.
4. Click **Save**.

The app stores tokens per host and uses them when calling the corresponding GitLab API. The token requires at least read access to repository contents.

### Install a Skill

1. Open the **Install New Skill** page from the top navigation.
2. Enter the skill source in the input field.
3. Click **Preview** to see available skills.
4. Select the skills you want to install.
5. Choose the target agent: Claude Code, Codex, or both.
6. Click **Install**.

Supported source formats:

- GitHub shorthand, e.g. `owner/repo`
- Full GitHub repository URL
- Self-hosted GitLab HTTPS URL, e.g. `https://gitlab.example.com/group/repo`
- Self-hosted GitLab directory URL, e.g. `https://gitlab.example.com/group/repo/-/tree/main/skills`
- Local directory, e.g. `/Users/me/skills`, `~/skills`, or `C:\Users\me\skills`

A local directory can be either a single skill directory or a collection directory containing multiple skills.

### Manage Installed Skills

The **Installed Skills** page lists all skills managed by this app. Available actions:

- Refresh the list and check for updates
- Add a skill to Claude Code or Codex
- Remove a skill from an agent
- Update skills with a new version available
- Enter or exit debug mode
- Open the skill storage directory
- Delete a skill entirely

The **Updatable** badge indicates that new content is available from the skill's source.

### Debug a Skill

Click the debug button on the **Installed Skills** page. The app will prompt you to select a local skill directory. The directory must contain a `SKILL.md` whose declared skill name matches the current skill.

Once in debug mode, the app redirects the skill's entry point in Claude Code or Codex to the selected local directory. Skills in debug mode show a **Debugging** badge and display the current debug directory below the source info.

Exiting debug mode restores the skill to the version stored in the app.

### Settings

On the **Settings** page you can:

- Toggle dark or light appearance
- Configure or remove Personal access tokens for self-hosted GitLab
- Check for app updates and open the Releases download page
- Open the app data directory
- Open the Claude Code skills directory
- Open the Codex skills directory

Default directories:

- Claude Code skills: `~/.claude/skills`
- Codex skills: `~/.codex/skills`

Override defaults with environment variables:

- `CLAUDE_CONFIG_DIR`: overrides the Claude Code config directory
- `CODEX_HOME`: overrides the Codex config directory

## Development

See [Development Guide](docs/development.md).
