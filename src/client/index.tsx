/**
 * dsh-github client plugin: the browser half of the local Git Source Control
 * panel. It mounts the Git Remote namespace, generates the panel action
 * wrappers from the shared contract, and registers one Source Control tab
 * into the session conversation view ring (bound to the current session's
 * workspace).
 * Author: bugmaker2 · PivotStack Intelligence
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// 0.1.2-rc.1 Context augmentation faces: slots (ui-renderer), remote
// (ClientRemote via api-remotes), locale, workspaces, and the session
// standard-props merge (sessionId / useSessions) for conversation.view.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { DSH_OPEN_PATH_REMOTE, DSH_GITHUB_REMOTE } from './remote.ts'
import { DSH_GITHUB_INVOCATIONS } from '../contract.ts'
import { NS, en, zh } from './locales.ts'
import type { GithubPanelActions } from './panel.tsx'
import { SourceControlView, type SourceControlViewSlotProps } from './view.tsx'
import { adoptStyles } from './styles.ts'

/** Required services: the Remote gateway, locale, Workspace list, and slots. */
export const inject = ['slots', 'remote', 'locale', 'workspaces']

function resolveWorkspacePath(cwd: string, filePath: string): string {
  return filePath.startsWith('/') || /^[A-Za-z]:[/\\]/.test(filePath) || filePath.startsWith('\\\\') ? filePath : `${cwd.replace(/[/\\]+$/, '')}/${filePath.replace(/^[/\\]+/, '')}`
}

/** Compose the local Git Source Control view tab. @param ctx - client root context. */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: dictionaries')

  let github: unknown
  const t = ctx.locale.bind(NS)

  ctx.effect(async () => {
    try {
      const dispose = await ctx.remote.$mount(DSH_GITHUB_REMOTE)
      github = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.github') ?? (ctx as any)['remote.github']
      if (github === undefined) console.error('dsh-github: the github Remote namespace did not mount')
      return () => { github = undefined; void dispose() }
    } catch (err) {
      console.error('dsh-github: error mounting DSH_GITHUB_REMOTE:', err)
      throw err
    }
  }, 'dsh-github: remote')

  /** Build one action wrapper that delegates to the mounted namespace. */
  const delegate = (method: string) => (...args: unknown[]): unknown => {
    const target = (github ?? (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.github') ?? (ctx as any)['remote.github']) as Record<string, unknown> | undefined
    if (target === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
    const fn = target[method]
    if (typeof fn !== 'function') return Promise.reject(new Error(`dsh-github: GitHub method "${method}" is not available`))
    return (fn as (...callArgs: unknown[]) => unknown)(...args)
  }

  // Generate every contract method wrapper from the shared descriptor list.
  const actions: Record<string, unknown> = {}
  for (const { method } of DSH_GITHUB_INVOCATIONS) actions[method] = delegate(method)

  // "Open file in editor" across host generations. 0.1.0-rc.6 exposed the
  // native opener on the workspaces service; 0.1.2-rc.1 moved it into the
  // generated `session` Remote namespace (`session/openWorkspacePath`),
  // mounted by our own contribution in our own fiber (descriptor copied from
  // the 0.1.2-rc.1 `dsh-api-remotes/lib/client.js` assembly). The namespace
  // reflects as `remote.session` under the fiber that mounts it.
  let hoSession: unknown
  ctx.effect(async () => {
    try {
      const dispose = await ctx.remote.$mount(DSH_OPEN_PATH_REMOTE)
      hoSession = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.session') ?? (ctx as any)['remote.session']
      return () => { hoSession = undefined; void dispose() }
    } catch {
      hoSession = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.session') ?? (ctx as any)['remote.session']
    }
  }, 'dsh-github: open-path')

  actions.openFile = async (root: string, filePath: string): Promise<void> => {
    const path = resolveWorkspacePath(root, filePath)
    const openPath = (ctx.workspaces as Partial<{ openPath(path: string): Promise<void> }> | undefined)?.openPath
    if (typeof openPath === 'function') { await openPath.call(ctx.workspaces, path); return }
    const session = (hoSession ?? (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.session') ?? (ctx as any)['remote.session']) as { openWorkspacePath?: (request: { path: string }, signal?: AbortSignal) => Promise<unknown> } | undefined
    if (typeof session?.openWorkspacePath === 'function') { await session.openWorkspacePath({ path }); return }
    console.warn(`dsh-github: does not offer a native file opener on this host; skipped opening "${path}"`)
  }
  const panelActions = actions as unknown as GithubPanelActions

  // Register the Source Control tab into the session conversation view ring.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'source-control',
    order: 20,
    label: () => t('view.label'),
    inject: () => ({ actions: panelActions, t }),
  }, (props: SourceControlViewSlotProps) => <SourceControlView sessionId={props.sessionId} useSessions={props.useSessions} actions={props.actions} t={props.t} />))
}
