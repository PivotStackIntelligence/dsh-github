/**
 * dsh-github client plugin: the browser half of the local Git Source Control
 * panel. It mounts the Git Remote namespace, generates the panel action
 * wrappers from the shared contract, registers the Workspace menu row, and
 * renders the selected repository's Source Control drawer.
 */
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DSH_GITHUB_REMOTE } from './remote.ts'
import { DSH_GITHUB_INVOCATIONS } from '../contract.ts'
import { NS, en, zh } from './locales.ts'
import { GithubChangesPanel, type GithubPanelActions } from './panel.tsx'
import { installLegacyWorkspaceMenu } from './legacy-menu.tsx'
import { adoptStyles } from './styles.ts'

/** Required services: the Remote gateway, locale, and Workspace list. */
export const inject = ['slots', 'remote', 'locale', 'workspaces']

function resolveWorkspacePath(cwd: string, filePath: string): string {
  return filePath.startsWith('/') || /^[A-Za-z]:[/\\]/.test(filePath) || filePath.startsWith('\\\\') ? filePath : `${cwd.replace(/[/\\]+$/, '')}/${filePath.replace(/^[/\\]+/, '')}`
}

/** Mount a side drawer for one Workspace. */
function mountPanel(
  path: string,
  title: string,
  actions: GithubPanelActions,
  t: GithubChangesPanelProps['t'],
): () => void {
  const mount = document.createElement('div')
  mount.className = 'dsh-github-panel-host'
  document.body.appendChild(mount)
  adoptStyles()
  const root = createRoot(mount)
  const dispose = (): void => { root.unmount(); mount.remove() }
  root.render(<GithubChangesPanel path={path} title={title} actions={actions} t={t} onClose={dispose} />)
  return dispose
}

type GithubChangesPanelProps = Parameters<typeof GithubChangesPanel>[0]

/** Compose the Workspace row and local Git Source Control panel. @param ctx - client root context. */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: dictionaries')

  let github: unknown
  let disposePanel: (() => void) | undefined
  const t = ctx.locale.bind(NS)

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(DSH_GITHUB_REMOTE)
    github = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.github')
    if (github === undefined) throw new Error('dsh-github: the github Remote namespace did not mount')
    return () => { github = undefined; void dispose() }
  }, 'dsh-github: remote')

  /** Build one action wrapper that delegates to the mounted namespace. */
  const delegate = (method: string) => (...args: unknown[]): unknown => {
    if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
    const fn = (github as Record<string, unknown>)[method]
    if (typeof fn !== 'function') return Promise.reject(new Error(`dsh-github: GitHub method "${method}" is not available`))
    return (fn as (...callArgs: unknown[]) => unknown)(...args)
  }

  // Generate every contract method wrapper from the shared descriptor list.
  const actions: Record<string, unknown> = {}
  for (const { method } of DSH_GITHUB_INVOCATIONS) actions[method] = delegate(method)
  actions.openFile = async (root: string, filePath: string): Promise<void> => {
    await ctx.workspaces.openPath(resolveWorkspacePath(root, filePath))
  }
  const panelActions = actions as unknown as GithubPanelActions

  const openChanges = (path: string, title: string): void => {
    disposePanel?.()
    disposePanel = mountPanel(path, title, panelActions, t)
  }

  ctx.effect(() => installLegacyWorkspaceMenu({
    workspaces: ctx.workspaces.list,
    workspaceT: ctx.locale.bind('workspace'),
    rowT: t,
    openChanges,
  }), 'dsh-github: rc.6 workspace-menu')

  ctx.effect(() => () => {
    disposePanel?.()
    disposePanel = undefined
  }, 'dsh-github: changes-panel')
}
