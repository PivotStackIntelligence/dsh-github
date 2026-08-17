/**
 * dsh-github persistent Source Control sidebar: a narrow activity rail pinned
 * to the right edge that expands into the full SCM panel. Workspace selection
 * and expand/collapse persist to localStorage; the workspace list is read
 * from the workspaces observable snapshot.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ObservableSnapshot, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { GithubChangesPanel, type GithubPanelActions } from './panel.tsx'
import type { DshGithubKey } from './locales.ts'

const EXPANDED_KEY = 'dsh-github.sidebar.expanded'
const WORKSPACE_KEY = 'dsh-github.sidebar.workspaceId'

function readExpanded(): boolean {
  try { return localStorage.getItem(EXPANDED_KEY) === '1' } catch { return false }
}
function persistExpanded(expanded: boolean): void {
  try { localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0') } catch { /* ignore */ }
}
function readWorkspaceId(): WorkspaceId | null {
  try {
    const value = localStorage.getItem(WORKSPACE_KEY)
    return value === null || value === '' ? null : value as WorkspaceId
  } catch { return null }
}
function persistWorkspaceId(id: WorkspaceId): void {
  try { localStorage.setItem(WORKSPACE_KEY, String(id)) } catch { /* ignore */ }
}

export interface SourceControlSidebarProps {
  actions: GithubPanelActions
  t: (key: DshGithubKey, params?: Record<string, string>) => string
  list: ObservableSnapshot<WorkspaceListState>
}

/** Persistent right-edge rail that expands into the Source Control panel. */
export function SourceControlSidebar({ actions, t, list }: SourceControlSidebarProps) {
  const [expanded, setExpanded] = useState<boolean>(() => readExpanded())
  const [selectedId, setSelectedId] = useState<WorkspaceId | null>(() => readWorkspaceId())
  const [items, setItems] = useState<readonly WorkspaceView[]>(() => list.getSnapshot().items)
  const [recentId, setRecentId] = useState<WorkspaceId | undefined>(() => list.getSnapshot().recentWorkspaceId)
  const railRef = useRef<HTMLButtonElement>(null)
  const prevExpanded = useRef(expanded)

  useEffect(() => list.subscribe(() => {
    const snapshot = list.getSnapshot()
    setItems(snapshot.items)
    setRecentId(snapshot.recentWorkspaceId)
  }), [list])

  const selected = useMemo<WorkspaceView | null>(() => {
    if (items.length === 0) return null
    if (selectedId !== null) {
      const match = items.find(workspace => workspace.workspaceId === selectedId)
      if (match !== undefined) return match
    }
    if (recentId !== undefined) {
      const match = items.find(workspace => workspace.workspaceId === recentId)
      if (match !== undefined) return match
    }
    return items[0] ?? null
  }, [items, selectedId, recentId])

  const expand = (): void => { setExpanded(true); persistExpanded(true) }
  const collapse = (): void => { setExpanded(false); persistExpanded(false) }
  const selectWorkspace = (id: WorkspaceId): void => { setSelectedId(id); persistWorkspaceId(id) }

  // Return focus to the rail button when the panel collapses (true -> false).
  useEffect(() => {
    if (prevExpanded.current && !expanded) railRef.current?.focus()
    prevExpanded.current = expanded
  }, [expanded])

  return <div className="dsh-github-sidebar">
    {expanded
      ? <div className="dsh-github-sidebar-expanded">
        {selected === null
          ? <div className="dsh-github-sidebar-empty"><p>{t('panel.noWorkspace')}</p></div>
          : <GithubChangesPanel
            key={selected.workspaceId}
            path={selected.path}
            actions={actions}
            t={t}
            onCollapse={collapse}
            workspaces={items}
            workspaceId={selected.workspaceId}
            onSelectWorkspace={selectWorkspace}
          />}
      </div>
      : <div className="dsh-github-sidebar-rail">
        <button ref={railRef} type="button" className="dsh-github-sidebar-rail-btn" onClick={expand} aria-label={t('rail.expand')} title={t('rail.expand')} aria-expanded={false}>
          <span className="dsh-github-sidebar-rail-icon" aria-hidden="true">⑂</span>
          <span className="dsh-github-sidebar-rail-label">{t('panel.sourceControl')}</span>
        </button>
      </div>}
  </div>
}
