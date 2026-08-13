import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { GitDiff, GitDiffMode, GitFileChange, GitRepositoryOverview, GitStatus } from '../types.ts'
import type { DshGithubKey } from './locales.ts'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
type SelectedChange = { path: string; mode: GitDiffMode }
type Operation = 'stage' | 'unstage' | 'stageAll' | 'unstageAll' | 'commit' | 'commitAndPush' | 'push' | 'fetch' | 'pull' | 'sync' | 'checkoutBranch' | 'createBranch' | null

/** Browser-side operations used by the Source Control panel. */
export interface GithubPanelActions {
  getStatus: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  getDiff: (path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal) => Promise<RemoteResult<GitDiff>>
  stage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  unstage: (path: string, filePath: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  stageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  unstageAll: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  commit: (path: string, message: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  push: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  fetch: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  pull: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  sync: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  checkoutBranch: (path: string, branch: string, remote: boolean, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  createBranch: (path: string, branch: string, signal?: AbortSignal) => Promise<RemoteResult<GitStatus>>
  getRepositoryOverview: (path: string, signal?: AbortSignal) => Promise<RemoteResult<GitRepositoryOverview>>
  openFile: (root: string, filePath: string) => Promise<void>
}

function errorMessage(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason) }
function badge(file: GitFileChange): string { return file.kind === 'untracked' ? 'U' : file.kind === 'deleted' ? 'D' : file.kind === 'added' ? 'A' : file.kind === 'renamed' ? 'R' : file.kind === 'copied' ? 'C' : file.kind === 'conflict' ? '!' : 'M' }
function hasMode(file: GitFileChange, mode: GitDiffMode): boolean { return mode === 'staged' ? file.index !== ' ' && file.index !== '?' : file.worktree !== ' ' || file.kind === 'untracked' }

/** Render the local Source Control and pull-request panel. */
export function GithubChangesPanel({ path, title, actions, t, onClose }: {
  path: string
  title: string
  actions: GithubPanelActions
  t: (key: DshGithubKey, params?: Record<string, string>) => string
  onClose: () => void
}) {
  const [tab, setTab] = useState<'changes' | 'repository'>('changes')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [overview, setOverview] = useState<GitRepositoryOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedChange | null>(null)
  const [diff, setDiff] = useState<GitDiff | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [operation, setOperation] = useState<Operation>(null)
  const [stagedExpanded, setStagedExpanded] = useState(true)
  const [workingExpanded, setWorkingExpanded] = useState(true)
  const [untrackedExpanded, setUntrackedExpanded] = useState(true)
  const [conflictsExpanded, setConflictsExpanded] = useState(true)
  const [newBranch, setNewBranch] = useState('')
  const statusRequest = useRef<{ id: number; controller: AbortController } | null>(null)
  const overviewRequest = useRef<{ id: number; controller: AbortController } | null>(null)
  const requestId = useRef(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const acceptStatus = (next: GitStatus): void => {
    setStatus(next)
    setSelected(current => {
      if (current === null) return null
      const file = next.files.find(candidate => candidate.path === current.path)
      if (file === undefined) return null
      if (hasMode(file, current.mode)) return current
      const otherMode = current.mode === 'staged' ? 'working' : 'staged'
      return hasMode(file, otherMode) ? { path: current.path, mode: otherMode } : null
    })
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
    }).catch(reason => {
      if (request.id === statusRequest.current?.id && !request.controller.signal.aborted) setError(errorMessage(reason))
    }).finally(() => {
      if (request.id === statusRequest.current?.id) setLoading(false)
    })
  }

  const refreshOverview = (): void => {
    overviewRequest.current?.controller.abort()
    const request = { id: ++requestId.current, controller: new AbortController() }
    overviewRequest.current = request
    setOverviewLoading(true)
    setError(null)
    void actions.getRepositoryOverview(path, request.controller.signal).then(result => {
      if (request.id !== overviewRequest.current?.id) return
      if (!result.ok) throw new Error(result.error.message)
      setOverview(result.value)
    }).catch(reason => {
      if (request.id === overviewRequest.current?.id && !request.controller.signal.aborted) setError(errorMessage(reason))
    }).finally(() => {
      if (request.id === overviewRequest.current?.id) setOverviewLoading(false)
    })
  }

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    refresh()
    closeButtonRef.current?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const onFocus = (): void => {
      refresh(false)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') onFocus()
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      statusRequest.current?.controller.abort()
      overviewRequest.current?.controller.abort()
      previousFocus.current?.focus()
    }
  }, [path, onClose])
  useEffect(() => { if (tab === 'repository') refreshOverview() }, [path, tab])
  const selectedFile = selected === null ? undefined : status?.files.find(file => file.path === selected.path)
  const selectedFileSignature = selectedFile === undefined ? '' : `${selectedFile.index}:${selectedFile.worktree}:${selectedFile.kind}`
  useEffect(() => {
    if (selected === null) { setDiff(null); return }
    const controller = new AbortController()
    setDiff(null)
    void actions.getDiff(path, selected.path, selected.mode, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setDiff(result.value)
      else setError(result.error.message)
    }).catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [path, selected?.path, selected?.mode, selectedFileSignature])

  const runStatusAction = (name: Exclude<Operation, null>, action: () => Promise<RemoteResult<GitStatus>>, clearMessage = false): void => {
    setOperation(name)
    setError(null)
    setNotice(null)
    void action().then(result => {
      if (!result.ok) throw new Error(result.error.message)
      acceptStatus(result.value)
      if (name === 'checkoutBranch' || name === 'createBranch') void refreshOverview()
      if (clearMessage) setMessage('')
      setNotice(t(`panel.success.${name}`))
    }).catch(reason => {
      setNotice(null)
      setError(errorMessage(reason))
      refresh(false)
      if (name === 'checkoutBranch' || name === 'createBranch') void refreshOverview()
    }).finally(() => setOperation(null))
  }

  const commitAndPush = (): void => {
    if (!canCommit || !canPush) return
    setOperation('commitAndPush')
    setError(null)
    setNotice(null)
    let committed = false
    void actions.commit(path, message.trim()).then(result => {
      if (!result.ok) throw new Error(result.error.message)
      committed = true
      acceptStatus(result.value)
      setMessage('')
      return actions.push(path)
    }).then(result => {
      if (!result.ok) throw new Error(result.error.message)
      acceptStatus(result.value)
      setNotice(t('panel.success.commitAndPush'))
    }).catch(reason => {
      setNotice(null)
      const detail = errorMessage(reason)
      setError(committed ? `${t('panel.commitCreatedPushFailed')} ${detail}` : detail)
      refresh(false)
    }).finally(() => setOperation(null))
  }

  const conflicts = status?.files.filter(file => file.kind === 'conflict') ?? []
  const staged = status?.files.filter(file => file.kind !== 'conflict' && hasMode(file, 'staged')) ?? []
  const workingFiles = status?.files.filter(file => file.kind !== 'conflict' && hasMode(file, 'working')) ?? []
  const untracked = workingFiles.filter(file => file.kind === 'untracked')
  const working = workingFiles.filter(file => file.kind !== 'untracked')
  const canCommit = operation === null && message.trim() !== '' && staged.length > 0
  const canFetch = operation === null && status !== null && status.remoteName !== null && !status.branch.startsWith('HEAD ')
  const canPush = operation === null && status !== null && status.pushRemoteName !== null && !status.branch.startsWith('HEAD ')
  const primaryOperation: 'fetch' | 'sync' | null = status?.upstream === null ? 'sync' : status?.ahead !== 0 || status?.behind !== 0 ? 'sync' : 'fetch'
  const openUrl = (url: string): void => { window.open(url, '_blank', 'noopener,noreferrer') }
  const commit = (): void => { if (canCommit) runStatusAction('commit', () => actions.commit(path, message.trim()), true) }
  const commitKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
    event.preventDefault()
    commit()
  }

  const createBranch = (): void => {
    const branch = newBranch.trim()
    if (operation !== null || branch === '') return
    runStatusAction('createBranch', () => actions.createBranch(path, branch), true)
    setNewBranch('')
  }

  const changeRow = (file: GitFileChange, mode: GitDiffMode) => <div className={`dsh-github-change-row ${selected?.path === file.path && selected.mode === mode ? 'selected' : ''}`} key={`${mode}:${file.path}`}>
    <button type="button" className="dsh-github-change-main" onClick={() => setSelected({ path: file.path, mode })}>
      <span className={`kind kind-${file.kind}`}>{badge(file)}</span><span className="dsh-github-change-path" title={file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}><span>{file.path}</span>{file.previousPath ? <small>{file.previousPath} ←</small> : null}</span>
    </button>
    <button type="button" className="dsh-github-change-open" disabled={file.kind === 'deleted'} aria-label={`${t('panel.openFile')}: ${file.path}`} title={t('panel.openFile')} onClick={() => { void actions.openFile(status?.root ?? path, file.path).catch(reason => setError(errorMessage(reason))) }}>⌕</button>{file.fileUrl ? <button type="button" className="dsh-github-change-open" aria-label={`${t('panel.openFileOnGithub')}: ${file.path}`} title={t('panel.openFileOnGithub')} onClick={() => openUrl(file.fileUrl!)}>↗</button> : null}
    {file.kind !== 'conflict' ? <button type="button" className="dsh-github-change-action" disabled={operation !== null} aria-label={mode === 'staged' ? t('panel.unstage') : t('panel.stage')} title={mode === 'staged' ? t('panel.unstage') : t('panel.stage')} onClick={() => runStatusAction(mode === 'staged' ? 'unstage' : 'stage', () => mode === 'staged' ? actions.unstage(path, file.path) : actions.stage(path, file.path))}>{mode === 'staged' ? '−' : '+'}</button> : null}
  </div>

  const group = (mode: GitDiffMode, files: GitFileChange[], title: DshGithubKey, expanded: boolean, setExpanded: (value: boolean) => void) => <section className="dsh-github-change-group">
    <div className="dsh-github-change-group-header">
      <button type="button" className="dsh-github-group-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span>{expanded ? '⌄' : '›'}</span>{t(title)} <b>{files.length}</b></button>
      {files.length > 0 ? <button type="button" className="dsh-github-group-action" disabled={operation !== null} onClick={() => runStatusAction(mode === 'staged' ? 'unstageAll' : 'stageAll', () => mode === 'staged' ? actions.unstageAll(path) : actions.stageAll(path))}>{mode === 'staged' ? t('panel.unstageAll') : t('panel.stageAll')}</button> : null}
    </div>
    {expanded ? files.map(file => changeRow(file, mode)) : null}
  </section>

  const operationLabel = operation === null ? null : t(`panel.operation.${operation}`)

  return <div className="dsh-github-panel-root" role="dialog" aria-modal="true" aria-label={t('panel.title')}>
    <div className="dsh-github-panel-mask" aria-hidden="true" onClick={onClose} />
    <section className="dsh-github-panel" tabIndex={-1}>
      <header className="dsh-github-panel-header">
        <div><strong>{title}</strong><small>{status?.root ?? path}</small></div>
        <div className="dsh-github-panel-actions">
          <button type="button" disabled={loading || overviewLoading || operation !== null} onClick={() => { if (tab === 'changes') refresh(); else refreshOverview() }} aria-label={t('panel.refresh')} title={t('panel.refresh')}>↻</button>
          {status?.githubUrl ? <button type="button" onClick={() => openUrl(status.githubUrl!)}>{t('panel.openGithub')}</button> : null}
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t('panel.close')} title={t('panel.close')}>×</button>
        </div>
      </header>
      <div className="dsh-github-tabs" role="tablist" aria-label={t('panel.title')}>
        <button id="dsh-github-tab-changes" type="button" role="tab" aria-controls="dsh-github-tabpanel-changes" aria-selected={tab === 'changes'} className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>{t('panel.sourceControl')}{status && status.files.length > 0 ? <span className="dsh-github-tab-count">{status.files.length}</span> : null}</button>
        <button id="dsh-github-tab-repository" type="button" role="tab" aria-controls="dsh-github-tabpanel-repository" aria-selected={tab === 'repository'} className={tab === 'repository' ? 'active' : ''} onClick={() => setTab('repository')}>{t('panel.repository')}</button>
      </div>
      {status ? <div className="dsh-github-panel-meta"><span>⑂ {status.branch}</span>{status.remoteName ? <span>{status.remoteName}</span> : null}{status.pushRemoteName && status.pushRemoteName !== status.remoteName ? <span>{t('panel.pushRemote', { name: status.pushRemoteName })}</span> : null}{status.upstream ? <span>↑ {status.ahead} · ↓ {status.behind}</span> : <span>{t('panel.noUpstream')}</span>}<span>{status.files.length} {t('panel.filesChanged')}</span>{operationLabel ? <strong>{operationLabel}</strong> : null}</div> : null}
      <div className="dsh-github-live" aria-live="polite">{operationLabel ?? error ?? notice ?? ''}</div>
      {error ? <p className="dsh-github-panel-error">{error}</p> : null}
      {loading ? <p className="dsh-github-panel-message">{t('panel.loading')}</p> : null}

      {!loading && status && tab === 'changes' ? <div id="dsh-github-tabpanel-changes" role="tabpanel" aria-labelledby="dsh-github-tab-changes" className="dsh-github-source-layout">
        <aside className="dsh-github-source-sidebar">
          <textarea value={message} maxLength={10_000} disabled={operation !== null} onChange={event => setMessage(event.target.value)} onKeyDown={commitKeyDown} placeholder={t('panel.commitPlaceholder')} aria-label={`${t('panel.commitPlaceholder')}. ${t('panel.commitShortcut')}`} rows={3} />
          <div className="dsh-github-commit-hint"><span>{t('panel.commitShortcut')}</span><span>{message.length}/10000</span></div>
          <div className="dsh-github-primary-actions">
            <button type="button" className="primary" disabled={!canCommit} onClick={commit}>{operation === 'commit' ? t('panel.operation.commit') : t('panel.commit')}</button>
            <button type="button" disabled={!canPush} onClick={() => runStatusAction('push', () => actions.push(path))}>{operation === 'push' ? t('panel.operation.push') : t('panel.push')}{operation !== 'push' && status.ahead > 0 ? ` (${status.ahead})` : ''}</button>
            <button type="button" disabled={!canCommit || !canPush} onClick={commitAndPush}>{operation === 'commitAndPush' || operation === 'push' ? t('panel.operation.commitAndPush') : t('panel.commitAndPush')}</button>
          </div>
          <div className="dsh-github-secondary-actions">
            <button type="button" disabled={!canFetch} onClick={() => runStatusAction('fetch', () => actions.fetch(path))}>{operation === 'fetch' ? t('panel.operation.fetch') : t('panel.fetch')}</button>
            <button type="button" disabled={!canFetch || status.upstream === null || status.behind === 0} onClick={() => runStatusAction('pull', () => actions.pull(path))}>{operation === 'pull' ? t('panel.operation.pull') : t('panel.pull')}</button>
            <button type="button" className="primary" disabled={(primaryOperation === 'sync' ? !canPush : !canFetch) || operation !== null} onClick={() => runStatusAction(primaryOperation ?? 'fetch', () => primaryOperation === 'sync' ? actions.sync(path) : actions.fetch(path))}>{primaryOperation === 'sync' ? (status.upstream === null ? t('panel.publishBranch') : t('panel.syncChanges')) : t('panel.fetch')}</button>
          </div>
          {group('staged', staged, 'panel.stagedChanges', stagedExpanded, setStagedExpanded)}
          {group('working', working, 'panel.changes', workingExpanded, setWorkingExpanded)}
          {group('working', untracked, 'panel.untrackedChanges', untrackedExpanded, setUntrackedExpanded)}
          {conflicts.length > 0 ? <section className="dsh-github-change-group dsh-github-conflict-group">
            <div className="dsh-github-change-group-header">
              <button type="button" className="dsh-github-group-toggle" aria-expanded={conflictsExpanded} onClick={() => setConflictsExpanded(!conflictsExpanded)}><span>{conflictsExpanded ? '⌄' : '›'}</span>{t('panel.mergeChanges')} <b>{conflicts.length}</b></button>
            </div>
            {conflictsExpanded ? conflicts.map(file => changeRow(file, 'working')) : null}
          </section> : null}
          {status.files.length === 0 ? <p className="dsh-github-panel-message compact">{t('panel.clean')}</p> : null}
          {status.truncated ? <p className="dsh-github-panel-message compact">{t('panel.fileListTruncated')}</p> : null}
        </aside>
        <article className="dsh-github-diff-view">
          {selected === null ? <p className="dsh-github-empty">{t('panel.selectFile')}</p> : diff === null ? <p className="dsh-github-panel-message">{t('panel.loadingDiff')}</p> : <><h3>{diff.path} <small>{selected.mode === 'staged' ? t('panel.staged') : t('panel.workingTree')}</small></h3><pre>{diff.diff || t('panel.noDiff')}{diff.truncated ? `\n\n${t('panel.truncated')}` : ''}</pre></>}
        </article>
      </div> : null}

      {!loading && status && tab === 'repository' ? <div id="dsh-github-tabpanel-repository" role="tabpanel" aria-labelledby="dsh-github-tab-repository" className="dsh-github-overview">
        {overviewLoading ? <p className="dsh-github-panel-message">{t('panel.loadingRepository')}</p> : null}
        {overview ? <>
          <section><h2>{t('panel.branches')} <span>{overview.branches.length}</span></h2>
            <div className="dsh-github-branch-create"><input value={newBranch} maxLength={255} placeholder={t('panel.newBranchPlaceholder')} aria-label={t('panel.newBranchPlaceholder')} onChange={event => setNewBranch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createBranch() }} /><button type="button" disabled={operation !== null || newBranch.trim() === ''} onClick={createBranch}>{operation === 'createBranch' ? t('panel.operation.createBranch') : t('panel.createBranch')}</button></div>
            <div className="dsh-github-branch-groups">{(['local', 'remote'] as const).map(kind => {
              const branches = overview.branches.filter(branch => branch.remote === (kind === 'remote'))
              if (branches.length === 0) return null
              return <section className="dsh-github-branch-group" key={kind}><h3>{kind === 'local' ? t('panel.localBranches') : t('panel.remoteBranches')}</h3><div className="dsh-github-card-list">{branches.map(branch => <div className={`dsh-github-branch-card ${branch.current ? 'current' : ''}`} key={`${branch.remote ? 'remote' : 'local'}:${branch.name}`}><button type="button" className="dsh-github-branch-switch" disabled={operation !== null || branch.current} onClick={() => runStatusAction('checkoutBranch', () => actions.checkoutBranch(path, branch.name, branch.remote))}><strong>{branch.name}</strong><small>{branch.current ? t('panel.currentBranch') : branch.remote ? t('panel.remoteBranch', { name: overview.remoteName ?? t('panel.remote') }) : branch.upstream ?? t('panel.localBranch')}</small></button>{branch.branchUrl ? <a className="dsh-github-branch-link" href={branch.branchUrl} target="_blank" rel="noreferrer" aria-label={`${t('panel.openBranch')}: ${branch.name}`}>↗</a> : null}</div>)}</div></section>
            })}</div>
          </section>
          <section><h2>{t('panel.githubLinks')}</h2>
            {overview.githubUrl ? <button type="button" className="dsh-github-link-button" onClick={() => openUrl(overview.githubUrl!)}>{t('panel.openGithub')}</button> : null}
            {status.commitUrl ? <button type="button" className="dsh-github-link-button" onClick={() => openUrl(status.commitUrl!)}>{t('panel.openCommit')}</button> : null}
            {overview.compareUrl ? <button type="button" className="dsh-github-link-button" onClick={() => openUrl(overview.compareUrl!)}>{t('panel.openCompare')}</button> : null}
            {!overview.githubUrl ? <p className="dsh-github-panel-message compact">{t('panel.noGithubRemote')}</p> : null}
          </section>
        </> : null}
      </div> : null}
    </section>
  </div>
}

