/**
 * dsh-github Source Control conversation view: the third tab in the session
 * view ring (chat / trajectory / Source Control). It resolves a workspace from
 * the workspaces standard kit (persisted id -> recent -> first), renders a
 * workspace picker plus the existing GithubChangesPanel, and mounts/unmounts
 * with the active tab so polling follows tab lifecycle.
 */
import { useMemo, useState } from 'react'
import type { PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { GithubChangesPanel, type GithubPanelActions } from './panel.tsx'
import type { DshGithubKey } from './locales.ts'

// Re-declare the conversation.view slot entry so this plugin can type its
// registration without depending on ui-conversation. Matches the real
// declaration (kind=list, scope=session, owner={inspect,onInspectDone}).
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.view': {
      kind: 'list'
      scope: 'session'
      owner: { inspect?: { callId: string } | null; onInspectDone?: () => void }
    }
  }
}

const WORKSPACE_KEY = 'dsh-github.sidebar.workspaceId'

function readWorkspaceId(): WorkspaceId | null {
  try {
    const value = localStorage.getItem(WORKSPACE_KEY)
    return value === null || value === '' ? null : value as WorkspaceId
  } catch { return null }
}

function persistWorkspaceId(id: WorkspaceId): void {
  try { localStorage.setItem(WORKSPACE_KEY, String(id)) } catch { /* ignore */ }
}

/** Props the view-tab component receives (standard kit + entry inject face). */
export type SourceControlViewSlotProps = PropsRuntime<'conversation.view'> & {
  actions: GithubPanelActions
  t: (key: DshGithubKey, params?: Record<string, string>) => string
}

/** Minimal props of the {@link SourceControlView} body component. */
export interface SourceControlViewProps {
  actions: GithubPanelActions
  t: (key: DshGithubKey, params?: Record<string, string>) => string
  useWorkspaces: SnapshotSelectorHook<WorkspaceListState>
}

/** Resolve, persist, and render the Source Control panel for one workspace. */
export function SourceControlView({ actions, t, useWorkspaces }: SourceControlViewProps) {
  const items = useWorkspaces(snapshot => snapshot.items)
  const recentWorkspaceId = useWorkspaces(snapshot => snapshot.recentWorkspaceId)
  const [selectedId, setSelectedId] = useState<WorkspaceId | null>(() => readWorkspaceId())

  const selected = useMemo<WorkspaceView | null>(() => {
    if (items.length === 0) return null
    if (selectedId !== null) {
      const match = items.find(workspace => workspace.workspaceId === selectedId)
      if (match !== undefined) return match
    }
    if (recentWorkspaceId !== undefined) {
      const match = items.find(workspace => workspace.workspaceId === recentWorkspaceId)
      if (match !== undefined) return match
    }
    return items[0] ?? null
  }, [items, selectedId, recentWorkspaceId])

  const selectWorkspace = (id: WorkspaceId): void => { setSelectedId(id); persistWorkspaceId(id) }

  return <div className="dsh-github-view">
    {selected === null
      ? <div className="dsh-github-view-empty"><p>{t('panel.noWorkspace')}</p></div>
      : <GithubChangesPanel
        key={selected.workspaceId}
        path={selected.path}
        actions={actions}
        t={t}
        workspaces={items}
        workspaceId={selected.workspaceId}
        onSelectWorkspace={selectWorkspace}
      />}
  </div>
}
