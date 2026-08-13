# dsh-github

A Source Control and GitHub repository panel for DeepSeek Harness.

## Features

- Shows the active workspace branch, upstream, ahead/behind counts, and changed files.
- Groups staged, working-tree, and untracked changes with bounded diff previews.
- Opens changed files through the Harness workspace opener and can open changed files and the current commit on GitHub when the remote is detected.
- Stages and unstages individual files or all changes through fixed-argument local `git` commands.
- Commits staged changes from the panel, including a `Cmd/Ctrl+Enter` shortcut and operation feedback.
- Pushes, fetches, fast-forward pulls, and synchronizes through the repository's configured Git remotes and credential helpers.
- Lists local branches and the current branch remote's tracking branches, checks them out, and creates local branches.
- Derives GitHub repository, branch, and compare links from the configured branch remote, then opens those pages in the browser. The compare page is the handoff point for creating a pull request.

The plugin uses the repository's normal local Git configuration, SSH keys, HTTPS credential helpers, and Git remotes. It does not call the GitHub API, store GitHub tokens, implement OAuth, depend on GitHub CLI, or expose arbitrary shell commands. GitHub links open the corresponding browser pages; the Compare page is the handoff for creating a pull request. Git writes require an explicit user action, and repository state is reloaded after each operation.

## Requirements

- DeepSeek Harness `>=0.1.0-rc.6`
- Git available on `PATH`
- A configured Git remote and credential helper for push/fetch/pull operations

## Install from a local checkout

```sh
pnpm install
pnpm run build
dsh plugins install .
```

Restart the Web Harness after rebuilding the plugin. Open a workspace's overflow menu and choose **View Source Control**.

## Development

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