/** Install the panel stylesheet once. */
export function adoptPanelStyles(): void {
  if (document.getElementById('dsh-github-panel-styles') !== null) return
  const style = document.createElement('style')
  style.id = 'dsh-github-panel-styles'
  style.textContent = `.dsh-github-panel-root{position:fixed;inset:0;z-index:2000;display:flex;justify-content:flex-end}.dsh-github-panel-mask{position:absolute;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(1px)}.dsh-github-panel{position:relative;width:min(980px,100vw);height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:-8px 0 30px rgba(0,0,0,.2);color:var(--dsw-alias-label-primary,#111)}.dsh-github-panel button,.dsh-github-panel textarea{font:inherit}.dsh-github-panel button:focus-visible,.dsh-github-panel textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px}.dsh-github-panel-header{display:flex;justify-content:space-between;gap:12px;padding:18px 22px 14px}.dsh-github-panel-header strong,.dsh-github-panel-header small{display:block}.dsh-github-panel-header small{margin-top:5px;color:var(--dsw-alias-label-tertiary,#777);font:12px ui-monospace,monospace;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-github-panel-actions,.dsh-github-primary-actions,.dsh-github-secondary-actions{display:flex;gap:8px}.dsh-github-panel-actions button,.dsh-github-primary-actions button,.dsh-github-secondary-actions button{border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;padding:7px 11px;background:transparent;color:inherit;cursor:pointer}.dsh-github-panel button:disabled{opacity:.45;cursor:not-allowed}.dsh-github-tabs{display:flex;padding:0 22px;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd)}.dsh-github-tabs button{display:flex;align-items:center;gap:7px;border:0;border-bottom:2px solid transparent;padding:10px 2px;margin-right:24px;background:transparent;color:var(--dsw-alias-label-secondary,#555);cursor:pointer}.dsh-github-tabs button.active{border-bottom-color:var(--dsw-alias-brand-primary,#2563eb);color:inherit;font-weight:600}.dsh-github-tab-count{min-width:18px;padding:1px 5px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover,#eee);font-size:11px}.dsh-github-panel-meta{display:flex;gap:16px;padding:9px 22px;color:var(--dsw-alias-label-secondary,#555);font:12px ui-monospace,monospace;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd)}.dsh-github-panel-meta strong{margin-left:auto;color:var(--dsw-alias-brand-primary,#2563eb)}.dsh-github-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.dsh-github-source-layout{min-height:0;flex:1;display:grid;grid-template-columns:minmax(300px,36%) 1fr}.dsh-github-source-sidebar{overflow:auto;padding:14px;border-right:1px solid var(--dsw-alias-border-l2,#ddd)}.dsh-github-source-sidebar textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:6px;padding:9px 10px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;outline:none}.dsh-github-commit-hint{display:flex;justify-content:space-between;margin-top:4px;color:var(--dsw-alias-label-tertiary,#777);font-size:11px}.dsh-github-primary-actions{margin:8px 0 8px}.dsh-github-primary-actions button,.dsh-github-secondary-actions button{flex:1}.dsh-github-secondary-actions{margin-bottom:16px}.dsh-github-secondary-actions button{font-size:12px;padding:6px 8px}.dsh-github-primary-actions .primary,.dsh-github-secondary-actions .primary{border-color:var(--dsw-alias-brand-primary,#2563eb);background:var(--dsw-alias-brand-primary,#2563eb);color:#fff}.dsh-github-change-group{margin:0 0 14px}.dsh-github-change-group-header,.dsh-github-overview h2{display:flex;align-items:center;justify-content:space-between;color:var(--dsw-alias-label-secondary,#555);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.dsh-github-group-toggle,.dsh-github-group-action{border:0;background:transparent;color:inherit;cursor:pointer}.dsh-github-group-toggle{min-width:0;flex:1;display:flex;align-items:center;gap:6px;padding:7px 8px;text-align:left;text-transform:inherit;letter-spacing:inherit}.dsh-github-group-toggle b{min-width:18px;padding:1px 5px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,#eee);font-size:10px;text-align:center}.dsh-github-group-action{padding:5px 8px;text-transform:none;letter-spacing:normal}.dsh-github-group-action:hover{text-decoration:underline}.dsh-github-change-row{display:flex;border-radius:6px}.dsh-github-change-row:hover,.dsh-github-change-row.selected{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dsh-github-change-main{min-width:0;flex:1;display:flex;align-items:center;gap:8px;border:0;padding:7px 8px;background:transparent;color:inherit;text-align:left;cursor:pointer}.dsh-github-change-path{min-width:0;display:flex;flex-direction:column;overflow:hidden;font:13px ui-monospace,monospace}.dsh-github-change-path>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-github-change-path small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#777);font:10px ui-monospace,monospace}.dsh-github-change-open{width:32px;border:0;border-radius:4px;background:transparent;color:inherit;font-size:15px;cursor:pointer}.dsh-github-change-open{width:32px;border:0;border-radius:4px;background:transparent;color:inherit;font-size:15px;cursor:pointer}.dsh-github-change-action{width:32px;border:0;background:transparent;color:inherit;font-size:19px;cursor:pointer}.kind{width:16px;flex:none;font-weight:700}.kind-untracked{color:#b7791f}.kind-deleted{color:#c53030}.kind-added{color:#2f855a}.kind-renamed{color:#805ad5}.kind-copied{color:#805ad5}.kind-conflict{color:#c53030}.kind-modified{color:#3182ce}.dsh-github-diff-view{min-width:0;overflow:auto;padding:18px 22px}.dsh-github-diff-view h3{margin:0 0 12px;font:600 13px ui-monospace,monospace}.dsh-github-diff-view h3 small{margin-left:8px;color:var(--dsw-alias-label-tertiary,#777);font-weight:400}.dsh-github-diff-view pre{margin:0;padding:14px;overflow:auto;border-radius:8px;background:#111827;color:#e5e7eb;font:12px/1.6 ui-monospace,SFMono-Regular,monospace;white-space:pre}.dsh-github-empty{display:grid;height:100%;place-items:center;color:var(--dsw-alias-label-tertiary,#777)}.dsh-github-overview{min-height:0;overflow:auto;padding:18px 22px}.dsh-github-overview section{margin-bottom:24px}.dsh-github-overview h2{margin:0;padding:7px 8px}.dsh-github-card-list{display:grid;gap:7px}.dsh-github-branch-groups{display:grid;gap:18px}.dsh-github-branch-group h3{margin:0 8px 6px;color:var(--dsw-alias-label-tertiary,#777);font-size:11px;text-transform:uppercase;letter-spacing:.04em}.dsh-github-branch-create{display:flex;gap:7px;margin:0 8px 10px}.dsh-github-branch-create input{min-width:0;flex:1;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:6px;padding:8px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit}.dsh-github-branch-create button,.dsh-github-link-button{border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:6px;padding:7px 10px;background:transparent;color:inherit;cursor:pointer}.dsh-github-link-button{margin:0 8px 10px}.dsh-github-branch-card{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:7px;padding:10px 12px;background:transparent;color:inherit;text-align:left}.dsh-github-branch-switch{min-width:0;flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:4px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.dsh-github-branch-link{flex:none;color:inherit;text-decoration:none;font-size:18px}.dsh-github-branch-link:hover{text-decoration:underline}.dsh-github-branch-card.current{border-left:3px solid var(--dsw-alias-brand-primary,#2563eb)}.dsh-github-branch-card small{color:var(--dsw-alias-label-tertiary,#777);font-size:12px}.dsh-github-panel-message,.dsh-github-panel-error{padding:18px 22px}.dsh-github-panel-message.compact,.dsh-github-panel-error.compact{padding:8px}.dsh-github-panel-error{margin:0;color:#c53030;background:rgba(197,48,48,.06)}@media(max-width:720px){.dsh-github-source-layout{grid-template-columns:1fr}.dsh-github-source-sidebar{max-height:52%;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2,#ddd)}}`
  document.head.appendChild(style)
}
