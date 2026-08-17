// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SourceControlOverlayPanel, SourceControlToggle, closeSourceControlPanel, registerSourceControlToggle, toggleSourceControlPanel } from '../src/client/source-control.tsx'
import type { GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { GitCommitDetail, GitDiff, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../src/types.ts'

// The runtime value `workspaceTitleOf` is the only value import from the
// browser-only client-runtime bundle (the rest are erased type imports). Mock
// it so the test environment never loads the browser module loader.
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

function sessionSummary(id: string, cwd?: string, displayTitle?: string): SessionSummary {
  return { id: id as SessionId, displayTitle: displayTitle ?? 'Session', cwd, running: false, blank: false, updatedAt: 0 }
}

function sessionState(current: SessionId | undefined, summaries: SessionSummary[]): SessionListState {
  const byId = {} as Record<SessionId, SessionSummary>
  for (const summary of summaries) byId[summary.id] = summary
  return {
    ids: summaries.map(summary => summary.id),
    byId,
    current,
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

async function mountToggle() {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  await act(async () => { root.render(<SourceControlToggle t={t} />) })
  await flush()
  return { mount, root }
}

async function mountOverlay(mock: SessionsMock, actions: GithubPanelActions) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  const useSessions = makeUseSessions(mock)
  await act(async () => { root.render(<SourceControlOverlayPanel actions={actions} t={t} useSessions={useSessions} />) })
  await flush()
  return { mount, root, useSessions }
}

beforeEach(() => {
  registerSourceControlToggle(null)
  closeSourceControlPanel()
})
afterEach(() => { document.body.replaceChildren() })

describe('SourceControlToggle', () => {
  it('toggles aria-pressed on click', async () => {
    const { mount } = await mountToggle()
    const button = mount.querySelector<HTMLButtonElement>('.dsh-github-header-action')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-pressed')).toBe('false')

    act(() => { button?.click() })
    expect(button?.getAttribute('aria-pressed')).toBe('true')

    act(() => { button?.click() })
    expect(button?.getAttribute('aria-pressed')).toBe('false')
  })

  it('returns focus to the toggle button on close', async () => {
    const { mount } = await mountToggle()
    const button = mount.querySelector<HTMLButtonElement>('.dsh-github-header-action')
    act(() => { button?.click() })
    expect(button?.getAttribute('aria-pressed')).toBe('true')

    act(() => { closeSourceControlPanel() })
    expect(document.activeElement).toBe(button)
  })
})

describe('SourceControlOverlayPanel', () => {
  it('renders null when the panel is closed', async () => {
    const sessions = makeSessions(sessionState('s1' as SessionId, [sessionSummary('s1', '/repo')]))
    const { mount } = await mountOverlay(sessions, makeActions())
    expect(mount.firstChild).toBeNull()
  })

  it('mounts the panel bound to the session cwd when open', async () => {
    const sessions = makeSessions(sessionState('s1' as SessionId, [sessionSummary('s1', '/repo', 'My Repo')]))
    const actions = makeActions()
    const { mount } = await mountOverlay(sessions, actions)

    act(() => { toggleSourceControlPanel() })
    await flush()

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/repo', expect.any(AbortSignal))
    expect(mount.textContent).toContain('My Repo')
  })

  it('shows the no-session-cwd hint when the session has no cwd', async () => {
    const sessions = makeSessions(sessionState('s1' as SessionId, [sessionSummary('s1')]))
    const actions = makeActions()
    const { mount } = await mountOverlay(sessions, actions)

    act(() => { toggleSourceControlPanel() })
    await flush()

    expect(mount.querySelector('.dsh-github-overlay-empty')).not.toBeNull()
    expect(mount.textContent).toContain('The current session has no workspace path.')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('shows the no-session-cwd hint when there is no current session', async () => {
    const sessions = makeSessions(sessionState(undefined, []))
    const actions = makeActions()
    const { mount } = await mountOverlay(sessions, actions)

    act(() => { toggleSourceControlPanel() })
    await flush()

    expect(mount.querySelector('.dsh-github-overlay-empty')).not.toBeNull()
    expect(mount.textContent).toContain('The current session has no workspace path.')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('closes on the overlay close button', async () => {
    const sessions = makeSessions(sessionState(undefined, []))
    const { mount } = await mountOverlay(sessions, makeActions())

    act(() => { toggleSourceControlPanel() })
    await flush()
    expect(mount.querySelector('.dsh-github-overlay-empty')).not.toBeNull()

    const closeButton = mount.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    expect(closeButton).not.toBeNull()
    act(() => { closeButton?.click() })
    await flush()

    expect(mount.firstChild).toBeNull()
  })

  it('coordinates the toggle and overlay through the shared store', async () => {
    const sessions = makeSessions(sessionState('s1' as SessionId, [sessionSummary('s1', '/repo')]))
    const actions = makeActions()
    const toggleMount = document.createElement('div')
    const overlayMount = document.createElement('div')
    document.body.appendChild(toggleMount)
    document.body.appendChild(overlayMount)
    const toggleRoot = createRoot(toggleMount)
    const overlayRoot = createRoot(overlayMount)
    const useSessions = makeUseSessions(sessions)

    await act(async () => {
      toggleRoot.render(<SourceControlToggle t={t} />)
      overlayRoot.render(<SourceControlOverlayPanel actions={actions} t={t} useSessions={useSessions} />)
    })
    await flush()

    expect(overlayMount.querySelector('.dsh-github-panel')).toBeNull()

    const toggleButton = toggleMount.querySelector<HTMLButtonElement>('.dsh-github-header-action')
    act(() => { toggleButton?.click() })
    await flush()

    expect(toggleButton?.getAttribute('aria-pressed')).toBe('true')
    expect(overlayMount.querySelector('.dsh-github-panel')).not.toBeNull()
  })
})
