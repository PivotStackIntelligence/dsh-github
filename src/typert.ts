/**
 * dsh-github — Host Typert model manifest for local Git and GitHub browser links.
 * Author: bugmaker2 · PivotStack Intelligence
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { DSH_GITHUB_INVOCATIONS } from './contract.ts'

/** Host manifest for local Git and GitHub browser links. */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-github', face: 'host', schemas: [],
  model: {
    services: [{ key: 'github', exportName: 'GithubRuntime', description: 'Manage local Git state and GitHub browser links.', tags: [], members: [
      { kind: 'method', name: 'getStatus', signature: 'getStatus(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'getDiff', signature: 'getDiff(path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal): Promise<GitDiff>' },
      { kind: 'method', name: 'stage', signature: 'stage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'unstage', signature: 'unstage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'stageAll', signature: 'stageAll(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'unstageAll', signature: 'unstageAll(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'discard', signature: 'discard(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'discardAll', signature: 'discardAll(path: string, includeUntracked: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'commit', signature: 'commit(path: string, message: string, amend: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'undoLastCommit', signature: 'undoLastCommit(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'resolveConflict', signature: 'resolveConflict(path: string, filePath: string, strategy: GitConflictStrategy, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'push', signature: 'push(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'fetch', signature: 'fetch(path: string, remoteName: string, all: boolean, prune: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'pull', signature: 'pull(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'sync', signature: 'sync(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'checkoutBranch', signature: 'checkoutBranch(path: string, branch: string, remote: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'createBranch', signature: 'createBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'createBranchFrom', signature: 'createBranchFrom(path: string, branch: string, sha: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'branchRename', signature: 'branchRename(path: string, oldName: string, newName: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'branchDelete', signature: 'branchDelete(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'mergeBranch', signature: 'mergeBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'rebaseBranch', signature: 'rebaseBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'abortMerge', signature: 'abortMerge(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'abortRebase', signature: 'abortRebase(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'continueMerge', signature: 'continueMerge(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'continueRebase', signature: 'continueRebase(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'checkoutCommit', signature: 'checkoutCommit(path: string, sha: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'getRepositoryOverview', signature: 'getRepositoryOverview(path: string, signal?: AbortSignal): Promise<GitRepositoryOverview>' },
      { kind: 'method', name: 'log', signature: 'log(path: string, query: string, signal?: AbortSignal): Promise<GitLog>' },
      { kind: 'method', name: 'showCommit', signature: 'showCommit(path: string, sha: string, signal?: AbortSignal): Promise<GitCommitDetail>' },
      { kind: 'method', name: 'showCommitDiff', signature: 'showCommitDiff(path: string, sha: string, filePath: string, signal?: AbortSignal): Promise<GitDiff>' },
      { kind: 'method', name: 'stashList', signature: 'stashList(path: string, signal?: AbortSignal): Promise<GitStashList>' },
      { kind: 'method', name: 'stashCreate', signature: 'stashCreate(path: string, message: string, includeUntracked: boolean, keepIndex: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'stashApply', signature: 'stashApply(path: string, ref: string, drop: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'stashDrop', signature: 'stashDrop(path: string, ref: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'stashDiff', signature: 'stashDiff(path: string, ref: string, signal?: AbortSignal): Promise<GitDiff>' },
      { kind: 'method', name: 'tagList', signature: 'tagList(path: string, signal?: AbortSignal): Promise<GitTagList>' },
      { kind: 'method', name: 'tagCreate', signature: 'tagCreate(path: string, name: string, message: string, atRef: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'tagDelete', signature: 'tagDelete(path: string, name: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'pushTags', signature: 'pushTags(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'remoteList', signature: 'remoteList(path: string, signal?: AbortSignal): Promise<GitRemoteList>' },
      { kind: 'method', name: 'remoteAdd', signature: 'remoteAdd(path: string, name: string, url: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'remoteRemove', signature: 'remoteRemove(path: string, name: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'getOutput', signature: 'getOutput(signal?: AbortSignal): Promise<GitOutput>' },
    ], types: [] }], events: [], objects: [],
  },
  invocations: DSH_GITHUB_INVOCATIONS,
}
