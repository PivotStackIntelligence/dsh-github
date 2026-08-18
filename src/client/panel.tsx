/**
 * dsh-github Source Control drawer: a faithful VS Code native Git Source
 * Control simulation rendered into the Harness right drawer. Single SCM
 * sidebar + diff viewer, collapsible lazy-loaded sections, inline confirm
 * modal, side-by-side diff, and the standard operation state machine.
 * Author: bugmaker2 · PivotStack Intelligence
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { GitBranch, GitCommitDetail, GitCommitFile, GitCommitSummary, GitConflictStrategy, GitDiff, GitDiffMode, GitFileChange, GitLog, GitOutput, GitOutputEntry, GitRemote, GitRemoteList, GitRepositoryOverview, GitStash, GitStashList, GitStatus, GitTag, GitTagList } from '../types.ts'
import { ConfirmModal, type ConfirmField } from './confirm.tsx'
import { InlineDiff, parseUnifiedDiff, SideBySideDiff } from './diff.tsx'
import type { DshGithubKey } from './locales.ts'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** Everything the drawer can be doing at once (single in-flight operation). */
type Operation =
  | 'stage' | 'unstage' | 'stageAll' | 'unstageAll' | 'discard' | 'discardAll'
  | 'commit' | 'commitAndPush' | 'commitAndSync' | 'undoLastCommit' | 'resolveConflict'
  | 'push' | 'fetch' | 'pull' | 'sync'
  | 'checkoutBranch' | 'createBranch' | 'createBranchFrom' | 'branchRename' | 'branchDelete'
  | 'mergeBranch' | 'rebaseBranch' | 'abortMerge' | 'abortRebase' | 'continueMerge' | 'continueRebase'
  | 'checkoutCommit'
  | 'stashCreate' | 'stashApply' | 'stashDrop'
  | 'tagCreate' | 'tagDelete' | 'pushTags'
  | 'remoteAdd' | 'remoteRemove'

/** What the right-hand diff pane is currently showing. */
type DiffView =
  | { kind: 'none' }
  | { kind: 'working'; path: string; mode: GitDiffMode }
  | { kind: 'commit'; sha: string; filePath: string; label: string }
  | { kind: 'stash'; ref: string; label: string }

/** A pending inline confirm / prompt. */
interface ConfirmRequest {
  message: string
  detail?: string
  fields?: ConfirmField[]
  danger?: boolean
  onConfirm: (values: Record<string, string>, checks: Record<string, boolean>) => void
}

