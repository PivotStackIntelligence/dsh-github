import { useRef } from 'react'
import { fmt, type DshGithubKey } from './locales.ts'

/** Host callback used by the Changes row. */
export interface DshGithubInjected { openChanges: (path: string, label: string) => void }

/** Minimal presentation props shared by the rc.6 DOM adapter. */
export interface DshGithubMenuRowProps extends DshGithubInjected {
  /** Display title of the Workspace. */
  label: string
  /** Absolute directory path; absent rows render nothing. */
  cwd: string | undefined
  /** Close the Workspace overflow menu before opening the panel. */
  onClose: () => void
  /** Locale-bound translation seat. */
  t: (key: DshGithubKey, params?: Record<string, string>) => string
  /** Launch on pointerdown when the legacy menu removes injected DOM before click. */
  eagerPointerActivation?: boolean
}

/** Render the View Changes menu item. */
export function DshGithubMenuRow({ cwd, label, onClose, openChanges, t, eagerPointerActivation = false }: DshGithubMenuRowProps) {
  const activated = useRef(false)
  if (cwd === undefined) return null
  const run = (): void => {
    if (activated.current) return
    activated.current = true
    onClose()
    openChanges(cwd, label)
  }
  return <button type="button" role="menuitem" className="dsh-github-row" aria-label={fmt(t('menu.viewChanges.aria'), { name: label })} onClick={run} onPointerDown={(event) => { if (eagerPointerActivation && event.button === 0) run() }}><span aria-hidden="true">◌</span><span>{t('menu.viewChanges')}</span></button>
}
