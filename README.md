# dsh-github

A Source Control and GitHub repository panel for DeepSeek Harness.

## Features

- Shows the active workspace branch, upstream, ahead/behind counts, and changed files.
- Groups staged and working-tree changes with bounded diff previews.
- Stages and unstages individual files or all changes through fixed-argument local `git` commands.
- Commits staged changes from the panel, including a `Cmd/Ctrl+Enter` shortcut and operation feedback.
- Pushes, fetches, fast-forward pulls, and synchronizes through the repository's configured Git remotes and credential helpers.
- Lists local branches and `origin` remote-tracking branches, checks them out, and creates local branches.
- Detects a GitHub `origin` remote, opens the repository in the browser, and opens GitHub's compare page for pull-request creation.

The plugin uses the repository's normal local Git configuration. It does not store GitHub tokens, implement OAuth, depend on GitHub CLI, or expose arbitrary shell commands. Git writes require an explicit user action, and repository state is reloaded after each operation.

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