/** Browser-side operations used by the Source Control panel. */
export interface GithubPanelActions {
  getStatus: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  getDiff: (path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
  stage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  unstage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  stageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  unstageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  discard: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  discardAll: (path: string, includeUntracked: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  commit: (path: string, message: string, amend: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  undoLastCommit: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  resolveConflict: (path: string, filePath: string, strategy: GitConflictStrategy, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  push: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  fetch: (path: string, remoteName: string, all: boolean, prune: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  pull: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  sync: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  checkoutBranch: (path: string, branch: string, remote: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  createBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  createBranchFrom: (path: string, branch: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  branchRename: (path: string, oldName: string, newName: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  branchDelete: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  mergeBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  rebaseBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  abortMerge: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  abortRebase: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  continueMerge: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  continueRebase: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  checkoutCommit: (path: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  getRepositoryOverview: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRepositoryOverview>>
  log: (path: string, query: string, signal?: AbortSignal) => Promise<RemoteResult<GitLog>>
  showCommit: (path: string, sha: string, signal?: AbortSignal) => Promise<RemoteResult<GitCommitDetail>>
  showCommitDiff: (path: string, sha: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
  stashList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStashList>>
  stashCreate: (path: string, message: string, includeUntracked: boolean, keepIndex: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  stashApply: (path: string, ref: string, drop: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  stashDrop: (path: string, ref: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  stashDiff: (path: string, ref: string, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
  tagList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitTagList>>
  tagCreate: (path: string, name: string, message: string, atRef: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  tagDelete: (path: string, name: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  pushTags: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  remoteList: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRemoteList>>
  remoteAdd: (path: string, name: string, url: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  remoteRemove: (path: string, name: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  getOutput: (signal?: AbortSignal) => Promise<RemoteResult<GitOutput>>
  openFile: (root: string, filePath: string) => Promise<void>
}

function errorMessage(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason) }

function badge(file: GitFileChange): string {
  return file.kind === 'untracked' ? 'U' : file.kind === 'deleted' ? 'D' : file.kind === 'added' ? 'A' : file.kind === 'renamed' ? 'R' : file.kind === 'copied' ? 'C' : file.kind === 'conflict' ? '!' : 'M'
}

function hasMode(file: GitFileChange, mode: GitDiffMode): boolean {
  return mode === 'staged' ? file.index !== ' ' && file.index !== '?' : file.worktree !== ' ' || file.kind === 'untracked'
}

function pullRequestNumber(branch: GitBranch): string | null {
  return branch.remote ? branch.name.match(/^(?:pull|pr)\/(\d+)\/(?:head|merge)$/i)?.[1] ?? null : null
}

function commitStatusLetter(status: GitCommitFile['status']): string {
  return status === 'added' ? 'A' : status === 'modified' ? 'M' : status === 'deleted' ? 'D' : status === 'renamed' ? 'R' : 'C'
}

function relativeTime(iso: string, t: (key: DshGithubKey, params?: Record<string, string>) => string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return t('panel.time.justNow')
  if (minutes < 60) return t('panel.time.minutesAgo', { n: String(minutes) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('panel.time.hoursAgo', { n: String(hours) })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('panel.time.daysAgo', { n: String(days) })
  const months = Math.floor(days / 30)
  if (months < 12) return t('panel.time.monthsAgo', { n: String(months) })
  return t('panel.time.yearsAgo', { n: String(Math.floor(months / 12)) })
}

/** Collapsible section header + lazy body. */
function Section({ title, count, expanded, onToggle, actions, children }: {
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  actions?: ReactNode
  children?: ReactNode
}) {
  return <section className="dsh-github-section">
    <div className="dsh-github-section-header">
      <button type="button" className="dsh-github-group-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span className="chevron">{expanded ? '⌄' : '›'}</span>
        <span>{title}</span>
        <span className="dsh-github-count-badge">{count}</span>
      </button>
      {actions}
    </div>
    {expanded ? <div className="dsh-github-section-body">{children}</div> : null}
  </section>
}

/** Render the local Source Control and pull-request panel. */
export function GithubChangesPanel({ path, title, actions, t }: {
  path: string
  title: string
  actions: GithubPanelActions
  t: (key: DshGithubKey, params?: Record<string, string>) => string
}) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [operation, setOperation] = useState<Operation | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<DiffView>({ kind: 'none' })
  const [diff, setDiff] = useState<GitDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffStyle, setDiffStyle] = useState<'side' | 'inline'>('side')
  const [commitMenuOpen, setCommitMenuOpen] = useState(false)

  const [stagedExpanded, setStagedExpanded] = useState(true)
  const [changesExpanded, setChangesExpanded] = useState(true)
  const [mergeExpanded, setMergeExpanded] = useState(true)
  const [commitsExpanded, setCommitsExpanded] = useState(false)
  const [branchesExpanded, setBranchesExpanded] = useState(false)
  const [remotesExpanded, setRemotesExpanded] = useState(false)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [stashesExpanded, setStashesExpanded] = useState(false)
  const [outputExpanded, setOutputExpanded] = useState(false)

  const [log, setLog] = useState<GitLog | null>(null)
  const [logQuery, setLogQuery] = useState('')
  const [overview, setOverview] = useState<GitRepositoryOverview | null>(null)
  const [remotes, setRemotes] = useState<GitRemoteList | null>(null)
  const [tags, setTags] = useState<GitTagList | null>(null)
  const [stashes, setStashes] = useState<GitStashList | null>(null)
  const [output, setOutput] = useState<GitOutput | null>(null)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const statusRequest = useRef<{ id: number; controller: AbortController } | null>(null)
  const sectionRequests = useRef<Map<string, { id: number; controller: AbortController }>>(new Map())
  const diffRequest = useRef<{ id: number; controller: AbortController } | null>(null)
  const requestId = useRef(0)
  const operationRef = useRef<Operation | null>(null)
  const commitMenuRef = useRef<HTMLDivElement>(null)
  const refreshRef = useRef<(clearError?: boolean) => void>(() => {})
  const expandedRef = useRef({ commits: false, branches: false, remotes: false, tags: false, stashes: false, output: false })
  const logQueryRef = useRef('')

  useEffect(() => { operationRef.current = operation })
  useEffect(() => { logQueryRef.current = logQuery })
  useEffect(() => {
    expandedRef.current = { commits: commitsExpanded, branches: branchesExpanded, remotes: remotesExpanded, tags: tagsExpanded, stashes: stashesExpanded, output: outputExpanded }
  })

  const acceptStatus = (next: GitStatus): void => {
    setStatus(next)
    setView(current => {
      if (current.kind !== 'working') return current
      const file = next.files.find(candidate => candidate.path === current.path)
      if (file === undefined) return { kind: 'none' }
      if (hasMode(file, current.mode)) return current
      const otherMode = current.mode === 'staged' ? 'working' : 'staged'
      return hasMode(file, otherMode) ? { ...current, mode: otherMode } : { kind: 'none' }
    })
  }

  const loadSection = <T,>(key: string, call: (signal: AbortSignal) => Promise<RemoteResult<T>>, apply: (value: T) => void): void => {
    const previous = sectionRequests.current.get(key)
    previous?.controller.abort()
    const controller = new AbortController()
    const id = ++requestId.current
    sectionRequests.current.set(key, { id, controller })
    void call(controller.signal).then(result => {
      if (sectionRequests.current.get(key)?.id !== id) return
      if (!result.ok) throw new Error(result.error.message)
      apply(result.value)
    }).catch(reason => {
      if (sectionRequests.current.get(key)?.id === id && !controller.signal.aborted) setError(errorMessage(reason))
    })
  }

  const loadCommits = (): void => { loadSection('commits', signal => actions.log(path, logQueryRef.current, signal), setLog) }
  const loadOverview = (): void => { loadSection('overview', signal => actions.getRepositoryOverview(path, signal), setOverview) }
  const loadRemotes = (): void => { loadSection('remotes', signal => actions.remoteList(path, signal), setRemotes) }
  const loadTags = (): void => { loadSection('tags', signal => actions.tagList(path, signal), setTags) }
  const loadStashes = (): void => { loadSection('stashes', signal => actions.stashList(path, signal), setStashes) }
  const loadOutput = (): void => { loadSection('output', signal => actions.getOutput(signal), setOutput) }

  const refreshExpandedSections = (): void => {
    const expanded = expandedRef.current
    if (expanded.commits) loadCommits()
    if (expanded.branches) loadOverview()
    if (expanded.remotes) loadRemotes()
    if (expanded.tags) loadTags()
    if (expanded.stashes) loadStashes()
    if (expanded.output) loadOutput()
  }

  /** Expand COMMITS, reload the log, and open the given commit's detail so its files are visible. */
  const revealLatestCommit = (sha: string): void => {
    setCommitsExpanded(true)
    loadCommits()
    setExpandedCommit(sha)
    setCommitDetail(null)
    loadSection(`commit:${sha}`, signal => actions.showCommit(path, sha, signal), setCommitDetail)
  }

  const refresh = (clearError = true): void => {
    statusRequest.current?.controller.abort()
    const request = { id: ++requestId.current, controller: new AbortController() }
    statusRequest.current = request
    setLoading(true)
    if (clearError) { setError(null); setNotice(null) }
    void actions.getStatus(path, request.controller.signal).then(result => {
      if (request.id !== statusRequest.current?.id) return
      if (!result.ok) throw new Error(result.error.message)
      acceptStatus(result.value)
      void refreshExpandedSections()
    }).catch(reason => {
      if (request.id === statusRequest.current?.id && !request.controller.signal.aborted) setError(errorMessage(reason))
    }).finally(() => {
      if (request.id === statusRequest.current?.id) setLoading(false)
    })
  }
  useEffect(() => { refreshRef.current = refresh })

  const runStatusAction = (name: Exclude<Operation, null>, fn: () => Promise<RemoteResult<GitStatus>>, opts: { clearMessage?: boolean } = {}): void => {
    if (operationRef.current !== null) return
    operationRef.current = name
    setOperation(name)
    setError(null)
    setNotice(null)
    void fn().then(result => {
      if (!result.ok) throw new Error(result.error.message)
      acceptStatus(result.value)
      void refreshExpandedSections()
      if (opts.clearMessage) setMessage('')
      if ((name === 'commit' || name === 'commitAndPush' || name === 'commitAndSync') && result.value.headSha !== null) revealLatestCommit(result.value.headSha)
      setNotice(t(`panel.success.${name}`))
    }).catch(reason => {
      setNotice(null)
      setError(errorMessage(reason))
      refresh(false)
    }).finally(() => { operationRef.current = null; setOperation(null) })
  }

  const commitThen = (kind: 'commitAndPush' | 'commitAndSync'): void => {
    if (operationRef.current !== null || message.trim() === '') return
    operationRef.current = kind
    setOperation(kind)
    setError(null)
    setNotice(null)
    let committed = false
    void actions.commit(path, message.trim(), amend).then(result => {
      if (!result.ok) throw new Error(result.error.message)
      committed = true
      acceptStatus(result.value)
      setMessage('')
      if (result.value.headSha !== null) revealLatestCommit(result.value.headSha)
      return kind === 'commitAndPush' ? actions.push(path) : actions.sync(path)
    }).then(result => {
      if (!result.ok) throw new Error(result.error.message)
      acceptStatus(result.value)
      void refreshExpandedSections()
      setNotice(t(`panel.success.${kind}`))
    }).catch(reason => {
      setNotice(null)
      const detail = errorMessage(reason)
      setError(committed ? `${t(kind === 'commitAndPush' ? 'panel.commitCreatedPushFailed' : 'panel.commitCreatedSyncFailed')} ${detail}` : detail)
      refresh(false)
    }).finally(() => { operationRef.current = null; setOperation(null) })
  }

  const conflicts = status?.files.filter(file => file.kind === 'conflict') ?? []
  const staged = status?.files.filter(file => file.kind !== 'conflict' && hasMode(file, 'staged')) ?? []
  const changes = status?.files.filter(file => file.kind !== 'conflict' && hasMode(file, 'working')) ?? []
  const detached = status !== null && status.branch.startsWith('HEAD ')
  const hasConflicts = conflicts.length > 0
  const canCommit = operation === null && message.trim() !== '' && staged.length > 0 && status !== null && status.mergeState === null
  const canPush = operation === null && status !== null && !detached && !hasConflicts && status.pushRemoteName !== null
  const canPublish = canPush && status.pushRemoteUrl !== null
  const canSync = canPush && status.remoteName !== null && status.upstream !== null
  const canCommitAndSync = canCommit && (status !== null && status.upstream === null ? canPublish : canSync)

  const openUrl = (url: string): void => { window.open(url, '_blank', 'noopener,noreferrer') }

  const commit = (): void => {
    if (!canCommit) return
    runStatusAction('commit', () => actions.commit(path, message.trim(), amend), { clearMessage: true })
  }
  const commitKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
    event.preventDefault()
    commit()
  }

  const syncAction = (): void => {
    if (status === null) return
    if (status.upstream === null ? canPublish : canSync) runStatusAction('sync', () => actions.sync(path))
  }
  const syncAria = status === null ? '' : status.upstream === null ? t('panel.publishAria') : t('panel.syncAria', { ahead: String(status.ahead), behind: String(status.behind) })

  const resolveConflict = (file: GitFileChange, strategy: GitConflictStrategy): void => {
    runStatusAction('resolveConflict', () => actions.resolveConflict(path, file.path, strategy))
  }
  const resolveCurrent = (): void => { if (view.kind === 'working') runStatusAction('resolveConflict', () => actions.resolveConflict(path, view.path, 'ours')) }

  const copySha = (sha: string): void => {
    const clipboard = navigator.clipboard
    if (clipboard === undefined) { setError(t('panel.copyFailed')); return }
    void clipboard.writeText(sha).then(() => setNotice(t('panel.copiedSha'))).catch(() => setError(t('panel.copyFailed')))
  }

  const toggleCommit = (sha: string): void => {
    if (expandedCommit === sha) { setExpandedCommit(null); setCommitDetail(null); return }
    setExpandedCommit(sha)
    setCommitDetail(null)
    loadSection(`commit:${sha}`, signal => actions.showCommit(path, sha, signal), setCommitDetail)
  }

  const openStashDiff = (ref: string): void => { setView({ kind: 'stash', ref, label: ref }) }

  // Destructive / creation confirm prompts.
  const confirmDiscard = (file: GitFileChange): void => setConfirm({ message: t('panel.confirm.discard', { path: file.path }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('discard', () => actions.discard(path, file.path)) } })
  const confirmDiscardAll = (): void => setConfirm({ message: t('panel.confirm.discardAll'), danger: true, fields: [{ id: 'untracked', kind: 'checkbox', label: t('panel.confirm.discardAll.untracked'), initial: false }], onConfirm: (_values, checks) => { setConfirm(null); runStatusAction('discardAll', () => actions.discardAll(path, checks['untracked'] ?? false)) } })
  const confirmUndoLastCommit = (): void => setConfirm({ message: t('panel.confirm.undoLastCommit'), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('undoLastCommit', () => actions.undoLastCommit(path)) } })
  const confirmAbortMerge = (): void => setConfirm({ message: t('panel.confirm.abortMerge'), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('abortMerge', () => actions.abortMerge(path)) } })
  const confirmAbortRebase = (): void => setConfirm({ message: t('panel.confirm.abortRebase'), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('abortRebase', () => actions.abortRebase(path)) } })
  const confirmBranchDelete = (branch: GitBranch): void => setConfirm({ message: t('panel.confirm.branchDelete', { name: branch.name }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('branchDelete', () => actions.branchDelete(path, branch.name)) } })
  const confirmMergeBranch = (branch: GitBranch): void => setConfirm({ message: t('panel.confirm.mergeBranch', { name: branch.name, branch: status?.branch ?? '' }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('mergeBranch', () => actions.mergeBranch(path, branch.name)) } })
  const confirmRebaseBranch = (branch: GitBranch): void => setConfirm({ message: t('panel.confirm.rebaseBranch', { name: branch.name }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('rebaseBranch', () => actions.rebaseBranch(path, branch.name)) } })
  const confirmCheckoutCommit = (sha: string): void => setConfirm({ message: t('panel.confirm.checkoutCommit', { sha }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('checkoutCommit', () => actions.checkoutCommit(path, sha)) } })
  const confirmRemoteRemove = (name: string): void => setConfirm({ message: t('panel.confirm.remoteRemove', { name }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('remoteRemove', () => actions.remoteRemove(path, name)) } })
  const confirmTagDelete = (name: string): void => setConfirm({ message: t('panel.confirm.tagDelete', { name }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('tagDelete', () => actions.tagDelete(path, name)) } })
  const confirmStashDrop = (ref: string): void => setConfirm({ message: t('panel.confirm.stashDrop', { ref }), danger: true, onConfirm: () => { setConfirm(null); runStatusAction('stashDrop', () => actions.stashDrop(path, ref)) } })

  const promptRenameBranch = (branch: GitBranch): void => setConfirm({ message: t('panel.confirm.renameBranch', { name: branch.name }), fields: [{ id: 'name', kind: 'input', label: t('panel.renameBranchPlaceholder'), placeholder: t('panel.renameBranchPlaceholder'), initial: branch.name }], onConfirm: values => { const name = values['name']?.trim(); setConfirm(null); if (name !== undefined && name !== '' && name !== branch.name) runStatusAction('branchRename', () => actions.branchRename(path, branch.name, name)) } })
  const promptCreateBranch = (): void => setConfirm({ message: t('panel.confirm.createBranch'), fields: [{ id: 'name', kind: 'input', label: t('panel.newBranchPlaceholder'), placeholder: t('panel.newBranchPlaceholder') }], onConfirm: values => { const name = values['name']?.trim(); setConfirm(null); if (name !== undefined && name !== '') runStatusAction('createBranch', () => actions.createBranch(path, name)) } })
  const promptCreateBranchFrom = (sha: string): void => setConfirm({ message: t('panel.confirm.createBranchFrom', { sha }), fields: [{ id: 'name', kind: 'input', label: t('panel.newBranchPlaceholder'), placeholder: t('panel.newBranchPlaceholder') }], onConfirm: values => { const name = values['name']?.trim(); setConfirm(null); if (name !== undefined && name !== '') runStatusAction('createBranchFrom', () => actions.createBranchFrom(path, name, sha)) } })
  const promptCreateTag = (atRef: string): void => setConfirm({ message: atRef === '' ? t('panel.confirm.createTag') : t('panel.confirm.createTagAt', { ref: atRef }), fields: [{ id: 'name', kind: 'input', label: t('panel.tagNamePlaceholder'), placeholder: t('panel.tagNamePlaceholder') }, { id: 'message', kind: 'input', label: t('panel.tagMessagePlaceholder'), placeholder: t('panel.tagMessagePlaceholder') }], onConfirm: values => { const name = values['name']?.trim(); setConfirm(null); if (name !== undefined && name !== '') runStatusAction('tagCreate', () => actions.tagCreate(path, name, values['message'] ?? '', atRef)) } })
  const promptAddRemote = (): void => setConfirm({ message: t('panel.confirm.addRemote'), fields: [{ id: 'name', kind: 'input', label: t('panel.remoteNamePlaceholder'), placeholder: t('panel.remoteNamePlaceholder') }, { id: 'url', kind: 'input', label: t('panel.remoteUrlPlaceholder'), placeholder: t('panel.remoteUrlPlaceholder') }], onConfirm: values => { const name = values['name']?.trim(); const url = values['url']?.trim(); setConfirm(null); if (name !== undefined && name !== '' && url !== undefined && url !== '') runStatusAction('remoteAdd', () => actions.remoteAdd(path, name, url)) } })
  const promptCreateStash = (): void => setConfirm({ message: t('panel.confirm.createStash'), fields: [{ id: 'message', kind: 'input', label: t('panel.stashMessagePlaceholder'), placeholder: t('panel.stashMessagePlaceholder') }, { id: 'untracked', kind: 'checkbox', label: t('panel.stashIncludeUntracked'), initial: false }, { id: 'keepIndex', kind: 'checkbox', label: t('panel.stashKeepIndex'), initial: false }], onConfirm: (values, checks) => { setConfirm(null); runStatusAction('stashCreate', () => actions.stashCreate(path, values['message'] ?? '', checks['untracked'] ?? false, checks['keepIndex'] ?? false)) } })

  const fetchRemote = (remoteName: string, all: boolean, prune: boolean): void => { runStatusAction('fetch', () => actions.fetch(path, remoteName, all, prune)) }

  const changeRow = (file: GitFileChange, mode: GitDiffMode): ReactNode => {
    const selected = view.kind === 'working' && view.path === file.path && view.mode === mode
    const isConflict = file.kind === 'conflict'
    return <div className={`dsh-github-change-row${selected ? ' selected' : ''}`} key={`${mode}:${file.path}`}>
      <button type="button" className="dsh-github-change-main" onClick={() => setView({ kind: 'working', path: file.path, mode })}>
        <span className={`dsh-github-kind kind-${file.kind}`}>{badge(file)}</span>
        <span className="dsh-github-change-path" title={file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}>
          <span>{file.path}</span>{file.previousPath ? <small>← {file.previousPath}</small> : null}
        </span>
      </button>
      <span className="dsh-github-row-actions">
        <button type="button" className="dsh-github-icon-btn" disabled={file.kind === 'deleted'} aria-label={`${t('panel.openFile')}: ${file.path}`} title={t('panel.openFile')} onClick={() => { void actions.openFile(status?.root ?? path, file.path).catch(reason => setError(errorMessage(reason))) }}>⌕</button>
        {file.fileUrl ? <button type="button" className="dsh-github-icon-btn" aria-label={`${t('panel.openFileOnGithub')}: ${file.path}`} title={t('panel.openFileOnGithub')} onClick={() => openUrl(file.fileUrl!)}>↗</button> : null}
        {isConflict ? <>
          <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.acceptCurrent')} title={t('panel.acceptCurrent')} onClick={() => resolveConflict(file, 'ours')}>{t('panel.acceptCurrent.short')}</button>
          <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.acceptIncoming')} title={t('panel.acceptIncoming')} onClick={() => resolveConflict(file, 'theirs')}>{t('panel.acceptIncoming.short')}</button>
          <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.acceptBoth')} title={t('panel.acceptBoth')} onClick={() => resolveConflict(file, 'both')}>{t('panel.acceptBoth.short')}</button>
        </> : null}
        <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={isConflict ? t('panel.stageResolved') : mode === 'staged' ? t('panel.unstage') : t('panel.stage')} title={isConflict ? t('panel.stageResolved') : mode === 'staged' ? t('panel.unstage') : t('panel.stage')} onClick={() => runStatusAction(mode === 'staged' ? 'unstage' : 'stage', () => mode === 'staged' ? actions.unstage(path, file.path) : actions.stage(path, file.path))}>{mode === 'staged' ? '−' : '+'}</button>
        {!isConflict ? <button type="button" className="dsh-github-icon-btn danger" disabled={operation !== null} aria-label={`${t('panel.discard')}: ${file.path}`} title={t('panel.discard')} onClick={() => confirmDiscard(file)}>↶</button> : null}
      </span>
    </div>
  }

  const renderGroup = (mode: GitDiffMode, files: GitFileChange[], titleKey: DshGithubKey, expanded: boolean, setExpanded: (value: boolean) => void, actionsEl: ReactNode): ReactNode => <section className="dsh-github-change-group">
    <div className="dsh-github-change-group-header">
      <button type="button" className="dsh-github-group-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <span className="chevron">{expanded ? '⌄' : '›'}</span><span>{t(titleKey)}</span><span className="dsh-github-count-badge">{files.length}</span>
      </button>
      {actionsEl}
    </div>
    {expanded ? files.map(file => changeRow(file, mode)) : null}
  </section>

  const commitRow = (commit: GitCommitSummary): ReactNode => {
    const expanded = expandedCommit === commit.sha
    return <div className="dsh-github-commit-item" key={commit.sha}>
      <button type="button" className="dsh-github-commit-summary" aria-expanded={expanded} onClick={() => toggleCommit(commit.sha)}>
        <span className="dsh-github-commit-sha">{commit.shortSha}</span>
        <span className="dsh-github-commit-subject">{commit.subject}</span>
        <span className="dsh-github-commit-meta">{commit.author} · {relativeTime(commit.date, t)}{commit.refs.map(ref => <span className="dsh-github-ref-badge" key={ref}>{ref}</span>)}</span>
      </button>
      {expanded ? <div className="dsh-github-commit-detail">
        {commitDetail !== null && commitDetail.sha === commit.sha ? <>
          <p className="dsh-github-commit-detail-meta">{commitDetail.author} &lt;{commitDetail.email}&gt; · {commitDetail.date}{commitDetail.body ? `\n\n${commitDetail.body}` : ''}</p>
          <div className="dsh-github-commit-detail-actions">
            <button type="button" className="dsh-github-btn" onClick={() => copySha(commitDetail.sha)}>{t('panel.copySha')}</button>
            <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => confirmCheckoutCommit(commitDetail.sha)}>{t('panel.checkoutCommit')}</button>
            <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => promptCreateBranchFrom(commitDetail.sha)}>{t('panel.createBranchFrom')}</button>
            <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => promptCreateTag(commitDetail.sha)}>{t('panel.createTag')}</button>
          </div>
          <p className="dsh-github-section-empty">{t('panel.filesChangedInCommit')}</p>
          {commitDetail.files.map(file => <button key={file.path} type="button" className="dsh-github-commit-file" onClick={() => setView({ kind: 'commit', sha: commit.sha, filePath: file.path, label: `${commit.shortSha} · ${file.path}` })}><span className="kind">{commitStatusLetter(file.status)}</span><span>{file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}</span></button>)}
          {commitDetail.truncated ? <p className="dsh-github-panel-message compact">{t('panel.truncated')}</p> : null}
        </> : <p className="dsh-github-panel-message compact">{t('panel.loading')}</p>}
      </div> : null}
    </div>
  }

  const branchRow = (branch: GitBranch): ReactNode => {
    const pr = pullRequestNumber(branch)
    if (pr !== null && branch.branchUrl !== null) {
      return <div className="dsh-github-branch-row" key={`remote:${branch.name}`}>
        <a className="dsh-github-branch-name" href={branch.branchUrl} target="_blank" rel="noreferrer">{t('panel.pullRequest', { number: pr })}</a>
      </div>
    }
    return <div className={`dsh-github-branch-row${branch.current ? ' current' : ''}`} key={`${branch.remote ? 'remote' : 'local'}:${branch.name}`}>
      <button type="button" className="dsh-github-branch-name" disabled={branch.current || operation !== null} onClick={() => runStatusAction('checkoutBranch', () => actions.checkoutBranch(path, branch.name, branch.remote))}>
        {branch.name}
        <span className="dsh-github-branch-upstream">{branch.current ? t('panel.currentBranch') : branch.upstream ?? (branch.remote ? t('panel.remote') : '')}</span>
      </button>
      {branch.branchUrl ? <a className="dsh-github-icon-btn" href={branch.branchUrl} target="_blank" rel="noreferrer" aria-label={`${t('panel.openBranch')}: ${branch.name}`}>↗</a> : null}
      <span className="dsh-github-row-actions">
        <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.renameBranch')} title={t('panel.renameBranch')} onClick={() => promptRenameBranch(branch)}>✎</button>
        {!branch.current ? <button type="button" className="dsh-github-icon-btn danger" disabled={operation !== null} aria-label={t('panel.deleteBranch')} title={t('panel.deleteBranch')} onClick={() => confirmBranchDelete(branch)}>🗑</button> : null}
        {!branch.current ? <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.mergeIntoCurrent')} title={t('panel.mergeIntoCurrent')} onClick={() => confirmMergeBranch(branch)}>⤵</button> : null}
        {!branch.current ? <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.rebaseOnto')} title={t('panel.rebaseOnto')} onClick={() => confirmRebaseBranch(branch)}>⤴</button> : null}
      </span>
    </div>
  }

  const remoteRow = (remote: GitRemote): ReactNode => <div className="dsh-github-remote-row" key={remote.name}>
    <span className="dsh-github-remote-name">
      {remote.name}
      <span className="dsh-github-remote-url">{t('panel.remoteFetchUrl')}: {remote.fetchUrl}</span>
      {remote.pushUrl ? <span className="dsh-github-remote-url">{t('panel.remotePushUrl')}: {remote.pushUrl}</span> : null}
    </span>
    <span className="dsh-github-row-actions">
      <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.fetchRemote.aria', { name: remote.name })} title={t('panel.fetchRemote.aria', { name: remote.name })} onClick={() => fetchRemote(remote.name, false, false)}>↧</button>
      <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.fetchRemotePrune.aria', { name: remote.name })} title={t('panel.fetchRemotePrune.aria', { name: remote.name })} onClick={() => fetchRemote(remote.name, false, true)}>↧⌫</button>
      <button type="button" className="dsh-github-icon-btn danger" disabled={operation !== null} aria-label={`${t('panel.removeRemote')}: ${remote.name}`} title={t('panel.removeRemote')} onClick={() => confirmRemoteRemove(remote.name)}>🗑</button>
    </span>
  </div>

  const tagRow = (tag: GitTag): ReactNode => <div className="dsh-github-tag-row" key={tag.name}>
    <span className="dsh-github-branch-name">{tag.name}</span>
    <span className="dsh-github-tag-subject">{tag.subject || tag.sha}</span>
    <span className="dsh-github-row-actions">
      <button type="button" className="dsh-github-icon-btn danger" disabled={operation !== null} aria-label={`${t('panel.deleteTag')}: ${tag.name}`} title={t('panel.deleteTag')} onClick={() => confirmTagDelete(tag.name)}>🗑</button>
    </span>
  </div>

  const stashRow = (stash: GitStash): ReactNode => <div className="dsh-github-stash-row" key={stash.ref}>
    <button type="button" className="dsh-github-stash-message" onClick={() => openStashDiff(stash.ref)} title={t('panel.stashDiff')}>{stash.message}</button>
    <span className="dsh-github-stash-date">{relativeTime(stash.date, t)}</span>
    <span className="dsh-github-row-actions">
      <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.stashApply')} title={t('panel.stashApply')} onClick={() => runStatusAction('stashApply', () => actions.stashApply(path, stash.ref, false))}>▣</button>
      <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.stashApplyDrop')} title={t('panel.stashApplyDrop')} onClick={() => runStatusAction('stashApply', () => actions.stashApply(path, stash.ref, true))}>▣⤓</button>
      <button type="button" className="dsh-github-icon-btn" disabled={operation !== null} aria-label={t('panel.stashDiff')} title={t('panel.stashDiff')} onClick={() => openStashDiff(stash.ref)}>≋</button>
      <button type="button" className="dsh-github-icon-btn danger" disabled={operation !== null} aria-label={`${t('panel.stashDrop')}: ${stash.ref}`} title={t('panel.stashDrop')} onClick={() => confirmStashDrop(stash.ref)}>🗑</button>
    </span>
  </div>

  const outputRow = (entry: GitOutputEntry): ReactNode => <div className="dsh-github-output-entry" key={`${entry.at}:${entry.command}:${entry.args.join(' ')}`}>
    <div className="dsh-github-output-cmd">
      <span>{entry.command} {entry.args.join(' ')}</span>
      <span className={entry.ok ? 'ok' : 'fail'}>{entry.ok ? '✓' : '✕'}</span>
      <span className="time">{new Date(entry.at).toLocaleString()}</span>
    </div>
    {entry.output ? <pre className="dsh-github-output-text">{entry.output}</pre> : null}
  </div>

  // Mount: initial load, 3s polling while visible, and window/visibility refresh.
  useEffect(() => {
    refresh()
    const interval = window.setInterval(() => {
      if (!document.hidden && operationRef.current === null) refreshRef.current(false)
    }, 3000)
    const onFocus = (): void => { refreshRef.current(false) }
    const onVisibility = (): void => { if (document.visibilityState === 'visible') refreshRef.current(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      statusRequest.current?.controller.abort()
      for (const request of sectionRequests.current.values()) request.controller.abort()
      diffRequest.current?.controller.abort()
    }
  }, [path])

  // Lazy-load a section on first expand; commits reload (debounced) on query change.
  useEffect(() => { if (branchesExpanded) loadOverview() }, [branchesExpanded, path])
  useEffect(() => { if (remotesExpanded) loadRemotes() }, [remotesExpanded, path])
  useEffect(() => { if (tagsExpanded) loadTags() }, [tagsExpanded, path])
  useEffect(() => { if (stashesExpanded) loadStashes() }, [stashesExpanded, path])
  useEffect(() => { if (outputExpanded) loadOutput() }, [outputExpanded, path])
  useEffect(() => {
    if (!commitsExpanded) return
    const id = window.setTimeout(() => { loadCommits() }, 250)
    return () => window.clearTimeout(id)
  }, [logQuery, commitsExpanded, path])

  // Load the diff for the current view.
  useEffect(() => {
    if (view.kind === 'none') { setDiff(null); return }
    const controller = new AbortController()
    const id = ++requestId.current
    diffRequest.current = { id, controller }
    setDiff(null)
    setDiffLoading(true)
    const promise = view.kind === 'working'
      ? actions.getDiff(path, view.path, view.mode, controller.signal)
      : view.kind === 'commit'
        ? actions.showCommitDiff(path, view.sha, view.filePath, controller.signal)
        : actions.stashDiff(path, view.ref, controller.signal)
    void promise.then(result => {
      if (diffRequest.current?.id !== id) return
      if (result.ok) setDiff(result.value)
      else setError(result.error.message)
    }).catch(reason => {
      if (diffRequest.current?.id === id && !controller.signal.aborted) setError(errorMessage(reason))
    }).finally(() => {
      if (diffRequest.current?.id === id) setDiffLoading(false)
    })
    return () => controller.abort()
  }, [path, view])

  // Close the commit dropdown when clicking outside it.
  useEffect(() => {
    if (!commitMenuOpen) return
    const onDown = (event: MouseEvent): void => {
      if (commitMenuRef.current !== null && !commitMenuRef.current.contains(event.target as Node)) setCommitMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [commitMenuOpen])

  const parsedDiff = diff === null ? null : parseUnifiedDiff(diff.diff)
  const currentFile = view.kind === 'working' ? status?.files.find(file => file.path === view.path) : undefined
  const diffTitle = (() => {
    if (view.kind === 'commit' || view.kind === 'stash') return view.label
    if (view.kind !== 'working') return ''
    if (parsedDiff !== null && parsedDiff.oldPath !== null && parsedDiff.newPath !== null && parsedDiff.oldPath !== parsedDiff.newPath) return `${parsedDiff.oldPath} → ${parsedDiff.newPath}`
    return diff?.path ?? view.path
  })()
  const operationLabel = operation === null ? null : t(`panel.operation.${operation}`)

  return <section className="dsh-github-panel" role="complementary" aria-label={t('panel.title')}>
      <header className="dsh-github-panel-header">
        <div><strong>{title}</strong><small>{status?.root ?? path}</small></div>
        <div className="dsh-github-panel-actions">
          <button type="button" disabled={loading || operation !== null} onClick={() => refresh()} aria-label={t('panel.refresh')} title={t('panel.refresh')}>↻</button>
          {status?.githubUrl ? <button type="button" onClick={() => openUrl(status.githubUrl!)}>{t('panel.openGithub')}</button> : null}
        </div>
      </header>

      {status !== null && status.mergeState !== null ? <div className="dsh-github-merge-banner">
        <strong>{status.mergeState === 'merge' ? t('panel.mergeInProgress') : t('panel.rebaseInProgress')}</strong>
        {status.mergeState === 'merge' ? <>
          <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => runStatusAction('continueMerge', () => actions.continueMerge(path))}>{t('panel.continueMerge')}</button>
          <button type="button" className="dsh-github-btn danger" disabled={operation !== null} onClick={confirmAbortMerge}>{t('panel.abortMerge')}</button>
        </> : <>
          <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => runStatusAction('continueRebase', () => actions.continueRebase(path))}>{t('panel.continueRebase')}</button>
          <button type="button" className="dsh-github-btn danger" disabled={operation !== null} onClick={confirmAbortRebase}>{t('panel.abortRebase')}</button>
        </>}
      </div> : null}

      <div className="dsh-github-live" aria-live="polite">{operationLabel ?? error ?? notice ?? ''}</div>
      {error ? <p className="dsh-github-panel-error">{error}</p> : null}
      {notice ? <p className="dsh-github-panel-notice">{notice}</p> : null}
      {loading && status === null ? <p className="dsh-github-panel-message">{t('panel.loading')}</p> : null}

      {status !== null ? <div className="dsh-github-source-layout">
        <aside className="dsh-github-source-sidebar">
          <div className="dsh-github-commit-area">
            <textarea value={message} maxLength={10000} disabled={operation !== null} onChange={event => setMessage(event.target.value)} onKeyDown={commitKeyDown} placeholder={t('panel.commitPlaceholder')} aria-label={`${t('panel.commitPlaceholder')}. ${t('panel.commitShortcut')}`} rows={3} />
            <div className="dsh-github-commit-hint"><span>{t('panel.commitShortcut')}</span><span>{message.length}/10000</span></div>
            <div className="dsh-github-commit-controls">
              <label className="dsh-github-amend"><input type="checkbox" checked={amend} disabled={operation !== null} onChange={event => setAmend(event.target.checked)} />{t('panel.amend')}</label>
              <button type="button" className="dsh-github-btn primary" disabled={!canCommit} onClick={commit}>{operation === 'commit' ? t('panel.operation.commit') : t('panel.commit')}</button>
              <div className="dsh-github-dropdown" ref={commitMenuRef}>
                <button type="button" className="dsh-github-btn" aria-label={t('panel.moreCommitActions')} title={t('panel.moreCommitActions')} aria-haspopup="menu" aria-expanded={commitMenuOpen} disabled={operation !== null} onClick={() => setCommitMenuOpen(open => !open)}>⌄</button>
                {commitMenuOpen ? <div className="dsh-github-dropdown-menu" role="menu">
                  <button type="button" role="menuitem" disabled={!canCommit} onClick={() => { setCommitMenuOpen(false); commit() }}>{t('panel.commit')}</button>
                  <button type="button" role="menuitem" disabled={!canCommit || !canPush} onClick={() => { setCommitMenuOpen(false); commitThen('commitAndPush') }}>{t('panel.commitAndPush')}</button>
                  <button type="button" role="menuitem" disabled={!canCommitAndSync} onClick={() => { setCommitMenuOpen(false); commitThen('commitAndSync') }}>{t('panel.commitAndSync')}</button>
                  <button type="button" role="menuitem" className="danger" disabled={status.headSha === null || operation !== null} onClick={() => { setCommitMenuOpen(false); confirmUndoLastCommit() }}>{t('panel.undoLastCommit')}</button>
                </div> : null}
              </div>
              <span className="spacer" />
              <button type="button" className={`dsh-github-sync-btn${status.upstream === null ? ' publish' : ''}`} disabled={status.upstream === null ? !canPublish : !canSync} onClick={syncAction} aria-label={syncAria} title={syncAria}>{status.upstream === null ? t('panel.publish') : <svg className="dsh-github-sync-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}</button>
            </div>
          </div>

          {renderGroup('staged', staged, 'panel.stagedChanges', stagedExpanded, setStagedExpanded, staged.length > 0 ? <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.unstageAll')} title={t('panel.unstageAll')} onClick={() => runStatusAction('unstageAll', () => actions.unstageAll(path))}>−</button> : null)}
          {renderGroup('working', changes, 'panel.changes', changesExpanded, setChangesExpanded, changes.length > 0 ? <>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.stageAll')} title={t('panel.stageAll')} onClick={() => runStatusAction('stageAll', () => actions.stageAll(path))}>+</button>
            <button type="button" className="dsh-github-group-action danger" disabled={operation !== null} aria-label={t('panel.discardAll')} title={t('panel.discardAll')} onClick={confirmDiscardAll}>↶</button>
          </> : null)}
          {hasConflicts ? renderGroup('working', conflicts, 'panel.mergeChanges', mergeExpanded, setMergeExpanded, null) : null}
          {status.files.length === 0
            ? <div className="dsh-github-clean-hint">
              <p className="dsh-github-panel-message compact">{t('panel.clean')}</p>
              {status.headSha !== null
                ? <button type="button" className="dsh-github-btn" onClick={() => revealLatestCommit(status.headSha!)}>{t('panel.viewLatestCommit')}</button>
                : null}
            </div>
            : null}
          {status.truncated ? <p className="dsh-github-panel-message compact">{t('panel.fileListTruncated')}</p> : null}

          <Section title={t('panel.commits')} count={log?.commits.length ?? 0} expanded={commitsExpanded} onToggle={() => setCommitsExpanded(value => !value)}>
            <input className="dsh-github-search" value={logQuery} onChange={event => setLogQuery(event.target.value)} placeholder={t('panel.searchCommits')} aria-label={t('panel.searchCommits')} />
            {log === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : log.commits.length === 0 ? <p className="dsh-github-section-empty">{t('panel.commitsEmpty')}</p> : log.commits.map(commitRow)}
          </Section>

          <Section title={t('panel.branches')} count={overview?.branches.length ?? 0} expanded={branchesExpanded} onToggle={() => setBranchesExpanded(value => !value)} actions={<button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.createBranch')} title={t('panel.createBranch')} onClick={promptCreateBranch}>+</button>}>
            {overview === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : overview.branches.length === 0 ? <p className="dsh-github-section-empty">{t('panel.branchesEmpty')}</p> : overview.branches.map(branchRow)}
          </Section>

          <Section title={t('panel.remotes')} count={remotes?.remotes.length ?? 0} expanded={remotesExpanded} onToggle={() => setRemotesExpanded(value => !value)} actions={<>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.fetchAll')} title={t('panel.fetchAll')} onClick={() => fetchRemote('', true, false)}>⇓</button>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.fetchAllPrune')} title={t('panel.fetchAllPrune')} onClick={() => fetchRemote('', true, true)}>⇓⌫</button>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.addRemote')} title={t('panel.addRemote')} onClick={promptAddRemote}>+</button>
          </>}>
            {remotes === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : remotes.remotes.length === 0 ? <p className="dsh-github-section-empty">{t('panel.remotesEmpty')}</p> : remotes.remotes.map(remoteRow)}
          </Section>

          <Section title={t('panel.tags')} count={tags?.tags.length ?? 0} expanded={tagsExpanded} onToggle={() => setTagsExpanded(value => !value)} actions={<>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.pushTags')} title={t('panel.pushTags')} onClick={() => runStatusAction('pushTags', () => actions.pushTags(path))}>⇑</button>
            <button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.createTag')} title={t('panel.createTag')} onClick={() => promptCreateTag('')}>+</button>
          </>}>
            {tags === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : tags.tags.length === 0 ? <p className="dsh-github-section-empty">{t('panel.tagsEmpty')}</p> : tags.tags.map(tagRow)}
          </Section>

          <Section title={t('panel.stashes')} count={stashes?.stashes.length ?? 0} expanded={stashesExpanded} onToggle={() => setStashesExpanded(value => !value)} actions={<button type="button" className="dsh-github-group-action" disabled={operation !== null} aria-label={t('panel.createStash')} title={t('panel.createStash')} onClick={promptCreateStash}>+</button>}>
            {stashes === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : stashes.stashes.length === 0 ? <p className="dsh-github-section-empty">{t('panel.stashesEmpty')}</p> : stashes.stashes.map(stashRow)}
          </Section>

          <Section title={t('panel.gitOutput')} count={output?.entries.length ?? 0} expanded={outputExpanded} onToggle={() => setOutputExpanded(value => !value)}>
            {output === null ? <p className="dsh-github-panel-message compact">{t('panel.loading')}</p> : output.entries.length === 0 ? <p className="dsh-github-section-empty">{t('panel.output.empty')}</p> : output.entries.map(outputRow)}
          </Section>
        </aside>

        <article className="dsh-github-diff-view">
          {view.kind === 'none' ? <p className="dsh-github-empty">{t('panel.selectFile')}</p> : <>
            <div className="dsh-github-diff-header">
              <span className="dsh-github-diff-path">
                {diffTitle}
                {view.kind === 'working' ? <small> {view.mode === 'staged' ? t('panel.staged') : t('panel.workingTree')}</small> : null}
                {parsedDiff !== null && parsedDiff.isBinary ? <small> ({t('panel.diff.binary')})</small> : null}
              </span>
              {view.kind !== 'working' ? <button type="button" className="dsh-github-btn" onClick={() => setView({ kind: 'none' })}>{t('panel.backToChanges')}</button> : null}
              {view.kind === 'working' && currentFile?.kind === 'conflict' ? <>
                <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={resolveCurrent}>{t('panel.acceptCurrent')}</button>
                <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => resolveConflict(currentFile, 'theirs')}>{t('panel.acceptIncoming')}</button>
                <button type="button" className="dsh-github-btn" disabled={operation !== null} onClick={() => resolveConflict(currentFile, 'both')}>{t('panel.acceptBoth')}</button>
              </> : null}
              <div className="dsh-github-diff-toggle" role="group" aria-label={t('panel.diff.sideBySide')}>
                <button type="button" className={diffStyle === 'side' ? 'active' : ''} aria-pressed={diffStyle === 'side'} onClick={() => setDiffStyle('side')}>{t('panel.diff.sideBySide')}</button>
                <button type="button" className={diffStyle === 'inline' ? 'active' : ''} aria-pressed={diffStyle === 'inline'} onClick={() => setDiffStyle('inline')}>{t('panel.diff.inline')}</button>
              </div>
            </div>
            <div className="dsh-github-diff-body">
              {diffLoading ? <p className="dsh-github-empty">{t('panel.loadingDiff')}</p> : parsedDiff === null ? <p className="dsh-github-empty">{t('panel.loadingDiff')}</p> : parsedDiff.empty ? <p className="dsh-github-empty">{t('panel.noDiff')}</p> : parsedDiff.isBinary ? <p className="dsh-github-diff-binary">{parsedDiff.binaryMessage ?? t('panel.diff.binary')}</p> : diffStyle === 'side' ? <SideBySideDiff parsed={parsedDiff} noNewlineLabel={t('panel.diff.noNewline')} /> : <InlineDiff parsed={parsedDiff} noNewlineLabel={t('panel.diff.noNewline')} />}
              {diff?.truncated ? <p className="dsh-github-empty">{t('panel.truncated')}</p> : null}
            </div>
          </>}
        </article>
      </div> : null}

      {confirm !== null ? <ConfirmModal title={t('panel.confirm.title')} message={confirm.message} detail={confirm.detail} fields={confirm.fields} confirmLabel={t('panel.confirm.confirm')} cancelLabel={t('panel.confirm.cancel')} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} /> : null}
  </section>
}
