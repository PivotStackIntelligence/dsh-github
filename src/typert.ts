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
      { kind: 'method', name: 'commit', signature: 'commit(path: string, message: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'push', signature: 'push(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'fetch', signature: 'fetch(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'pull', signature: 'pull(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'sync', signature: 'sync(path: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'checkoutBranch', signature: 'checkoutBranch(path: string, branch: string, remote: boolean, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'createBranch', signature: 'createBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus>' },
      { kind: 'method', name: 'getRepositoryOverview', signature: 'getRepositoryOverview(path: string, signal?: AbortSignal): Promise<GitRepositoryOverview>' },
    ], types: [] }], events: [], objects: [],
  },
  invocations: DSH_GITHUB_INVOCATIONS,
}
