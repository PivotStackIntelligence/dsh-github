// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SourceControlView } from '../src/client/view.tsx'
import type { GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { GitCommitDetail, GitDiff, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../src/types.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const t = (key: DshGithubKey, params?: Record<string, string>) => params === undefined ? en[key] : fmt(en[key], params)
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

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

/** A writable test double of the workspaces store. */
interface ListMock {
  getSnapshot(): WorkspaceListState
  subscribe(fn: () => void): () => void
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

/** A fake useWorkspaces hook backed by the ListMock, re-rendering on subscribe. */
function makeUseWorkspaces(list: ListMock): SnapshotSelectorHook<WorkspaceListState> {
  const subscribe = (onStoreChange: () => void) => list.subscribe(onStoreChange)
  const getSnapshot = () => list.getSnapshot()
  return <S,>(selector: (state: WorkspaceListState) => S): S => {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    return selector(snapshot)
  }
}

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

async function mountView(list: ListMock, actions: GithubPanelActions) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  const useWorkspaces = makeUseWorkspaces(list)
  await act(async () => { root.render(<SourceControlView actions={actions} t={t} useWorkspaces={useWorkspaces} />) })
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

describe('SourceControlView', () => {
  it('mounts the panel for the first workspace by default', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')]))
    const actions = makeActions()
    const { mount } = await mountView(list, actions)

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })

  it('prefers the recent workspace over the first item', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')], 'ws-2' as WorkspaceId))
    const actions = makeActions()
    await mountView(list, actions)

    expect(actions.getStatus).toHaveBeenCalledWith('/p2', expect.any(AbortSignal))
  })

  it('prefers the persisted workspace id over recent and first', async () => {
    localStorage.setItem(WORKSPACE_KEY, 'ws-1')
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')], 'ws-2' as WorkspaceId))
    const actions = makeActions()
    await mountView(list, actions)

    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })

  it('shows the no-workspace message when the list is empty', async () => {
    const list = makeList(listState([]))
    const actions = makeActions()
    const { mount } = await mountView(list, actions)

    expect(mount.querySelector('.dsh-github-view-empty')).not.toBeNull()
    expect(mount.textContent).toContain('No workspace.')
    expect(mount.querySelector('.dsh-github-panel')).toBeNull()
  })

  it('persists the selected workspace id when switching', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')]))
    const actions = makeActions()
    const { mount } = await mountView(list, actions)

    const select = mount.querySelector<HTMLSelectElement>('.dsh-github-workspace-picker select')
    expect(select).not.toBeNull()
    await act(async () => { setSelectValue(select!, 'ws-2') })
    await flush()

    expect(localStorage.getItem(WORKSPACE_KEY)).toBe('ws-2')
  })

  it('remounts the panel keyed by the workspace when selection changes', async () => {
    const list = makeList(listState([ws('ws-1', '/p1'), ws('ws-2', '/p2')]))
    const actions = makeActions()
    const { mount } = await mountView(list, actions)
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))

    const select = mount.querySelector<HTMLSelectElement>('.dsh-github-workspace-picker select')
    await act(async () => { setSelectValue(select!, 'ws-2') })
    await flush()

    expect(actions.getStatus).toHaveBeenCalledWith('/p2', expect.any(AbortSignal))
  })

  it('mounts the panel when the workspace list becomes non-empty', async () => {
    const list = makeList(listState([]))
    const actions = makeActions()
    const { mount } = await mountView(list, actions)
    expect(mount.textContent).toContain('No workspace.')

    await act(async () => { list.setState(listState([ws('ws-1', '/p1')])) })
    await flush()

    expect(mount.querySelector('.dsh-github-panel')).not.toBeNull()
    expect(actions.getStatus).toHaveBeenCalledWith('/p1', expect.any(AbortSignal))
  })
})
