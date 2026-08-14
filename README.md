# dsh-github

A Source Control and GitHub repository panel for DeepSeek Harness.

## Features

- Shows the active workspace branch, upstream, ahead/behind counts, and changed files.
- Groups staged, working-tree, untracked, and merge-conflict changes with bounded diff previews.
- Opens changed files through the Harness workspace opener and can open changed files and the current commit on GitHub when the remote is detected.
- Stages and unstages individual files or all changes through fixed-argument local `git` commands, including staging a resolved merge conflict.
- Commits staged changes from the panel, including a `Cmd/Ctrl+Enter` shortcut and operation feedback; if push fails after commit, the panel reports that the commit already exists.
- Pushes, fetches, fast-forward pulls, and synchronizes through the repository's configured Git remotes and credential helpers. When several remotes exist, the plugin requires Git to identify the branch remote or push remote instead of guessing.
- Lists local branches and the current branch remote's tracking branches, checks them out, and creates local branches. Matching local and remote-tracking names are shown once.
- Shows pull-request refs already fetched by local Git as links to their GitHub pages; it does not query GitHub for pull requests.
- Derives GitHub repository, branch, and compare links from the configured fetch and push remotes, then opens those pages in the browser. The compare page is the handoff point for creating a pull request, including the common fork workflow.

The plugin uses the repository's normal local Git configuration, SSH keys, HTTPS credential helpers, and Git remotes. It does not call the GitHub API, store GitHub tokens, implement OAuth, depend on GitHub CLI, or expose arbitrary shell commands. GitHub links open the corresponding browser pages; the Compare page is the handoff for creating a pull request. Git writes require an explicit user action, and repository state is reloaded after each operation.

## Design notes

See [docs/ANALYSIS.md](docs/ANALYSIS.md) for the state model, VS Code Git alignment, local authentication boundary, and GitHub browser handoff design.

## Requirements

- DeepSeek Harness `>=0.1.0-rc.6`
- Git available on `PATH`
- A configured Git remote and credential helper for push/fetch/pull operations

## Install from a local checkout

```sh
pnpm install
pnpm run build
dsh plugin --profile web add .
```

Restart the Web Harness after rebuilding the plugin. Open a workspace's overflow menu and choose **View Source Control**.

## Development

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
