/**
 * dsh-github client plugin: the browser half of the local Git Changes panel.
 * It mounts the Git Remote namespace, registers the Workspace menu row, and
 * renders the selected repository's status and file diff in a side drawer.
 */
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DSH_GITHUB_REMOTE } from './remote.ts'
import { NS, en, zh } from './locales.ts'
import { GithubChangesPanel, type GithubPanelActions } from './panel.tsx'
import { installLegacyWorkspaceMenu } from './legacy-menu.tsx'
import { adoptPanelStyles } from './panel.tsx'
import { adoptStyles } from './styles.ts'
import type { GitDiff, GitDiffMode, GitRepositoryOverview, GitStatus } from '../types.ts'

/** Required services: the Remote gateway, locale, and Workspace list. */
export const inject = ['slots', 'remote', 'locale', 'workspaces']

type RemoteError = { code: string; message: string; details: object }
type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: RemoteError }

/** The mounted local Git Remote namespace. */
interface DshGithubNamespaceFace {
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
  adoptPanelStyles()
  const root = createRoot(mount)
  const dispose = (): void => { root.unmount(); mount.remove() }
  root.render(<GithubChangesPanel path={path} title={title} actions={actions} t={t} onClose={dispose} />)
  return dispose
}

type GithubChangesPanelProps = Parameters<typeof GithubChangesPanel>[0]

/** Compose the Workspace row and local Git Changes panel. @param ctx - client root context. */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-github: dictionaries')

  let github: DshGithubNamespaceFace | undefined
  let disposePanel: (() => void) | undefined
  const t = ctx.locale.bind(NS)

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(DSH_GITHUB_REMOTE)
    github = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.github') as DshGithubNamespaceFace | undefined
    if (github === undefined) throw new Error('dsh-github: the github Remote namespace did not mount')
    return () => { github = undefined; void dispose() }
  }, 'dsh-github: remote')

  const actions: GithubPanelActions = {
    getStatus: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.getStatus(path, signal)
    },
    getDiff: (path, filePath, mode, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.getDiff(path, filePath, mode, signal)
    },
    stage: (path, filePath, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.stage(path, filePath, signal)
    },
    unstage: (path, filePath, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.unstage(path, filePath, signal)
    },
    stageAll: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.stageAll(path, signal)
    },
    unstageAll: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.unstageAll(path, signal)
    },
    commit: (path, message, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.commit(path, message, signal)
    },
    push: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.push(path, signal)
    },
    fetch: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.fetch(path, signal)
    },
    pull: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.pull(path, signal)
    },
    sync: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.sync(path, signal)
    },
    checkoutBranch: (path, branch, remote, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.checkoutBranch(path, branch, remote, signal)
    },
    createBranch: (path, branch, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.createBranch(path, branch, signal)
    },
    getRepositoryOverview: (path, signal) => {
      if (github === undefined) return Promise.reject(new Error('dsh-github: Git Remote is not mounted'))
      return github.getRepositoryOverview(path, signal)
    },
  }

  const openChanges = (path: string, title: string): void => {
    disposePanel?.()
    disposePanel = mountPanel(path, title, actions, t)
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
