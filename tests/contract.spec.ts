import { describe, expect, it } from 'vitest'
import { branchNameSchema, commitMessageSchema, diffModeSchema, DSH_GITHUB_INVOCATIONS, diffResultSchema, filePathSchema, overviewResultSchema, pathSchema, statusResultSchema } from '../src/contract.ts'
import { DSH_GITHUB_REMOTE } from '../src/client/remote.ts'
import { TYPERT_MANIFEST } from '../src/typert.ts'

describe('dsh-github wire contract', () => {
  it('shares all endpoints between host and client', () => {
    expect(DSH_GITHUB_INVOCATIONS).toHaveLength(14)
    expect(TYPERT_MANIFEST.invocations).toBe(DSH_GITHUB_INVOCATIONS)
    expect(DSH_GITHUB_REMOTE.descriptors).toBe(DSH_GITHUB_INVOCATIONS)
    expect(DSH_GITHUB_INVOCATIONS.map(item => item.id)).toEqual([
      'dsh-github#github/getStatus', 'dsh-github#github/getDiff', 'dsh-github#github/stage',
      'dsh-github#github/unstage', 'dsh-github#github/stageAll', 'dsh-github#github/unstageAll',
      'dsh-github#github/commit', 'dsh-github#github/push', 'dsh-github#github/fetch',
      'dsh-github#github/pull', 'dsh-github#github/sync', 'dsh-github#github/checkoutBranch',
      'dsh-github#github/createBranch', 'dsh-github#github/getRepositoryOverview',
    ])
  })

  it('validates wire values and projections', () => {
    expect(pathSchema.parse('/tmp/workspace')).toBe('/tmp/workspace')
    expect(filePathSchema.parse('src/index.ts')).toBe('src/index.ts')
    expect(diffModeSchema.parse('staged')).toBe('staged')
    expect(commitMessageSchema.parse('  message  ')).toBe('message')
    expect(branchNameSchema.parse('feature/source-control')).toBe('feature/source-control')
    expect(() => branchNameSchema.parse('   ')).toThrow()
    expect(() => commitMessageSchema.parse('   ')).toThrow()
    expect(statusResultSchema.parse({ root: '/tmp/repo', branch: 'main', upstream: null, remoteName: null, ahead: 0, behind: 0, remoteUrl: null, headSha: 'abc123', commitUrl: null, githubUrl: null, pushRemoteName: 'origin', pushRemoteUrl: 'https://github.com/owner/repo.git', files: [], truncated: false }).pushRemoteName).toBe('origin')
    expect(statusResultSchema.parse({ root: '/tmp/repo', branch: 'main', upstream: null, remoteName: null, ahead: 0, behind: 0, remoteUrl: null, headSha: 'abc123', commitUrl: null, githubUrl: null, pushRemoteName: null, pushRemoteUrl: null, files: [{ path: 'README.md', index: ' ', worktree: 'M', kind: 'modified', previousPath: null, fileUrl: null }], truncated: false }).files[0]?.previousPath).toBeNull()
    expect(diffResultSchema.parse({ path: 'src/index.ts', diff: '', truncated: false }).path).toBe('src/index.ts')
    expect(overviewResultSchema.parse({ branches: [{ name: 'main', current: true, remote: false, upstream: null, branchUrl: 'https://github.com/owner/repo/tree/main' }], remoteName: null, githubUrl: 'https://github.com/owner/repo', compareUrl: null }).branches[0]?.branchUrl).toBe('https://github.com/owner/repo/tree/main')
  })
})
