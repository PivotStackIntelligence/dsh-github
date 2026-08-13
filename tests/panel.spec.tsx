// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GithubChangesPanel, type GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { GitRepositoryOverview, GitStatus } from '../src/types.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const status: GitStatus = {
  root: '/repo', branch: 'main', upstream: null, ahead: 0, behind: 0,
  remoteName: null, remoteUrl: null, githubUrl: null, pushRemoteName: null, pushRemoteUrl: null,
  headSha: 'abc', commitUrl: null, truncated: false,
  files: [
    { path: 'changed.ts', index: ' ', worktree: 'M', kind: 'modified', previousPath: null, fileUrl: null },
    { path: 'new.ts', index: '?', worktree: '?', kind: 'untracked', previousPath: null, fileUrl: null },
    { path: 'conflict.ts', index: 'U', worktree: 'U', kind: 'conflict', previousPath: null, fileUrl: null },
  ],
}

const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })
const actions: GithubPanelActions = {
  getStatus: vi.fn(() => ok(status)), getDiff: vi.fn(), stage: vi.fn(), unstage: vi.fn(),
  stageAll: vi.fn(), unstageAll: vi.fn(), commit: vi.fn(), push: vi.fn(), fetch: vi.fn(), pull: vi.fn(), sync: vi.fn(),
  checkoutBranch: vi.fn(), createBranch: vi.fn(), getRepositoryOverview: vi.fn(), openFile: vi.fn(),
}
const t = (key: DshGithubKey, params?: Record<string, string>) => params === undefined ? en[key] : fmt(en[key], params)

afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks() })

describe('GithubChangesPanel', () => {
  it('matches Source Control group actions for working, untracked, and resolved files', async () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const root = createRoot(mount)
    await act(async () => {
      root.render(<GithubChangesPanel path="/repo" title="repo" actions={actions} t={t} onClose={vi.fn()} />)
      await Promise.resolve()
    })

    expect(actions.getStatus).toHaveBeenCalledWith('/repo', expect.any(AbortSignal))
    expect([...mount.querySelectorAll('button')].filter(button => button.textContent === 'Stage All')).toHaveLength(1)
    expect(mount.querySelector('button[aria-label="Stage resolved change"]')).not.toBeNull()

    await act(async () => root.unmount())
  })

  it('shows fetched pull-request refs as browser links instead of checkout actions', async () => {
    const overview: GitRepositoryOverview = {
      remoteName: 'origin', githubUrl: 'https://github.com/owner/repo', compareUrl: 'https://github.com/owner/repo/compare/main...feature?expand=1',
      branches: [
        { name: 'main', current: true, remote: false, upstream: 'origin/main', branchUrl: 'https://github.com/owner/repo/tree/main' },
        { name: 'feature', current: false, remote: true, upstream: null, branchUrl: 'https://github.com/owner/repo/tree/feature' },
        { name: 'pr/42/head', current: false, remote: true, upstream: null, branchUrl: 'https://github.com/owner/repo/pull/42' },
      ],
    }
    vi.mocked(actions.getRepositoryOverview).mockImplementation(() => ok(overview))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const root = createRoot(mount)
    await act(async () => {
      root.render(<GithubChangesPanel path="/repo" title="repo" actions={actions} t={t} onClose={vi.fn()} />)
      await Promise.resolve()
    })
    await act(async () => {
      ;([...mount.querySelectorAll('button')].find(button => button.textContent === 'Repository') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(mount.textContent).toContain('Pull request branches')
    expect(mount.textContent).toContain('Pull Request #42')
    expect(mount.querySelector('a[href="https://github.com/owner/repo/pull/42"]')).not.toBeNull()
    expect([...mount.querySelectorAll('button')].some(button => button.textContent?.includes('Pull Request #42'))).toBe(false)
    expect(actions.checkoutBranch).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

})
