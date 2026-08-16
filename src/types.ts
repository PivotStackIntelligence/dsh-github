/** A changed file in the active local Git repository. */
export interface GitFileChange {
  /** Repository-relative path using the Git status spelling. */
  path: string
  /** Index-side status code, or a space when unchanged. */
  index: string
  /** Worktree-side status code, or a space when unchanged. */
  worktree: string
  /** Whether the path is untracked, added, deleted, renamed, copied, or modified. */
  kind: 'untracked' | 'added' | 'deleted' | 'renamed' | 'copied' | 'conflict' | 'modified'
  /** Previous repository-relative path for a rename or copy status, or null for other statuses. */
  previousPath: string | null
  /** Browser URL for the committed HEAD version of this file, when GitHub is detected. */
  fileUrl: string | null
}

/** In-progress multi-step Git state detected from the repository's git directory. */
export type GitMergeState = 'merge' | 'rebase' | null

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
  /** Name of the Git remote selected by the current branch, when configured. */
  remoteName: string | null
  /** Git remote URL selected by the current branch, when configured. */
  remoteUrl: string | null
  /** Browser URL for a github.com remote, when detected. */
  githubUrl: string | null
  /** Name of the remote selected for push by local Git configuration. */
  pushRemoteName: string | null
  /** Push URL selected by local Git configuration, with credentials removed. */
  pushRemoteUrl: string | null
  /** Full local HEAD commit SHA, or null before the first commit. */
  headSha: string | null
  /** Browser URL for the local HEAD commit, when GitHub is detected. */
  commitUrl: string | null
  /** In-progress merge or rebase state, when detected. */
  mergeState: GitMergeState
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

/** How a conflicted file should be resolved. */
export type GitConflictStrategy = 'ours' | 'theirs' | 'both'

/** One local or selected-remote branch shown in the repository view. */
export interface GitBranch {
  /** Short branch name. */
  name: string
  /** Whether HEAD currently points to this branch. */
  current: boolean
  /** Whether this is a remote-tracking branch. */
  remote: boolean
  /** Configured upstream branch, when present. */
  upstream: string | null
  /** Browser URL for this branch when the selected remote is a GitHub repository. */
  branchUrl: string | null
}

/** Branch and browser links for the active repository. */
export interface GitRepositoryOverview {
  /** Local and selected-remote tracking branches. */
  branches: GitBranch[]
  /** Name of the Git remote used for branch listings and browser links. */
  remoteName: string | null
  /** Browser URL for the detected GitHub repository. */
  githubUrl: string | null
  /** Browser URL for creating a pull request from the current branch. */
  compareUrl: string | null
}

/** One commit in the repository history list. */
export interface GitCommitSummary {
  /** Full commit SHA. */
  sha: string
  /** Short commit SHA. */
  shortSha: string
  /** First line of the commit message. */
  subject: string
  /** Author name. */
  author: string
  /** Author email. */
  email: string
  /** Author date in ISO 8601. */
  date: string
  /** Decoration refs (branch and tag names) pointing at this commit. */
  refs: string[]
}

/** Capped commit history projection. */
export interface GitLog {
  /** Commits, newest first, capped by configuration. */
  commits: GitCommitSummary[]
  /** True when the commit list was capped. */
  truncated: boolean
}

/** One file touched by a commit. */
export interface GitCommitFile {
  /** Repository-relative path. */
  path: string
  /** Change kind relative to the first parent. */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'
  /** Previous path for rename or copy statuses. */
  previousPath: string | null
}

/** One commit's full detail and file list. */
export interface GitCommitDetail {
  /** Full commit SHA. */
  sha: string
  /** Short commit SHA. */
  shortSha: string
  /** First line of the commit message. */
  subject: string
  /** Rest of the commit message. */
  body: string
  /** Author name. */
  author: string
  /** Author email. */
  email: string
  /** Author date in ISO 8601. */
  date: string
  /** Decoration refs pointing at this commit. */
  refs: string[]
  /** Files changed by the commit, capped. */
  files: GitCommitFile[]
  /** True when the file list was capped. */
  truncated: boolean
}

/** Capped stash list projection. */
export interface GitStashList {
  /** Stash entries, newest first. */
  stashes: GitStash[]
}

/** One stash entry. */
export interface GitStash {
  /** Full stash ref, e.g. stash@{0}. */
  ref: string
  /** Stash commit SHA. */
  sha: string
  /** Stash creation date in ISO 8601. */
  date: string
  /** Stash message. */
  message: string
}

/** Tag list projection. */
export interface GitTagList {
  /** Tags, newest first. */
  tags: GitTag[]
}

/** One tag. */
export interface GitTag {
  /** Tag name. */
  name: string
  /** Pointed-at object short SHA. */
  sha: string
  /** Annotation subject or empty for lightweight tags. */
  subject: string
}

/** Remote list projection. */
export interface GitRemoteList {
  /** Configured remotes in Git order. */
  remotes: GitRemote[]
}

/** One configured remote with credential-free URLs. */
export interface GitRemote {
  /** Remote name. */
  name: string
  /** Fetch URL with credentials removed. */
  fetchUrl: string
  /** Push URL with credentials removed. */
  pushUrl: string
}

/** Bounded Git command output buffer projection. */
export interface GitOutput {
  /** Recorded executions, newest first. */
  entries: GitOutputEntry[]
}

/** One recorded Git command execution. */
export interface GitOutputEntry {
  /** The command executed, always "git". */
  command: string
  /** Argument vector with credential material redacted. */
  args: string[]
  /** Whether the command exited successfully. */
  ok: boolean
  /** Bounded, redacted stdout/stderr text. */
  output: string
  /** ISO 8601 execution time. */
  at: string
}

/** Resolved host configuration for the GitHub plugin. */
export interface ResolvedConfig {
  /** Maximum changed files returned to the browser. */
  maxFiles: number
  /** Maximum diff bytes returned for one file. */
  maxDiffBytes: number
  /** Maximum bytes read from an untracked file for a synthetic diff. */
  maxUntrackedBytes: number
  /** Maximum commits returned by one history query. */
  maxLogEntries: number
  /** Maximum recorded command executions kept in the output buffer. */
  maxOutputEntries: number
}
