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
/** Wire codec for a conflict resolution strategy. */
export const conflictStrategySchema = z.enum(['ours', 'theirs', 'both'])
/** Wire codec for a stash reference such as stash@{0}. */
export const stashRefSchema = z.string().trim().min(1).max(255)
/** Wire codec for a tag name validated again by Git before use. */
export const tagNameSchema = z.string().trim().min(1).max(255)
/** Wire codec for a remote name. */
export const remoteNameSchema = z.string().trim().min(1).max(255)
/** Wire codec for a remote URL. */
export const remoteUrlSchema = z.string().trim().min(1).max(2_000)
/** Wire codec for a history search query; empty matches everything. */
export const logQuerySchema = z.string().max(500)
/** Wire codec for a commit SHA. */
export const shaSchema = z.string().trim().min(4).max(64)
/** Wire codec for an optional tag message. */
export const tagMessageSchema = z.string().max(10_000)

const fileChangeSchema = z.object({
  path: z.string(), index: z.string(), worktree: z.string(),
  kind: z.enum(['untracked', 'added', 'deleted', 'renamed', 'copied', 'conflict', 'modified']),
  previousPath: z.string().nullable(), fileUrl: z.string().nullable(),
}).readonly()

/** Wire codec for the repository status projection. */
export const statusResultSchema = z.object({
  root: z.string(), branch: z.string(), upstream: z.string().nullable(), remoteName: z.string().nullable(),
  ahead: z.number(), behind: z.number(), remoteUrl: z.string().nullable(), headSha: z.string().nullable(), commitUrl: z.string().nullable(),
  githubUrl: z.string().nullable(), pushRemoteName: z.string().nullable(), pushRemoteUrl: z.string().nullable(),
  mergeState: z.enum(['merge', 'rebase']).nullable(), files: z.array(fileChangeSchema), truncated: z.boolean(),
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

const commitSummarySchema = z.object({
  sha: z.string(), shortSha: z.string(), subject: z.string(), author: z.string(), email: z.string(), date: z.string(), refs: z.array(z.string()),
}).readonly()

/** Wire codec for the capped commit history projection. */
export const logResultSchema = z.object({ commits: z.array(commitSummarySchema), truncated: z.boolean() }).readonly()

const commitFileSchema = z.object({
  path: z.string(), status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied']), previousPath: z.string().nullable(),
}).readonly()

/** Wire codec for one commit's detail projection. */
export const commitDetailResultSchema = z.object({
  sha: z.string(), shortSha: z.string(), subject: z.string(), body: z.string(), author: z.string(), email: z.string(),
  date: z.string(), refs: z.array(z.string()), files: z.array(commitFileSchema), truncated: z.boolean(),
}).readonly()

const stashSchema = z.object({ ref: z.string(), sha: z.string(), date: z.string(), message: z.string() }).readonly()

/** Wire codec for the stash list projection. */
export const stashListResultSchema = z.object({ stashes: z.array(stashSchema) }).readonly()

const tagSchema = z.object({ name: z.string(), sha: z.string(), subject: z.string() }).readonly()

/** Wire codec for the tag list projection. */
export const tagListResultSchema = z.object({ tags: z.array(tagSchema) }).readonly()

const remoteSchema = z.object({ name: z.string(), fetchUrl: z.string(), pushUrl: z.string() }).readonly()

/** Wire codec for the remote list projection. */
export const remoteListResultSchema = z.object({ remotes: z.array(remoteSchema) }).readonly()

const outputEntrySchema = z.object({
  command: z.string(), args: z.array(z.string()), ok: z.boolean(), output: z.string(), at: z.string(),
}).readonly()

/** Wire codec for the bounded Git command output buffer. */
export const outputResultSchema = z.object({ entries: z.array(outputEntrySchema) }).readonly()

const json = (name: string, wire: string, typeSymbol: string, schema: z.ZodType) => ({
  name, wire, source: 'json' as const, codec: { mode: 'strict' as const, typeSymbol, schema },
})
const resultOf = (typeSymbol: string, schema: z.ZodType) => ({ mode: 'strict' as const, typeSymbol, schema })

const pathParameter = json('path', 'path', 'dsh-github#Path', pathSchema)
const filePathParameter = json('filePath', 'filePath', 'dsh-github#FilePath', filePathSchema)
const branchParameter = json('branch', 'branch', 'dsh-github#BranchName', branchNameSchema)
const statusResult = resultOf('dsh-github#GitStatus', statusResultSchema)
const diffResult = resultOf('dsh-github#GitDiff', diffResultSchema)

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
      filePathParameter,
      json('mode', 'mode', 'dsh-github#GitDiffMode', diffModeSchema),
    ],
    cancellation: { parameter: 'signal' }, result: diffResult,
  },
  {
    id: 'dsh-github#github/stage', service: 'github', namespace: 'github', method: 'stage', invocation: { kind: 'direct' },
    parameters: [pathParameter, filePathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/unstage', service: 'github', namespace: 'github', method: 'unstage', invocation: { kind: 'direct' },
    parameters: [pathParameter, filePathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
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
    id: 'dsh-github#github/discard', service: 'github', namespace: 'github', method: 'discard', invocation: { kind: 'direct' },
    parameters: [pathParameter, filePathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/discardAll', service: 'github', namespace: 'github', method: 'discardAll', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('includeUntracked', 'includeUntracked', 'dsh-github#IncludeUntracked', z.boolean())],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/commit', service: 'github', namespace: 'github', method: 'commit', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      json('message', 'message', 'dsh-github#CommitMessage', commitMessageSchema),
      json('amend', 'amend', 'dsh-github#Amend', z.boolean()),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/undoLastCommit', service: 'github', namespace: 'github', method: 'undoLastCommit', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/resolveConflict', service: 'github', namespace: 'github', method: 'resolveConflict', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      filePathParameter,
      json('strategy', 'strategy', 'dsh-github#GitConflictStrategy', conflictStrategySchema),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/push', service: 'github', namespace: 'github', method: 'push', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/fetch', service: 'github', namespace: 'github', method: 'fetch', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      json('remoteName', 'remoteName', 'dsh-github#RemoteName', z.string().max(255)),
      json('all', 'all', 'dsh-github#FetchAll', z.boolean()),
      json('prune', 'prune', 'dsh-github#FetchPrune', z.boolean()),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
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
    parameters: [pathParameter, branchParameter, json('remote', 'remote', 'dsh-github#RemoteBranch', z.boolean())],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/createBranch', service: 'github', namespace: 'github', method: 'createBranch', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/createBranchFrom', service: 'github', namespace: 'github', method: 'createBranchFrom', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter, json('sha', 'sha', 'dsh-github#CommitSha', shaSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/branchRename', service: 'github', namespace: 'github', method: 'branchRename', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('oldName', 'oldName', 'dsh-github#BranchName', branchNameSchema), json('newName', 'newName', 'dsh-github#BranchName', branchNameSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/branchDelete', service: 'github', namespace: 'github', method: 'branchDelete', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/mergeBranch', service: 'github', namespace: 'github', method: 'mergeBranch', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/rebaseBranch', service: 'github', namespace: 'github', method: 'rebaseBranch', invocation: { kind: 'direct' },
    parameters: [pathParameter, branchParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/abortMerge', service: 'github', namespace: 'github', method: 'abortMerge', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/abortRebase', service: 'github', namespace: 'github', method: 'abortRebase', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/continueMerge', service: 'github', namespace: 'github', method: 'continueMerge', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/continueRebase', service: 'github', namespace: 'github', method: 'continueRebase', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/checkoutCommit', service: 'github', namespace: 'github', method: 'checkoutCommit', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('sha', 'sha', 'dsh-github#CommitSha', shaSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/getRepositoryOverview', service: 'github', namespace: 'github', method: 'getRepositoryOverview', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' },
    result: resultOf('dsh-github#GitRepositoryOverview', overviewResultSchema),
  },
  {
    id: 'dsh-github#github/log', service: 'github', namespace: 'github', method: 'log', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('query', 'query', 'dsh-github#LogQuery', logQuerySchema)],
    cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitLog', logResultSchema),
  },
  {
    id: 'dsh-github#github/showCommit', service: 'github', namespace: 'github', method: 'showCommit', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('sha', 'sha', 'dsh-github#CommitSha', shaSchema)],
    cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitCommitDetail', commitDetailResultSchema),
  },
  {
    id: 'dsh-github#github/showCommitDiff', service: 'github', namespace: 'github', method: 'showCommitDiff', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('sha', 'sha', 'dsh-github#CommitSha', shaSchema), filePathParameter],
    cancellation: { parameter: 'signal' }, result: diffResult,
  },
  {
    id: 'dsh-github#github/stashList', service: 'github', namespace: 'github', method: 'stashList', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitStashList', stashListResultSchema),
  },
  {
    id: 'dsh-github#github/stashCreate', service: 'github', namespace: 'github', method: 'stashCreate', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      json('message', 'message', 'dsh-github#StashMessage', z.string().max(10_000)),
      json('includeUntracked', 'includeUntracked', 'dsh-github#IncludeUntracked', z.boolean()),
      json('keepIndex', 'keepIndex', 'dsh-github#KeepIndex', z.boolean()),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/stashApply', service: 'github', namespace: 'github', method: 'stashApply', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('ref', 'ref', 'dsh-github#StashRef', stashRefSchema), json('drop', 'drop', 'dsh-github#DropStash', z.boolean())],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/stashDrop', service: 'github', namespace: 'github', method: 'stashDrop', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('ref', 'ref', 'dsh-github#StashRef', stashRefSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/stashDiff', service: 'github', namespace: 'github', method: 'stashDiff', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('ref', 'ref', 'dsh-github#StashRef', stashRefSchema)],
    cancellation: { parameter: 'signal' }, result: diffResult,
  },
  {
    id: 'dsh-github#github/tagList', service: 'github', namespace: 'github', method: 'tagList', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitTagList', tagListResultSchema),
  },
  {
    id: 'dsh-github#github/tagCreate', service: 'github', namespace: 'github', method: 'tagCreate', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      json('name', 'name', 'dsh-github#TagName', tagNameSchema),
      json('message', 'message', 'dsh-github#TagMessage', tagMessageSchema),
      json('atRef', 'atRef', 'dsh-github#OptionalCommitSha', z.string().trim().max(64)),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/tagDelete', service: 'github', namespace: 'github', method: 'tagDelete', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('name', 'name', 'dsh-github#TagName', tagNameSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/pushTags', service: 'github', namespace: 'github', method: 'pushTags', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/remoteList', service: 'github', namespace: 'github', method: 'remoteList', invocation: { kind: 'direct' },
    parameters: [pathParameter], cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitRemoteList', remoteListResultSchema),
  },
  {
    id: 'dsh-github#github/remoteAdd', service: 'github', namespace: 'github', method: 'remoteAdd', invocation: { kind: 'direct' },
    parameters: [
      pathParameter,
      json('name', 'name', 'dsh-github#RemoteName', remoteNameSchema),
      json('url', 'url', 'dsh-github#RemoteUrl', remoteUrlSchema),
    ],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/remoteRemove', service: 'github', namespace: 'github', method: 'remoteRemove', invocation: { kind: 'direct' },
    parameters: [pathParameter, json('name', 'name', 'dsh-github#RemoteName', remoteNameSchema)],
    cancellation: { parameter: 'signal' }, result: statusResult,
  },
  {
    id: 'dsh-github#github/getOutput', service: 'github', namespace: 'github', method: 'getOutput', invocation: { kind: 'direct' },
    parameters: [], cancellation: { parameter: 'signal' }, result: resultOf('dsh-github#GitOutput', outputResultSchema),
  },
]
