// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GithubChangesPanel, type GithubPanelActions } from '../src/client/panel.tsx'
import { en, fmt, type DshGithubKey } from '../src/client/locales.ts'
import type { GitCommitDetail, GitDiff, GitLog, GitOutput, GitRemoteList, GitRepositoryOverview, GitStashList, GitStatus, GitTagList } from '../src/types.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const t = (key: DshGithubKey, params?: Record<string, string>) => params === undefined ? en[key] : fmt(en[key], params)
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

const status: GitStatus = {
  root: '/repo', branch: 'main', upstream: 'origin/main', ahead: 1, behind: 2,
  remoteName: 'origin', remoteUrl: 'https://github.com/owner/repo.git', githubUrl: 'https://github.com/owner/repo',
  pushRemoteName: 'origin', pushRemoteUrl: 'https://github.com/owner/repo.git',
  headSha: 'abc123', commitUrl: null, mergeState: null, truncated: false,
  files: [
    { path: 'staged.ts', index: 'M', worktree: ' ', kind: 'modified', previousPath: null, fileUrl: null },
    { path: 'changed.ts', index: ' ', worktree: 'M', kind: 'modified', previousPath: null, fileUrl: null },
    { path: 'new.ts', index: '?', worktree: '?', kind: 'untracked', previousPath: null, fileUrl: null },
    { path: 'conflict.ts', index: 'U', worktree: 'U', kind: 'conflict', previousPath: null, fileUrl: null },
  ],
}

const publishStatus: GitStatus = {
  ...status, upstream: null, ahead: 0, behind: 0,
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

/** Flush pending microtasks and React updates (real timers). */
async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

async function mountPanel(actions: GithubPanelActions, options: { title?: string } = {}) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const root = createRoot(mount)
  await act(async () => {
    root.render(<GithubChangesPanel path="/repo" title={options.title ?? 'repo'} actions={actions} t={t} />)
  })
  await flush()
  return { mount, root }
}

function changeGroup(mount: HTMLElement, title: string): HTMLElement {
  const group = [...mount.querySelectorAll<HTMLElement>('.dsh-github-change-group')]
    .find(candidate => [...candidate.querySelectorAll<HTMLElement>('span')].some(span => span.textContent === title))
  if (group === undefined) throw new Error(`change group "${title}" not found`)
  return group
}

function changeRow(mount: HTMLElement, path: string): HTMLElement {
  const row = [...mount.querySelectorAll<HTMLElement>('.dsh-github-change-row')]
    .find(candidate => candidate.textContent?.includes(path))
  if (row === undefined) throw new Error(`change row "${path}" not found`)
  return row
}

function rowButton(row: HTMLElement, ariaLabel: string): HTMLButtonElement {
  const button = [...row.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.getAttribute('aria-label') === ariaLabel)
  if (button === undefined) throw new Error(`button "${ariaLabel}" not found`)
  return button
}

function sectionToggle(mount: HTMLElement, title: string): HTMLButtonElement {
  const section = [...mount.querySelectorAll<HTMLElement>('.dsh-github-section')]
    .find(candidate => candidate.querySelector('.dsh-github-section-header')?.textContent?.includes(title))
  if (section === undefined) throw new Error(`section "${title}" not found`)
  const button = section.querySelector<HTMLButtonElement>('.dsh-github-group-toggle')
  if (button === null) throw new Error(`toggle for section "${title}" not found`)
  return button
}

function setTextareaValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter === undefined) throw new Error('no textarea value setter')
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => { document.body.replaceChildren() })

