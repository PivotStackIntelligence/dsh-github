import { describe, expect, it } from 'vitest'
import {
  branchNameSchema, commitDetailResultSchema, commitMessageSchema, diffModeSchema, diffResultSchema,
  DSH_GITHUB_INVOCATIONS, filePathSchema, logResultSchema, outputResultSchema, overviewResultSchema,
  pathSchema, remoteListResultSchema, stashListResultSchema, statusResultSchema, tagListResultSchema,
} from '../src/contract.ts'
import { DSH_GITHUB_REMOTE } from '../src/client/remote.ts'
import { TYPERT_MANIFEST } from '../src/typert.ts'

describe('dsh-github wire contract', () => {
  it('shares the final 44-endpoint contract between host and client', () => {
    expect(DSH_GITHUB_INVOCATIONS).toHaveLength(44)
    expect(TYPERT_MANIFEST.invocations).toBe(DSH_GITHUB_INVOCATIONS)
    expect(DSH_GITHUB_REMOTE.descriptors).toBe(DSH_GITHUB_INVOCATIONS)
    expect(DSH_GITHUB_INVOCATIONS.map(item => item.id)).toEqual([
      'dsh-github#github/getStatus',
      'dsh-github#github/getDiff',
      'dsh-github#github/stage',
      'dsh-github#github/unstage',
      'dsh-github#github/stageAll',
      'dsh-github#github/unstageAll',
      'dsh-github#github/discard',
      'dsh-github#github/discardAll',
      'dsh-github#github/commit',
      'dsh-github#github/undoLastCommit',
      'dsh-github#github/resolveConflict',
      'dsh-github#github/push',
      'dsh-github#github/fetch',
      'dsh-github#github/pull',
      'dsh-github#github/sync',
      'dsh-github#github/checkoutBranch',
      'dsh-github#github/createBranch',
      'dsh-github#github/createBranchFrom',
      'dsh-github#github/branchRename',
      'dsh-github#github/branchDelete',
      'dsh-github#github/mergeBranch',
      'dsh-github#github/rebaseBranch',
      'dsh-github#github/abortMerge',
      'dsh-github#github/abortRebase',
      'dsh-github#github/continueMerge',
      'dsh-github#github/continueRebase',
      'dsh-github#github/checkoutCommit',
      'dsh-github#github/getRepositoryOverview',
      'dsh-github#github/log',
      'dsh-github#github/showCommit',
      'dsh-github#github/showCommitDiff',
      'dsh-github#github/stashList',
      'dsh-github#github/stashCreate',
      'dsh-github#github/stashApply',
      'dsh-github#github/stashDrop',
      'dsh-github#github/stashDiff',
      'dsh-github#github/tagList',
      'dsh-github#github/tagCreate',
      'dsh-github#github/tagDelete',
      'dsh-github#github/pushTags',
      'dsh-github#github/remoteList',
      'dsh-github#github/remoteAdd',
      'dsh-github#github/remoteRemove',
      'dsh-github#github/getOutput',
    ])
  })

  it('validates primitive wire values and rejects unsafe input', () => {
    expect(pathSchema.parse('/tmp/workspace')).toBe('/tmp/workspace')
    expect(filePathSchema.parse('src/index.ts')).toBe('src/index.ts')
    expect(diffModeSchema.parse('staged')).toBe('staged')
    expect(commitMessageSchema.parse('  message  ')).toBe('message')
    expect(branchNameSchema.parse('feature/source-control')).toBe('feature/source-control')
    expect(() => pathSchema.parse('')).toThrow()
    expect(() => filePathSchema.parse('')).toThrow()
    expect(() => diffModeSchema.parse('both')).toThrow()
    expect(() => branchNameSchema.parse('   ')).toThrow()
    expect(() => commitMessageSchema.parse('   ')).toThrow()
    expect(() => branchNameSchema.parse('x'.repeat(256))).toThrow()
  })

  it('validates every projection schema happy path', () => {
    expect(statusResultSchema.parse({
      root: '/tmp/repo', branch: 'main', upstream: 'origin/main', remoteName: 'origin', ahead: 2, behind: 1,
      remoteUrl: 'https://github.com/owner/repo.git', headSha: 'abc123', commitUrl: 'https://github.com/owner/repo/commit/abc123',
      githubUrl: 'https://github.com/owner/repo', pushRemoteName: 'origin', pushRemoteUrl: 'https://github.com/owner/repo.git',
      mergeState: 'merge', files: [
        { path: 'README.md', index: ' ', worktree: 'M', kind: 'modified', previousPath: null, fileUrl: 'https://github.com/owner/repo/blob/abc123/README.md' },
        { path: 'renamed.md', index: 'R', worktree: ' ', kind: 'renamed', previousPath: 'README.md', fileUrl: null },
        { path: 'conflict.txt', index: 'U', worktree: 'U', kind: 'conflict', previousPath: null, fileUrl: null },
      ], truncated: false,
    }).files).toHaveLength(3)

    expect(statusResultSchema.parse({
      root: '/tmp/repo', branch: 'main', upstream: null, remoteName: null, ahead: 0, behind: 0,
      remoteUrl: null, headSha: null, commitUrl: null, githubUrl: null, pushRemoteName: null, pushRemoteUrl: null,
      mergeState: null, files: [], truncated: false,
    }).mergeState).toBeNull()

    expect(diffResultSchema.parse({ path: 'src/index.ts', diff: '--- a\n+++ b\n', truncated: false }).diff).toBe('--- a\n+++ b\n')
    expect(diffResultSchema.parse({ path: 'src/index.ts', diff: '', truncated: true }).truncated).toBe(true)

    expect(overviewResultSchema.parse({
      branches: [{ name: 'main', current: true, remote: false, upstream: 'origin/main', branchUrl: 'https://github.com/owner/repo/tree/main' }],
      remoteName: 'origin', githubUrl: 'https://github.com/owner/repo', compareUrl: 'https://github.com/owner/repo/compare/main...feature?expand=1',
    }).branches[0]?.branchUrl).toBe('https://github.com/owner/repo/tree/main')

    expect(logResultSchema.parse({
      commits: [{ sha: 'abc123', shortSha: 'abc1234', subject: 'fix bug', author: 'A', email: 'a@b.c', date: '2026-01-01T00:00:00Z', refs: ['main', 'v1'] }],
      truncated: false,
    }).commits[0]?.refs).toEqual(['main', 'v1'])

    expect(commitDetailResultSchema.parse({
      sha: 'abc123', shortSha: 'abc1234', subject: 'rename file', body: 'details', author: 'A', email: 'a@b.c',
      date: '2026-01-01T00:00:00Z', refs: ['main', 'v1'],
      files: [{ path: 'b.txt', status: 'renamed', previousPath: 'a.txt' }], truncated: false,
    }).files[0]?.previousPath).toBe('a.txt')

    expect(stashListResultSchema.parse({
      stashes: [{ ref: 'stash@{0}', sha: 'abc123', date: '2026-01-01T00:00:00Z', message: 'On main: wip' }],
    }).stashes[0]?.ref).toBe('stash@{0}')

    expect(tagListResultSchema.parse({
      tags: [{ name: 'v1', sha: 'abc1234', subject: 'version one' }, { name: 'v2', sha: 'def5678', subject: '' }],
    }).tags[1]?.subject).toBe('')

    expect(remoteListResultSchema.parse({
      remotes: [{ name: 'origin', fetchUrl: 'https://github.com/owner/repo.git', pushUrl: 'https://github.com/owner/repo.git' }],
    }).remotes[0]?.fetchUrl).toBe('https://github.com/owner/repo.git')

    expect(outputResultSchema.parse({
      entries: [{ command: 'git', args: ['status'], ok: true, output: 'ok', at: '2026-01-01T00:00:00Z' }],
    }).entries[0]?.ok).toBe(true)
  })
})
