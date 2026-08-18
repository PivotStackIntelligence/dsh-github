// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourceControlView } from '../src/client/view.tsx'
import type { GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { GitCommitDetail, GitDiff, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../src/types.ts'

// `workspaceTitleOf` is the only value import from the browser-only
// client-runtime bundle (the rest are erased type imports). Mock it so the
// test environment never loads the browser module loader.
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  workspaceTitleOf: (cwd: string): string => cwd.split(/[\\/]/).filter(Boolean).pop() ?? '',
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const t = (key: DshGithubKey, params?: Record<string, string>) => params === undefined ? en[key] : fmt(en[key], params)
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

const status: GitStatus = {
  root: '/repo', branch: 'main', upstream: null, ahead: 0, behind: 0,
  remoteName: null, remoteUrl: null, githubUrl: null, pushRemoteName: null, pushRemoteUrl: null,
  headSha: 'abc123', commitUrl: null, mergeState: null, truncated: false, files: [],
}

const emptyOverview: GitRepositoryOverview = { branches: [], remoteName: null, githubUrl: null, compareUrl: null }
const emptyLog: GitLog = { commits: [], truncated: false }
const emptyRemoteList: GitRemoteList = { remotes: [] }
const emptyTagList: GitTagList = { tags: [] }
const emptyStashList: GitStashList = { stashes: [] }
const emptyOutput: GitOutput = { entries: [] }
const emptyDiff: GitDiff = { path: '', diff: '', truncated: false }
const emptyCommitDetail: GitCommitDetail = {
  sha: '', shortSha: '', subject: '', body: '', author: '', email: '', date: '', refs: [], files: [], truncated: false,
}

function makeActions(overrides: Partial<GithubPanelActions> = {}): GithubPanelActions {
  return {
    getStatus: vi.fn(() => ok(status)),
    getDiff: vi.fn(() => ok(emptyDiff)),
    stage: vi.fn(() => ok(status)),
    unstage: vi.fn(() => ok(status)),
    stageAll: vi.fn(() => ok(status)),
    unstageAll: vi.fn(() => ok(status)),
    discard: vi.fn(() => ok(status)),
    discardAll: vi.fn(() => ok(status)),
    commit: vi.fn(() => ok(status)),
    undoLastCommit: vi.fn(() => ok(status)),
    resolveConflict: vi.fn(() => ok(status)),
    push: vi.fn(() => ok(status)),
    fetch: vi.fn(() => ok(status)),
    pull: vi.fn(() => ok(status)),
    sync: vi.fn(() => ok(status)),
    checkoutBranch: vi.fn(() => ok(status)),
    createBranch: vi.fn(() => ok(status)),
    createBranchFrom: vi.fn(() => ok(status)),
    branchRename: vi.fn(() => ok(status)),
    branchDelete: vi.fn(() => ok(status)),
    mergeBranch: vi.fn(() => ok(status)),
    rebaseBranch: vi.fn(() => ok(status)),
    abortMerge: vi.fn(() => ok(status)),
    abortRebase: vi.fn(() => ok(status)),
    continueMerge: vi.fn(() => ok(status)),
    continueRebase: vi.fn(() => ok(status)),
    checkoutCommit: vi.fn(() => ok(status)),
    getRepositoryOverview: vi.fn(() => ok(emptyOverview)),
    log: vi.fn(() => ok(emptyLog)),
    showCommit: vi.fn(() => ok(emptyCommitDetail)),
    showCommitDiff: vi.fn(() => ok(emptyDiff)),
    stashList: vi.fn(() => ok(emptyStashList)),
    stashCreate: vi.fn(() => ok(status)),
    stashApply: vi.fn(() => ok(status)),
    stashDrop: vi.fn(() => ok(status)),
    stashDiff: vi.fn(() => ok(emptyDiff)),
    tagList: vi.fn(() => ok(emptyTagList)),
    tagCreate: vi.fn(() => ok(status)),
    tagDelete: vi.fn(() => ok(status)),
    pushTags: vi.fn(() => ok(status)),
    remoteList: vi.fn(() => ok(emptyRemoteList)),
    remoteAdd: vi.fn(() => ok(status)),
    remoteRemove: vi.fn(() => ok(status)),
    getOutput: vi.fn(() => ok(emptyOutput)),
    openFile: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

function summary(id: string, cwd?: string, displayTitle = 'Session'): SessionSummary {
  return { id: id as SessionId, displayTitle, cwd, running: false, blank: false, updatedAt: 0 }
}

function sessionState(summaries: SessionSummary[]): SessionListState {
  const byId = {} as Record<SessionId, SessionSummary>
  for (const entry of summaries) byId[entry.id] = entry
  return {
    ids: summaries.map(entry => entry.id),
    byId,
    current: summaries[0]?.id,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

/** A writable test double of the sessions store. */
interface SessionsMock {
  getSnapshot(): SessionListState
  subscribe(fn: () => void): () => void
  setState(next: SessionListState): void
}

function makeSessions(initial: SessionListState): SessionsMock {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    setState: (next: SessionListState) => { state = next; for (const fn of listeners) fn() },
  }
}

/** A fake useSessions hook backed by the SessionsMock, re-rendering on subscribe. */
function makeUseSessions(mock: SessionsMock): SnapshotSelectorHook<SessionListState> {
  const subscribe = (onStoreChange: () => void) => mock.subscribe(onStoreChange)
  const getSnapshot = () => mock.getSnapshot()
  return <S,>(selector: (state: SessionListState) => S): S => {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    return selector(snapshot)
  }
}

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

const roots: ReturnType<typeof createRoot>[] = []

async function mountView(sessionId: SessionId, mock: SessionsMock, actions: GithubPanelActions) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  roots.push(root)
  const useSessions = makeUseSessions(mock)
  await act(async () => {
    root.render(<SourceControlView sessionId={sessionId} useSessions={useSessions} actions={actions} t={t} />)
  })
  await flush()
  return { mount, root, useSessions }
}

afterEach(() => {
  act(() => { for (const root of roots) root.unmount() })
  roots.length = 0
  document.body.replaceChildren()
})

describe('SourceControlView', () => {
  it('mounts the panel for the session cwd with its display title', async () => {
    const sessions = makeSessions(sessionState([summary('s1', '/p1', 'My Repo')]))
    const actions = makeActions()
    const { mount } = await mountView('s1' as SessionId, sessions, actions)

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
    expect(mount.querySelector('.dsh-github-panel-header strong')?.textContent).toBe('My Repo')
  })

  it('falls back to the workspace basename when displayTitle is empty', async () => {
    const sessions = makeSessions(sessionState([summary('s1', '/foo/bar/repo', '')]))
    const actions = makeActions()
    const { mount } = await mountView('s1' as SessionId, sessions, actions)

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/foo/bar/repo', expect.any(AbortSignal))
    expect(mount.querySelector('.dsh-github-panel-header strong')?.textContent).toBe('repo')
  })

  it('renders the no-session-cwd hint when the session has no cwd', async () => {
    const sessions = makeSessions(sessionState([summary('s1')]))
    const actions = makeActions()
    const { mount } = await mountView('s1' as SessionId, sessions, actions)

    expect(mount.querySelector('.dsh-github-view-empty')).not.toBeNull()
    expect(mount.textContent).toContain('The current session has no workspace path.')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('renders the no-session-cwd hint when the session is unknown', async () => {
    const sessions = makeSessions(sessionState([]))
    const { mount } = await mountView('missing' as SessionId, sessions, makeActions())

    expect(mount.querySelector('.dsh-github-view-empty')).not.toBeNull()
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('remounts the panel keyed by session when sessionId changes', async () => {
    const sessions = makeSessions(sessionState([summary('s1', '/p1'), summary('s2', '/p2')]))
    const actions = makeActions()
    const { root, useSessions } = await mountView('s1' as SessionId, sessions, actions)
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))

    await act(async () => {
      root.render(<SourceControlView sessionId={'s2' as SessionId} useSessions={useSessions} actions={actions} t={t} />)
    })
    await flush()

    expect(actions.getStatus).toHaveBeenCalledWith('/p2', expect.any(AbortSignal))
  })

  it('mounts the panel when the session cwd becomes available', async () => {
    const sessions = makeSessions(sessionState([summary('s1')]))
    const actions = makeActions()
    const { mount } = await mountView('s1' as SessionId, sessions, actions)
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()

    await act(async () => { sessions.setState(sessionState([summary('s1', '/p1')])) })
    await flush()

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })
})
