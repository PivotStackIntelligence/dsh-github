/**
 * dsh-github — Client Remote contribution and typed namespace face for local Git methods.
 * Author: bugmaker2 · PivotStack Intelligence
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { GitCommitDetail, GitConflictStrategy, GitDiff, GitDiffMode, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../types.ts'
import { DSH_GITHUB_INVOCATIONS } from '../contract.ts'

/** Client contribution for local Git and GitHub browser-link methods. */
export const DSH_GITHUB_REMOTE: TypertRemoteContribution = { package: 'dsh-github', descriptors: DSH_GITHUB_INVOCATIONS }

declare module '@deepseek-ai/dsh-typert-protocol' {
  /** The mounted local Git namespace face. */
  interface TypertRemoteNamespace$676974687562 {
    getStatus: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    getDiff: (path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
    stage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    unstage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    stageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    unstageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    discard: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    discardAll: (path: string, includeUntracked: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    commit: (path: string, message: string, amend: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    undoLastCommit: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    resolveConflict: (path: string, filePath: string, strategy: GitConflictStrategy, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    push: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    fetch: (path: string, remoteName: string, all: boolean, prune: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    pull: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    sync: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    checkoutBranch: (path: string, branch: string, remote: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    createBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    createBranchFrom: (path: string, branch: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    branchRename: (path: string, oldName: string, newName: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    branchDelete: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    mergeBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    rebaseBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    abortMerge: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    abortRebase: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    continueMerge: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    continueRebase: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    checkoutCommit: (path: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    getRepositoryOverview: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRepositoryOverview>>
    log: (path: string, query: string, signal?: AbortSignal) => Promise<RemoteResult<GitLog>>
    showCommit: (path: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitCommitDetail>>
    showCommitDiff: (path: string, sha: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
    stashList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStashList>>
    stashCreate: (path: string, message: string, includeUntracked: boolean, keepIndex: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    stashApply: (path: string, ref: string, drop: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    stashDrop: (path: string, ref: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    stashDiff: (path: string, ref: string, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
    tagList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitTagList>>
    tagCreate: (path: string, name: string, message: string, atRef: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    tagDelete: (path: string, name: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    pushTags: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    remoteList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRemoteList>>
    remoteAdd: (path: string, name: string, url: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    remoteRemove: (path: string, name: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    getOutput: (signal?: AbortSignal) => Promise<RemoteResult<GitOutput>>
  }
  interface TypertRemoteMap {
    'github/getStatus': TypertRemoteNamespace$676974687562['getStatus']
    'github/getDiff': TypertRemoteNamespace$676974687562['getDiff']
    'github/stage': TypertRemoteNamespace$676974687562['stage']
    'github/unstage': TypertRemoteNamespace$676974687562['unstage']
    'github/stageAll': TypertRemoteNamespace$676974687562['stageAll']
    'github/unstageAll': TypertRemoteNamespace$676974687562['unstageAll']
    'github/discard': TypertRemoteNamespace$676974687562['discard']
    'github/discardAll': TypertRemoteNamespace$676974687562['discardAll']
    'github/commit': TypertRemoteNamespace$676974687562['commit']
    'github/undoLastCommit': TypertRemoteNamespace$676974687562['undoLastCommit']
    'github/resolveConflict': TypertRemoteNamespace$676974687562['resolveConflict']
    'github/push': TypertRemoteNamespace$676974687562['push']
    'github/fetch': TypertRemoteNamespace$676974687562['fetch']
    'github/pull': TypertRemoteNamespace$676974687562['pull']
    'github/sync': TypertRemoteNamespace$676974687562['sync']
    'github/checkoutBranch': TypertRemoteNamespace$676974687562['checkoutBranch']
    'github/createBranch': TypertRemoteNamespace$676974687562['createBranch']
    'github/createBranchFrom': TypertRemoteNamespace$676974687562['createBranchFrom']
    'github/branchRename': TypertRemoteNamespace$676974687562['branchRename']
    'github/branchDelete': TypertRemoteNamespace$676974687562['branchDelete']
    'github/mergeBranch': TypertRemoteNamespace$676974687562['mergeBranch']
    'github/rebaseBranch': TypertRemoteNamespace$676974687562['rebaseBranch']
    'github/abortMerge': TypertRemoteNamespace$676974687562['abortMerge']
    'github/abortRebase': TypertRemoteNamespace$676974687562['abortRebase']
    'github/continueMerge': TypertRemoteNamespace$676974687562['continueMerge']
    'github/continueRebase': TypertRemoteNamespace$676974687562['continueRebase']
    'github/checkoutCommit': TypertRemoteNamespace$676974687562['checkoutCommit']
    'github/getRepositoryOverview': TypertRemoteNamespace$676974687562['getRepositoryOverview']
    'github/log': TypertRemoteNamespace$676974687562['log']
    'github/showCommit': TypertRemoteNamespace$676974687562['showCommit']
    'github/showCommitDiff': TypertRemoteNamespace$676974687562['showCommitDiff']
    'github/stashList': TypertRemoteNamespace$676974687562['stashList']
    'github/stashCreate': TypertRemoteNamespace$676974687562['stashCreate']
    'github/stashApply': TypertRemoteNamespace$676974687562['stashApply']
    'github/stashDrop': TypertRemoteNamespace$676974687562['stashDrop']
    'github/stashDiff': TypertRemoteNamespace$676974687562['stashDiff']
    'github/tagList': TypertRemoteNamespace$676974687562['tagList']
    'github/tagCreate': TypertRemoteNamespace$676974687562['tagCreate']
    'github/tagDelete': TypertRemoteNamespace$676974687562['tagDelete']
    'github/pushTags': TypertRemoteNamespace$676974687562['pushTags']
    'github/remoteList': TypertRemoteNamespace$676974687562['remoteList']
    'github/remoteAdd': TypertRemoteNamespace$676974687562['remoteAdd']
    'github/remoteRemove': TypertRemoteNamespace$676974687562['remoteRemove']
    'github/getOutput': TypertRemoteNamespace$676974687562['getOutput']
  }
  interface TypertRemoteNamespaceMap { github: TypertRemoteNamespace$676974687562 }
}
