/**
 * dsh-github Source Control conversation view: the third tab in the session
 * view ring (chat / trajectory / Source Control). It reads the current
 * session's workspace (cwd) from the sessions standard kit and renders the
 * GithubChangesPanel; it mounts/unmounts with the active tab, so polling
 * follows tab lifecycle. No workspace switching and no persistence.
 * Author: bugmaker2 · PivotStack Intelligence
 */
import type { PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { workspaceTitleOf, type SessionId, type SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
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

type Translate = (key: DshGithubKey, params?: Record<string, string>) => string

/** Props the view-tab slot component receives (standard kit + entry inject face). */
export type SourceControlViewSlotProps = PropsRuntime<'conversation.view'> & {
  actions: GithubPanelActions
  t: Translate
}

/** Minimal props of the {@link SourceControlView} body component. */
export interface SourceControlViewProps {
  sessionId: SessionId
  useSessions: SnapshotSelectorHook<SessionListState>
  actions: GithubPanelActions
  t: Translate
}

/** Render the Source Control panel for the current session's workspace. */
export function SourceControlView({ sessionId, useSessions, actions, t }: SourceControlViewProps) {
  const snapshot = useSessions(s => s)
  const summary = snapshot.byId[sessionId]
  const cwd = summary?.cwd

  if (summary === undefined || cwd === undefined || cwd === '') {
    return <div className="dsh-github-view"><div className="dsh-github-view-empty"><p>{t('panel.noSessionCwd')}</p></div></div>
  }

  return <div className="dsh-github-view">
    <GithubChangesPanel
      key={sessionId}
      path={cwd}
      title={summary.displayTitle || workspaceTitleOf(cwd)}
      actions={actions}
      t={t}
    />
  </div>
}
