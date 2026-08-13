import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** Wire codec for an absolute workspace path. */
export const pathSchema = z.string().min(1)
/** Wire codec for a repository-relative file path. */
export const filePathSchema = z.string().min(1)
/** Wire codec for the requested side of the Git index. */
export const diffModeSchema = z.enum(['working', 'staged'])
/** Wire codec for a non-empty commit message. */
export const commitMessageSchema = z.string().trim().min(1).max(10_000)
/** Wire codec for a Git branch name validated again by Git before use. */
export const branchNameSchema = z.string().trim().min(1).max(255)

const fileChangeSchema = z.object({
  path: z.string(), index: z.string(), worktree: z.string(),
  kind: z.enum(['untracked', 'added', 'deleted', 'renamed', 'copied', 'conflict', 'modified']),
}).readonly()

/** Wire codec for the repository status projection. */
export const statusResultSchema = z.object({
  root: z.string(), branch: z.string(), upstream: z.string().nullable(), remoteName: z.string().nullable(),
  ahead: z.number(), behind: z.number(), remoteUrl: z.string().nullable(),
  githubUrl: z.string().nullable(), files: z.array(fileChangeSchema), truncated: z.boolean(),
}).readonly()

/** Wire codec for one bounded file diff. */
export const diffResultSchema = z.object({ path: z.string(), diff: z.string(), truncated: z.boolean() }).readonly()

const branchSchema = z.object({
  name: z.string(), current: z.boolean(), remote: z.boolean(), upstream: z.string().nullable(), branchUrl: z.string().nullable(),
}).readonly()

/** Wire codec for the repository branch and browser-link projection. */
export const overviewResultSchema = z.object({
  branches: z.array(branchSchema), remoteName: z.string().nullable(), githubUrl: z.string().nullable(), compareUrl: z.string().nullable(),
}).readonly()

const pathParameter = { name: 'path', wire: 'path', source: 'json' as const, codec: { mode: 'strict' as const, typeSymbol: 'dsh-github#Path', schema: pathSchema } }
const statusResult = { mode: 'strict' as const, typeSymbol: 'dsh-github#GitStatus', schema: statusResultSchema }
const branchParameter = { name: 'branch', wire: 'branch', source: 'json' as const, codec: { mode: 'strict' as const, typeSymbol: 'dsh-github#BranchName', schema: branchNameSchema } }

/** Strict Typert descriptors shared by the host and browser halves. */
export const DSH_GITHUB_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-github#github/getStatus', service: 'github', namespace: 'github', method: 'getStatus', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/getDiff', service: 'github', namespace: 'github', method: 'getDiff', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      { name: 'filePath', wire: 'filePath', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#FilePath', schema: filePathSchema } },
      { name: 'mode', wire: 'mode', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#GitDiffMode', schema: diffModeSchema } },
    ],
    cancellation: { parameter: 'signal' }, result: { mode: 'strict', typeSymbol: 'dsh-github#GitDiff', schema: diffResultSchema },
  },
  {
    id: 'dsh-github#github/stage', service: 'github', namespace: 'github', method: 'stage', invocation: { kind: 'direct' },
    parameters: [pathParameter, { name: 'filePath', wire: 'filePath', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#FilePath', schema: filePathSchema } }],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/unstage', service: 'github', namespace: 'github', method: 'unstage', invocation: { kind: 'direct' },
    parameters: [pathParameter, { name: 'filePath', wire: 'filePath', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#FilePath', schema: filePathSchema } }],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/stageAll', service: 'github', namespace: 'github', method: 'stageAll', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/unstageAll', service: 'github', namespace: 'github', method: 'unstageAll', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/commit', service: 'github', namespace: 'github', method: 'commit', invocation: { kind: 'direct' },
    parameters: [pathParameter, { name: 'message', wire: 'message', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#CommitMessage', schema: commitMessageSchema } }],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/push', service: 'github', namespace: 'github', method: 'push', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/fetch', service: 'github', namespace: 'github', method: 'fetch', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/pull', service: 'github', namespace: 'github', method: 'pull', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/sync', service: 'github', namespace: 'github', method: 'sync', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/checkoutBranch', service: 'github', namespace: 'github', method: 'checkoutBranch', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter, { name: 'remote', wire: 'remote', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-github#RemoteBranch', schema: z.boolean() } }],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/createBranch', service: 'github', namespace: 'github', method: 'createBranch', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/getRepositoryOverview', service: 'github', namespace: 'github', method: 'getRepositoryOverview', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: 'dsh-github#GitRepositoryOverview', schema: overviewResultSchema },
  },
]
