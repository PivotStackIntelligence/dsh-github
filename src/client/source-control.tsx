/**
 * dsh-github Source Control entry points: a session-header toggle button and
 * a right-edge slide-in overlay panel, coordinated through one module-level
 * useSyncExternalStore-backed store (open flag + toggle element for focus
 * return). The panel binds to the current session's workspace (cwd).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { workspaceTitleOf, type SessionId, type SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { GithubChangesPanel, type GithubPanelActions } from './panel.tsx'
import type { DshGithubKey } from './locales.ts'

// Re-declare the two slot entries so this plugin types its registrations
// without depending on ui-conversation / ui-layout. Matches the real
// declarations (header.actions: list/session; shell.overlay: list/root).
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.session.header.actions': { kind: 'list'; scope: 'session'; owner: object }
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

/* ===== Module-level panel store (open flag + toggle element) ===== */

interface SourceControlPanelState {
  open: boolean
  toggleRef: HTMLElement | null
}

let panelState: SourceControlPanelState = { open: false, toggleRef: null }
const panelListeners = new Set<() => void>()

const getPanelSnapshot = (): SourceControlPanelState => panelState
const subscribePanel = (listener: () => void): () => void => {
  panelListeners.add(listener)
  return () => { panelListeners.delete(listener) }
}

function commitPanel(next: SourceControlPanelState): void {
  panelState = next
  for (const listener of panelListeners) listener()
}

/** Toggle the panel open/closed from the header button. */
export function toggleSourceControlPanel(): void {
  commitPanel({ ...panelState, open: !panelState.open })
}

/** Close the panel and return focus to the header toggle button. */
export function closeSourceControlPanel(): void {
  if (!panelState.open) return
  const toggle = panelState.toggleRef
  commitPanel({ ...panelState, open: false })
  toggle?.focus()
}

/** Register/unregister the header toggle element (no re-render). */
export function registerSourceControlToggle(element: HTMLElement | null): void {
  if (panelState.toggleRef === element) return
  panelState = { ...panelState, toggleRef: element }
}

type Translate = (key: DshGithubKey, params?: Record<string, string>) => string

/* ===== Header action toggle button ===== */

export interface SourceControlToggleProps {
  t: Translate
}

/** The ⑂ header action button: toggles the Source Control overlay. */
export function SourceControlToggle({ t }: SourceControlToggleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open } = useSyncExternalStore(subscribePanel, getPanelSnapshot)

  useEffect(() => {
    registerSourceControlToggle(buttonRef.current)
    return () => registerSourceControlToggle(null)
  }, [])

  const label = open ? t('panel.closeSourceControl') : t('panel.openSourceControl')
  return <button ref={buttonRef} type="button" className="dsh-github-header-action" onClick={toggleSourceControlPanel} aria-label={label} title={label} aria-pressed={open}>⑂</button>
}

/* ===== Right-edge slide-in overlay panel ===== */

export interface SourceControlOverlayPanelProps {
  actions: GithubPanelActions
  t: Translate
  useSessions: SnapshotSelectorHook<SessionListState>
}

/** Slide-in Source Control panel bound to the current session's workspace. */
export function SourceControlOverlayPanel({ actions, t, useSessions }: SourceControlOverlayPanelProps) {
  const { open } = useSyncExternalStore(subscribePanel, getPanelSnapshot)
  const sessionSnapshot = useSessions(snapshot => snapshot)
  const sessionId: SessionId | undefined = sessionSnapshot.current
  const summary = sessionId === undefined ? undefined : sessionSnapshot.byId[sessionId]
  const cwd = summary?.cwd

  if (!open) return null

  if (sessionId === undefined || summary === undefined || cwd === undefined) {
    return <div className="dsh-github-overlay" role="complementary" aria-label={t('panel.title')}>
      <div className="dsh-github-overlay-empty">
        <header className="dsh-github-overlay-empty-head">
          <strong>{t('panel.title')}</strong>
          <button type="button" onClick={closeSourceControlPanel} aria-label={t('panel.close')} title={t('panel.close')}>×</button>
        </header>
        <p>{t('panel.noSessionCwd')}</p>
      </div>
    </div>
  }

  return <div className="dsh-github-overlay" role="complementary" aria-label={t('panel.title')}>
    <GithubChangesPanel
      key={sessionId}
      path={cwd}
      title={summary.displayTitle || workspaceTitleOf(cwd)}
      actions={actions}
      t={t}
      onClose={closeSourceControlPanel}
    />
  </div>
}
