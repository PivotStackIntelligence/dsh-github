// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SourceControlSidebar } from '../src/client/sidebar.tsx'
import type { GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { ObservableSnapshot, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { GitCommitDetail, GitDiff, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../src/types.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const t = (key: DshGithubKey, params?: Record<string, string>) => params === undefined ? en[key] : fmt(en[key], params)
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

const EXPANDED_KEY = 'dsh-github.sidebar.expanded'
const WORKSPACE_KEY = 'dsh-github.sidebar.workspaceId'

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

const ws = (id: string, path: string, title = path): WorkspaceView => ({
  workspaceId: id as WorkspaceId,
  path,
  title,
  sessionIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

function listState(items: WorkspaceView[], recentWorkspaceId?: WorkspaceId): WorkspaceListState {
  return {
    items,
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId,
  }
}

/** A writable test double of the workspaces ObservableSnapshot. */
interface ListMock extends ObservableSnapshot<WorkspaceListState> {
  setState(next: WorkspaceListState): void
}

function makeList(initial: WorkspaceListState): ListMock {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    setState: (next: WorkspaceListState) => { state = next; for (const fn of listeners) fn() },
  }
}

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

async function mountSidebar(list: ObservableSnapshot<WorkspaceListState>, actions: GithubPanelActions) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  await act(async () => { root.render(<SourceControlSidebar actions={actions} t={t} list={list} />) })
  await flush()
  return { mount, root }
}

function setSelectValue(el: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  if (setter === undefined) throw new Error('no select value setter')
  setter.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => { store.clear() },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key) },
    setItem: (key: string, value: string) => { store.set(key, String(value)) },
  }
}

beforeEach(() => { vi.stubGlobal('localStorage', createStorage()) })
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })

describe('SourceControlSidebar', () => {
  it('renders a persistent rail that expands into the panel for the default workspace', async () => {
    const list = makeList(listState([ws('ws-1', '/p1', 'one'), ws('ws-2', '/p2', 'two')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    const rail = mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')
    expect(rail).not.toBeNull()
    expect(rail?.getAttribute('aria-expanded')).toBe('false')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()

    await act(async () => { rail?.click() })
    await flush()

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })

  it('prefers the recent workspace when nothing is persisted', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')], 'ws-2' as WorkspaceId))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()

    expect(actions.getStatus).toHaveBeenCalledWith('/p2', expect.any(AbortSignal))
  })

  it('prefers the persisted workspace id over the recent workspace', async () => {
    localStorage.setItem(WORKSPACE_KEY, 'ws-1')
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')], 'ws-2' as WorkspaceId))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()

    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })

  it('shows the no-workspace message when the list is empty', async () => {
    const list = makeList(listState([]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()

    expect(mount.querySelector('.dsh-github-sidebar-empty')).not.toBeNull()
    expect(mount.textContent).toContain('No workspace.')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('collapses on the panel collapse button and unmounts the panel', async () => {
    const list = makeList(listState([ws('ws-1', '/p1')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()
    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()

    await act(async () => { mount.querySelector<HTMLButtonElement>('button[aria-label="Collapse"]')?.click() })
    await flush()
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
    expect(mount.querySelector('.dsh-github-sidebar-rail-btn')).not.toBeNull()
  })

  it('collapses on Escape and unmounts the panel', async () => {
    const list = makeList(listState([ws('ws-1', '/p1')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()

    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('persists expanded state and the selected workspace id to localStorage', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    expect(localStorage.getItem(EXPANDED_KEY)).toBeNull()
    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()
    expect(localStorage.getItem(EXPANDED_KEY)).toBe('1')

    const select = mount.querySelector<HTMLSelectElement>('.dsh-github-workspace-picker select')
    expect(select).not.toBeNull()
    await act(async () => { setSelectValue(select!, 'ws-2') })
    await flush()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe('ws-2')

    await act(async () => { mount.querySelector<HTMLButtonElement>('button[aria-label="Collapse"]')?.click() })
    await flush()
    expect(localStorage.getItem(EXPANDED_KEY)).toBe('0')
  })

  it('restores an expanded sidebar from localStorage', async () => {
    localStorage.setItem(EXPANDED_KEY, '1')
    localStorage.setItem(WORKSPACE_KEY, 'ws-2')
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p2', expect.any(AbortSignal))
  })

  it('returns focus to the rail button on collapse', async () => {
    const list = makeList(listState([ws('ws-1', '/p1')]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()
    await act(async () => { mount.querySelector<HTMLButtonElement>('button[aria-label="Collapse"]')?.click() })
    await flush()

    expect(document.activeElement).toBe(mount.querySelector('.dsh-github-sidebar-rail-btn'))
  })

  it('reflects workspace list changes from the snapshot subscription', async () => {
    const list = makeList(listState([]))
    const actions = makeActions()
    const { mount } = await mountSidebar(list, actions)

    await act(async () => { mount.querySelector<HTMLButtonElement>('.dsh-github-sidebar-rail-btn')?.click() })
    await flush()
    expect(mount.textContent).toContain('No workspace.')

    await act(async () => { list.setState(listState([ws('ws-1', '/p1')])) })
    await flush()
    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })
})