describe('GithubChangesPanel', () => {
  it('renders change groups with counts and an untracked badge inside Changes', async () => {
    const { mount } = await mountPanel(makeActions())

    expect(changeGroup(mount, 'Staged Changes').querySelector('.dsh-github-count-badge')?.textContent).toBe('1')
    expect(changeGroup(mount, 'Changes').querySelector('.dsh-github-count-badge')?.textContent).toBe('2')
    expect(changeGroup(mount, 'Merge Changes').querySelector('.dsh-github-count-badge')?.textContent).toBe('1')

    const untrackedBadge = changeRow(mount, 'new.ts').querySelector('.dsh-github-kind.kind-untracked')
    expect(untrackedBadge?.textContent).toBe('U')
    expect(mount.textContent).not.toContain('Untracked Changes')
  })

  it('stages and unstages files', async () => {
    const actions = makeActions()
    const { mount } = await mountPanel(actions)

    await act(async () => { rowButton(changeRow(mount, 'changed.ts'), 'Stage changes').click() })
    await flush()
    expect(actions.stage).toHaveBeenCalledWith('/repo', 'changed.ts')

    await act(async () => { rowButton(changeRow(mount, 'staged.ts'), 'Unstage changes').click() })
    await flush()
    expect(actions.unstage).toHaveBeenCalledWith('/repo', 'staged.ts')
  })

  it('opens ConfirmModal on discard and calls discard on confirm', async () => {
    const actions = makeActions()
    const { mount } = await mountPanel(actions)

    await act(async () => { rowButton(changeRow(mount, 'changed.ts'), 'Discard Changes: changed.ts').click() })
    expect(document.querySelector('.dsh-github-modal')).not.toBeNull()
    expect(actions.discard).not.toHaveBeenCalled()

    // Esc closes the confirm modal without discarding.
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(document.querySelector('.dsh-github-modal')).toBeNull()
    expect(actions.discard).not.toHaveBeenCalled()

    // Re-open and confirm.
    await act(async () => { rowButton(changeRow(mount, 'changed.ts'), 'Discard Changes: changed.ts').click() })
    const confirmButton = document.querySelector<HTMLButtonElement>('.dsh-github-modal-actions button.danger')
    expect(confirmButton).not.toBeNull()
    await act(async () => { confirmButton?.click() })
    await flush()
    expect(actions.discard).toHaveBeenCalledWith('/repo', 'changed.ts')
  })

  it('calls resolveConflict for Accept Current/Incoming/Both', async () => {
    const actions = makeActions()
    const { mount } = await mountPanel(actions)
    const row = changeRow(mount, 'conflict.ts')

    await act(async () => { rowButton(row, 'Accept Current Change').click() })
    await flush()
    expect(actions.resolveConflict).toHaveBeenCalledWith('/repo', 'conflict.ts', 'ours')

    await act(async () => { rowButton(row, 'Accept Incoming Change').click() })
    await flush()
    expect(actions.resolveConflict).toHaveBeenCalledWith('/repo', 'conflict.ts', 'theirs')

    await act(async () => { rowButton(row, 'Accept Both Changes').click() })
    await flush()
    expect(actions.resolveConflict).toHaveBeenCalledWith('/repo', 'conflict.ts', 'both')
  })

  it('commits with the Amend flag', async () => {
    const actions = makeActions()
    const { mount } = await mountPanel(actions)

    const textarea = mount.querySelector<HTMLTextAreaElement>('textarea')
    expect(textarea).not.toBeNull()
    await act(async () => { setTextareaValue(textarea!, 'test message') })
    const amendCheckbox = mount.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(amendCheckbox).not.toBeNull()
    await act(async () => { amendCheckbox!.click() })
    await flush()

    const commitButton = [...mount.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Commit' && button.classList.contains('primary'))
    expect(commitButton).toBeDefined()
    await act(async () => { commitButton!.click() })
    await flush()
    expect(actions.commit).toHaveBeenCalledWith('/repo', 'test message', true)
  })

  it('shows a sync icon with ahead/behind counts in the accessible label', async () => {
    const { mount } = await mountPanel(makeActions())
    const syncButton = mount.querySelector<HTMLButtonElement>('.dsh-github-sync-btn')
    expect(syncButton?.querySelector('svg.dsh-github-sync-icon')).not.toBeNull()
    expect(syncButton?.textContent).toBe('')
    expect(syncButton?.getAttribute('aria-label')).toBe('Sync changes (ahead 1, behind 2)')
  })

  it('shows Publish on the sync button when there is no upstream', async () => {
    const { mount } = await mountPanel(makeActions({ getStatus: vi.fn(() => ok(publishStatus)) }))
    const syncButton = mount.querySelector<HTMLButtonElement>('.dsh-github-sync-btn')
    expect(syncButton?.textContent).toBe('Publish')
    expect(syncButton?.getAttribute('aria-label')).toBe('Publish the current branch')
  })

  it('lazy-loads sections on expand', async () => {
    const actions = makeActions()
    const { mount } = await mountPanel(actions)

    expect(actions.log).not.toHaveBeenCalled()
    expect(actions.getRepositoryOverview).not.toHaveBeenCalled()
    expect(actions.remoteList).not.toHaveBeenCalled()
    expect(actions.tagList).not.toHaveBeenCalled()
    expect(actions.stashList).not.toHaveBeenCalled()

    await act(async () => { sectionToggle(mount, 'Branches').click() })
    await flush()
    expect(actions.getRepositoryOverview).toHaveBeenCalled()

    await act(async () => { sectionToggle(mount, 'Remotes').click() })
    await flush()
    expect(actions.remoteList).toHaveBeenCalled()

    await act(async () => { sectionToggle(mount, 'Tags').click() })
    await flush()
    expect(actions.tagList).toHaveBeenCalled()

    await act(async () => { sectionToggle(mount, 'Stashes').click() })
    await flush()
    expect(actions.stashList).toHaveBeenCalled()

    await act(async () => { sectionToggle(mount, 'Commits').click() })
    await act(async () => { await new Promise(resolve => { setTimeout(resolve, 300) }) })
    expect(actions.log).toHaveBeenCalled()
  })

  it('polls getStatus every 3s and stops on unmount', async () => {
    vi.useFakeTimers()
    try {
      const actions = makeActions()
      const mount = document.createElement('div')
      document.body.appendChild(mount)
      const root = createRoot(mount)
      await act(async () => {
        root.render(<GithubChangesPanel path="/repo" title="repo" actions={actions} t={t} />)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      const initial = vi.mocked(actions.getStatus).mock.calls.length
      expect(initial).toBeGreaterThanOrEqual(1)

      await act(async () => { vi.advanceTimersByTime(3000) })
      expect(vi.mocked(actions.getStatus).mock.calls.length).toBe(initial + 1)

      await act(async () => { root.unmount() })
      const afterUnmount = vi.mocked(actions.getStatus).mock.calls.length
      await act(async () => { vi.advanceTimersByTime(6000) })
      expect(vi.mocked(actions.getStatus).mock.calls.length).toBe(afterUnmount)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders a side-by-side diff with added and removed line cells', async () => {
    const diff = 'diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1 +1 @@\n-old\n+new\n'
    const actions = makeActions({ getDiff: vi.fn(() => ok({ path: 'changed.ts', diff, truncated: false })) })
    const { mount } = await mountPanel(actions)

    await act(async () => { (changeRow(mount, 'changed.ts').querySelector('.dsh-github-change-main') as HTMLButtonElement).click() })
    await flush()

    expect(actions.getDiff).toHaveBeenCalledWith('/repo', 'changed.ts', 'working', expect.any(AbortSignal))
    expect(mount.querySelector('.dsh-github-diff-line.left.remove')?.textContent).toBe('old')
    expect(mount.querySelector('.dsh-github-diff-line.right.add')?.textContent).toBe('new')
    expect(mount.querySelector('.dsh-github-diff-row.pair')).not.toBeNull()
  })

  it('fetches a specific remote from the Remotes section', async () => {
    const remotes: GitRemoteList = { remotes: [{ name: 'origin', fetchUrl: 'https://example.com/x.git', pushUrl: 'https://example.com/x.git' }] }
    const actions = makeActions({ remoteList: vi.fn(() => ok(remotes)) })
    const { mount } = await mountPanel(actions)

    await act(async () => { sectionToggle(mount, 'Remotes').click() })
    await flush()
    expect(actions.remoteList).toHaveBeenCalled()

    const fetchButton = [...mount.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.getAttribute('aria-label') === 'Fetch origin')
    expect(fetchButton).toBeDefined()
    await act(async () => { fetchButton!.click() })
    await flush()
    expect(actions.fetch).toHaveBeenCalledWith('/repo', 'origin', false, false)
  })
})
