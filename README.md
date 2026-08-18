# dsh-github

A Source Control and GitHub repository panel for DeepSeek Harness that mirrors the VS Code native Git Source Control view.

## Features

- **Source Control tab** — a third "Source Control" tab in the session view ring (alongside chat and trajectory); when active it fills the main area and splits into the SCM panel (left) and the diff viewer (right) with no overlay, shows only the current session's workspace, and switching back to chat restores the conversation.
- **Repository header** — repository (workspace) name, current branch, ahead/behind counts, GitHub link, and refresh button.
- **Commit bar** — multi-line commit message, `Amend` checkbox, `Commit` button with a dropdown (Commit / Commit & Push / Commit & Sync / Undo Last Commit), and a round Sync/Publish button with ↑n ↓n counts.
- **Change groups** — STAGED CHANGES / CHANGES / MERGE CHANGES (untracked files live inside CHANGES), collapsible, with count badges and group actions (+ stage all / − unstage all / ↶ discard all). File status badges use VS Code colors: `A` green, `M` brown-yellow, `D` red, `R`/`C` blue, `U` green, `!` yellow.
- **Diff viewer** — side-by-side and inline modes with line numbers and added/removed coloring; the file header shows old path → new path. Conflict files expose Accept Current / Accept Incoming / Accept Both.
- **Discard with confirmation** — discard a single file or all changes through an inline confirmation dialog (never a bare `window.confirm`).
- **Commits** — searchable history (message/author), short SHA + subject + author + relative date + refs badges; expand a commit for full details and per-file diffs, with Copy SHA, Checkout Commit, Create Branch, and Create Tag.
- **Branches** — current branch highlighted; checkout, rename, delete, merge-into-current, and rebase-onto.
- **Remotes** — fetch/push URLs per remote; fetch, fetch (prune), add, and remove.
- **Tags** — list, create, push, and delete.
- **Stashes** — list, apply, apply & drop, drop, and view diff.
- **Merge / rebase state** — continue and abort an in-progress merge or rebase from the panel.
- **Git output** — a collapsible section of recent git commands and their (redacted) output.
- **Auto-refresh** — refreshes on open, every 3 seconds while the tab is active (paused when switched away), and on window focus / visibility change; the lazy sections (commits, branches, remotes, tags, stashes) load on first expand and refresh with each status poll.

The plugin uses the repository's normal local Git configuration, SSH keys, HTTPS credential helpers, and Git remotes. It does not call the GitHub API, store GitHub tokens, implement OAuth, depend on GitHub CLI, or expose arbitrary shell commands. GitHub links open the corresponding browser pages; the Compare page is the handoff for creating a pull request. Git writes require an explicit user action, and repository state is reloaded after each operation.

## Design notes

See [docs/ANALYSIS.md](docs/ANALYSIS.md) for the state model, VS Code Git alignment, local authentication boundary, and GitHub browser handoff design. The panel's visual design follows the DeepSeek design spec — see [docs/UI_DESIGN.md](docs/UI_DESIGN.md).

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

Restart the Web Harness after rebuilding the plugin. A third "Source Control" tab appears in the session view ring (next to chat and trajectory).

## Development

- Node.js `>= 22.19`
- pnpm `>= 9`

```sh
pnpm run check
```

`pnpm run check` runs `typecheck`, `lint`, `test`, and `build`. CI runs the same command after `pnpm install --frozen-lockfile`.
