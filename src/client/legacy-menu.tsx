/**
 * Compatibility adapter for DSH 0.1.0-rc.6, whose published Workspace menu
 * predates a public Workspace row-menu slot. It mounts one row into the
 * existing rc.6 overflow menu and disposes all observers on unload.
 */
import { createRoot, type Root } from 'react-dom/client'
import { DshGithubMenuRow, type DshGithubMenuRowProps } from './row.tsx'

interface WorkspaceItem {
  title: string
  path: string
}

interface WorkspaceListSource {
  getSnapshot(): { items: readonly WorkspaceItem[] }
}

export interface LegacyWorkspaceMenuOptions {
  workspaces: WorkspaceListSource
  workspaceT: WorkspaceTranslate
  rowT: DshGithubMenuRowProps['t']
  openChanges: (path: string, label: string) => void
}

type WorkspaceTranslate = (
  key: 'actions.workspace.aria' | 'rename' | 'delete.workspace',
  params?: Record<string, unknown>,
) => string

interface ActiveMenu {
  workspace: WorkspaceItem
  anchor: HTMLElement
  menu?: HTMLElement
  mount?: HTMLElement
  root?: Root
}

const MOUNT_ATTR = 'data-dsh-github-legacy'

function cancelPointerLeaveClose(anchor: HTMLElement): void {
  // rc.6's portaled Menu joins trigger and list through React's synthetic
  // event tree. Our compatibility row is a nested React root, so entering it
  // otherwise looks like leaving that tree and the menu closes after 200ms.
  anchor.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
}

function workspaceForButton(
  button: HTMLButtonElement,
  workspaces: WorkspaceListSource,
  t: WorkspaceTranslate,
): WorkspaceItem | undefined {
  const aria = button.getAttribute('aria-label')
  if (aria === null) return undefined
  const matches = workspaces.getSnapshot().items.filter(item => (
    t('actions.workspace.aria', { name: item.title }) === aria
  ))
  return matches.length === 1 ? matches[0] : undefined
}

function isWorkspaceMenu(menu: HTMLElement, t: WorkspaceTranslate): boolean {
  const labels = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .map(item => item.textContent?.trim())
  return labels.includes(t('rename')) && labels.includes(t('delete.workspace'))
}

/**
 * Add the View Changes row to the published rc.6 Workspace menu.
 * @returns disposer removing listeners, observers, and any mounted row.
 */
export function installLegacyWorkspaceMenu(options: LegacyWorkspaceMenuOptions): () => void {
  let active: ActiveMenu | undefined

  const unmount = (): void => {
    active?.root?.unmount()
    active?.mount?.remove()
    active?.menu?.removeAttribute(MOUNT_ATTR)
    if (active !== undefined) {
      active.root = undefined
      active.mount = undefined
      active.menu = undefined
    }
  }

  const close = (): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }

  const mountIntoOpenMenu = (): void => {
    if (active === undefined || active.root !== undefined) return
    const menus = [...document.querySelectorAll<HTMLElement>('[role="menu"]')]
      .filter(menu => isWorkspaceMenu(menu, options.workspaceT))
    const menu = menus.at(-1)
    if (menu === undefined || menu.hasAttribute(MOUNT_ATTR)) return
    const viewport = menu.querySelector<HTMLElement>(':scope > [role="presentation"]') ?? menu
    const mount = document.createElement('div')
    mount.setAttribute('role', 'presentation')
    mount.setAttribute(MOUNT_ATTR, '')
    mount.addEventListener('pointerover', () => {
      if (active !== undefined) cancelPointerLeaveClose(active.anchor)
    })
    viewport.appendChild(mount)
    menu.setAttribute(MOUNT_ATTR, '')
    const root = createRoot(mount)
    active.menu = menu
    active.mount = mount
    active.root = root
    root.render(
      <DshGithubMenuRow
        cwd={active.workspace.path}
        label={active.workspace.title}
        onClose={close}
        openChanges={options.openChanges}
        t={options.rowT}
        eagerPointerActivation
      />,
    )
  }

  const observer = new MutationObserver(() => {
    if (active?.menu !== undefined && !active.menu.isConnected) unmount()
    mountIntoOpenMenu()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button[aria-label]')
    if (button === null) return
    const workspace = workspaceForButton(button, options.workspaces, options.workspaceT)
    if (workspace === undefined) return
    unmount()
    active = { workspace, anchor: button.parentElement ?? button }
    queueMicrotask(mountIntoOpenMenu)
  }
  document.addEventListener('click', onClick, true)

  return () => {
    document.removeEventListener('click', onClick, true)
    observer.disconnect()
    unmount()
    active = undefined
  }
}
