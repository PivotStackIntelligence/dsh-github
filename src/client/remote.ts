import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { GitDiff, GitDiffMode, GitRepositoryOverview, GitStatus } from '../types.ts'
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
    commit: (path: string, message: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    push: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    fetch: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    pull: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    sync: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    checkoutBranch: (path: string, branch: string, remote: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    createBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
    getRepositoryOverview: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRepositoryOverview>>
  }
  interface TypertRemoteMap {
    'github/getStatus': TypertRemoteNamespace$676974687562['getStatus']
    'github/getDiff': TypertRemoteNamespace$676974687562['getDiff']
    'github/stage': TypertRemoteNamespace$676974687562['stage']
    'github/unstage': TypertRemoteNamespace$676974687562['unstage']
    'github/stageAll': TypertRemoteNamespace$676974687562['stageAll']
    'github/unstageAll': TypertRemoteNamespace$676974687562['unstageAll']
    'github/commit': TypertRemoteNamespace$676974687562['commit']
    'github/push': TypertRemoteNamespace$676974687562['push']
    'github/fetch': TypertRemoteNamespace$676974687562['fetch']
    'github/pull': TypertRemoteNamespace$676974687562['pull']
    'github/sync': TypertRemoteNamespace$676974687562['sync']
    'github/checkoutBranch': TypertRemoteNamespace$676974687562['checkoutBranch']
    'github/createBranch': TypertRemoteNamespace$676974687562['createBranch']
    'github/getRepositoryOverview': TypertRemoteNamespace$676974687562['getRepositoryOverview']
  }
  interface TypertRemoteNamespaceMap { github: TypertRemoteNamespace$676974687562 }
}
