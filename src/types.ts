/** A changed file in the active local Git repository. */
export interface GitFileChange {
  /** Repository-relative path using the Git status spelling. */
  path: string
  /** Index-side status code, or a space when unchanged. */
  index: string
  /** Worktree-side status code, or a space when unchanged. */
  worktree: string
  /** Whether the path is untracked, added, deleted, renamed, copied, or modified. */
  kind: 'untracked' | 'added' | 'deleted' | 'renamed' | 'copied' | 'modified'
}

/** Repository metadata and the current change list. */
export interface GitStatus {
  /** Canonical repository root. */
  root: string
  /** Current branch, or a detached-HEAD label. */
  branch: string
  /** Configured upstream branch, when available. */
  upstream: string | null
  /** Commits ahead of upstream. */
  ahead: number
  /** Commits behind upstream. */
  behind: number
  /** Git remote URL for `origin`, when configured. */
  remoteUrl: string | null
  /** Browser URL for a github.com remote, when detected. */
  githubUrl: string | null
  /** Changed files, capped by configuration. */
  files: GitFileChange[]
  /** True when the file list was capped. */
  truncated: boolean
}

/** Which side of the index a requested diff represents. */
export type GitDiffMode = 'working' | 'staged'

/** One selected file's bounded unified diff. */
export interface GitDiff {
  /** Repository-relative path. */
  path: string
  /** Unified diff text, or a useful message for binary files. */
  diff: string
  /** True when the diff was capped. */
  truncated: boolean
}

/** One local or origin branch shown in the repository view. */
export interface GitBranch {
  /** Short branch name. */
  name: string
  /** Whether HEAD currently points to this branch. */
  current: boolean
  /** Whether this is an origin remote-tracking branch. */
  remote: boolean
  /** Configured upstream branch, when present. */
  upstream: string | null
}

/** Branch and browser links for the active repository. */
export interface GitRepositoryOverview {
  /** Local and origin remote-tracking branches. */
  branches: GitBranch[]
  /** Browser URL for the detected GitHub repository. */
  githubUrl: string | null
  /** Browser URL for creating a pull request from the current branch. */
  compareUrl: string | null
}

/** Resolved host configuration for the GitHub plugin. */
export interface ResolvedConfig {
  /** Maximum changed files returned to the browser. */
  maxFiles: number
  /** Maximum diff bytes returned for one file. */
  maxDiffBytes: number
  /** Maximum bytes read from an untracked file for a synthetic diff. */
  maxUntrackedBytes: number
}
