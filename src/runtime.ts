import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { branchNameSchema, commitMessageSchema } from './contract.ts'
import type { GitBranch, GitDiff, GitDiffMode, GitFileChange, GitRepositoryOverview, GitStatus, ResolvedConfig } from './types.ts'

const execFileAsync = promisify(execFile)
type ExecOptions = { cwd?: string; maxBuffer?: number; signal?: AbortSignal }

async function command(file: string, args: string[], options: ExecOptions = {}): Promise<string> {
  const { stdout } = await execFileAsync(file, args, { ...options, encoding: 'utf8' })
  return stdout
}

function git(args: string[], options: ExecOptions = {}): Promise<string> { return command('git', args, options) }

function boundedGitError(error: unknown): Error {
  const output = typeof error === 'object' && error !== null
    ? ['stderr', 'stdout'].flatMap(key => key in error && typeof error[key as keyof typeof error] === 'string' ? [error[key as keyof typeof error] as string] : []).join('\n').trim()
    : ''
  const detail = output || (error instanceof Error ? error.message : String(error))
  const lower = detail.toLowerCase()
  if (lower.includes('non-fast-forward') || lower.includes('fetch first') || lower.includes('rejected')) return new Error('Push rejected because the remote branch has newer commits. Pull or sync before pushing.')
  if (lower.includes('nothing to commit') || lower.includes('no changes added to commit')) return new Error('Nothing is staged to commit.')
  if (lower.includes('please tell me who you are') || lower.includes('author identity unknown')) return new Error('Git author identity is not configured. Set user.name and user.email, then try again.')
  if (lower.includes('would be overwritten by') || lower.includes('local changes to the following files')) return new Error('Local changes block this operation. Commit or stash them, then try again.')
  if (lower.includes('conflict')) return new Error('Git found conflicts. Resolve them in the working tree before continuing.')
  const firstLine = detail.split('\n').find(line => line.trim() !== '')?.trim() ?? 'Git command failed.'
  const redacted = firstLine.replace(/https?:\/\/[^/@\s]+:[^@\s]+@/gi, 'https://[credentials]@').slice(0, 600)
  return new Error(redacted.startsWith('dsh-github:') ? redacted : `dsh-github: ${redacted}`)
}

async function gitWrite(args: string[], options: ExecOptions): Promise<string> {
  try { return await git(args, options) } catch (error) { throw boundedGitError(error) }
}

function kindOf(index: string, worktree: string): GitFileChange['kind'] {
  if (index === 'U' || worktree === 'U') return 'conflict'
  if (index === '?' && worktree === '?') return 'untracked'
  const code = index !== ' ' ? index : worktree
  if (code === 'A') return 'added'
  if (code === 'D') return 'deleted'
  if (code === 'R') return 'renamed'
  if (code === 'C') return 'copied'
  return 'modified'
}

function parseStatus(output: string, maxFiles: number): { files: GitFileChange[]; truncated: boolean } {
  const records = output.split('\0').filter(Boolean)
  const files: GitFileChange[] = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    if (record.length < 4) continue
    const index = record[0]!
    const worktree = record[1]!
    const path = record.slice(3)
    if (index === 'R' || index === 'C') i++
    files.push({ path, index, worktree, kind: kindOf(index, worktree) })
    if (files.length >= maxFiles) return { files, truncated: i < records.length - 1 }
  }
  return { files, truncated: false }
}

function remoteForDisplay(remoteUrl: string | null): string | null {
  if (remoteUrl === null) return null
  try {
    if (/^git@github\.com:/i.test(remoteUrl)) return remoteUrl
    const url = new URL(remoteUrl)
    if (url.username || url.password) {
      url.username = ''
      url.password = ''
    }
    return url.toString().replace(/\/$/, '')
  } catch { return remoteUrl }
}

function githubUrl(remoteUrl: string | null): string | null {
  if (remoteUrl === null) return null
  const match = remoteUrl.match(/^(?:https?:\/\/|ssh:\/\/git@|git@)(github\.com)[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)
  if (match === null) return null
  const repository = match[2]!.split('/').map(part => encodeURIComponent(part)).join('/')
  return `https://${match[1]}/${repository}`
}

function trimOutput(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text) <= maxBytes) return { text, truncated: false }
  let end = Math.min(text.length, maxBytes)
  while (end > 0 && Buffer.byteLength(text.slice(0, end)) > maxBytes) end--
  return { text: text.slice(0, end), truncated: true }
}

function validateFilePath(root: string, filePath: string): string {
  if (isAbsolute(filePath) || filePath.includes('\0')) throw new Error('dsh-github: file path must be repository-relative')
  const absolute = resolve(root, filePath)
  const escaped = relative(root, absolute)
  if (escaped === '..' || escaped.startsWith(`..${sep}`)) throw new Error('dsh-github: file path escapes repository root')
  return escaped
}

function syntheticUntrackedDiff(filePath: string, text: string): string {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  const lines = body === '' ? [] : body.split('\n')
  return [`diff --git a/${filePath} b/${filePath}`, 'new file mode 100644', '--- /dev/null', `+++ b/${filePath}`, `@@ -0,0 +${lines.length} @@`, ...lines.map(line => `+${line}`)].join('\n') + '\n'
}

function parseBranches(output: string, remoteName: string | null): GitBranch[] {
  const remotePrefix = remoteName === null ? null : `${remoteName}/`
  const remoteRefPrefix = remoteName === null ? null : `refs/remotes/${remoteName}/`
  return output.split('\0').map(record => record.trimStart()).filter(Boolean).map(record => {
    const [ref = '', short = '', upstream = '', head = ''] = record.split('\t')
    const remote = remoteRefPrefix !== null && ref.startsWith(remoteRefPrefix)
    return { name: remote && remotePrefix !== null ? short.slice(remotePrefix.length) : short, current: head === '*', remote, upstream: upstream || null, branchUrl: null }
  }).filter(branch => branch.name !== 'HEAD')
}

function branchUrl(repositoryUrl: string | null, branch: string): string | null {
  return repositoryUrl === null ? null : `${repositoryUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
}

function compareUrl(repositoryUrl: string | null, branch: string, upstream: string | null, defaultBranch: string | null): string | null {
  if (repositoryUrl === null || branch.startsWith('HEAD ')) return null
  const slash = upstream?.indexOf('/') ?? -1
  const base = upstream === null ? defaultBranch : slash < 0 ? upstream : upstream.slice(slash + 1)
  if (base === null || base === branch) return null
  const encodedBase = base.split('/').map(encodeURIComponent).join('/')
  const encodedBranch = branch.split('/').map(encodeURIComponent).join('/')
  return `${repositoryUrl}/compare/${encodedBase}...${encodedBranch}?expand=1`
}

/** Host-side Remote service for local Git state and GitHub browser links. */
export class GithubRuntime extends TypertRemoteService {
  /** @param ctx - owning Cordis context. @param config - resolved limits. */
  constructor(ctx: Context, private readonly config: ResolvedConfig) { super(ctx, 'github') }

  private async root(path: string, signal?: AbortSignal): Promise<string> {
    if (!isAbsolute(path)) throw new Error(`dsh-github: refusing relative path "${path}"`)
    return (await git(['rev-parse', '--show-toplevel'], { cwd: path, signal })).trim()
  }

  private async remoteForBranch(root: string, branch: string, upstream: string | null, signal?: AbortSignal): Promise<{ name: string; url: string } | null> {
    if (branch.startsWith('HEAD ')) return null
    const configured = await git(['config', '--get', `branch.${branch}.remote`], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    if (configured === '.') return null
    const upstreamRemote = upstream?.split('/', 1)[0] ?? ''
    const pushDefault = await git(['config', '--get', 'remote.pushDefault'], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const remotes = (await git(['remote'], { cwd: root, signal }).catch(() => '')).split(/\s+/).filter(Boolean)
    const name = configured || upstreamRemote || pushDefault || remotes[0] || ''
    if (!name) return null
    const url = await git(['remote', 'get-url', name], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    return url ? { name, url } : null
  }

  /** Read repository metadata and the bounded changed-file list. */
  @Remote
  async getStatus(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const branch = (await git(['branch', '--show-current'], { cwd: root, signal })).trim() || `HEAD ${(await git(['rev-parse', '--short', 'HEAD'], { cwd: root, signal })).trim()}`
    const upstream = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: root, signal }).then(value => value.trim()).catch(() => null)
    let ahead = 0
    let behind = 0
    if (upstream !== null) {
      const [behindText, aheadText] = (await git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], { cwd: root, signal }).catch(() => '')).trim().split(/\s+/)
      behind = Number.parseInt(behindText ?? '0', 10) || 0
      ahead = Number.parseInt(aheadText ?? '0', 10) || 0
    }
    const remote = await this.remoteForBranch(root, branch, upstream, signal)
    const parsed = parseStatus(await git(['status', '--porcelain=v1', '-z'], { cwd: root, signal, maxBuffer: Math.max(64 * 1024, this.config.maxFiles * 1024) }), this.config.maxFiles)
    return { root, branch, upstream, ahead, behind, remoteName: remote?.name ?? null, remoteUrl: remoteForDisplay(remote?.url ?? null), githubUrl: githubUrl(remote?.url ?? null), ...parsed }
  }

  /** Read one repository-relative file's bounded unified diff. */
  @Remote
  async getDiff(path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal): Promise<GitDiff> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const status = parseStatus(await git(['status', '--porcelain=v1', '-z'], { cwd: root, signal, maxBuffer: Math.max(64 * 1024, this.config.maxFiles * 4 * 1024) }), this.config.maxFiles * 4).files.find(file => file.path === safePath)
    let diff: string
    let truncated = false
    if (mode === 'working' && status?.kind === 'untracked') {
      const contents = await readFile(resolve(root, safePath))
      if (contents.includes(0)) return { path: safePath, diff: `Binary file ${safePath} is not shown.\n`, truncated: false }
      const bounded = trimOutput(contents.toString('utf8'), this.config.maxUntrackedBytes)
      diff = syntheticUntrackedDiff(safePath, bounded.text)
      truncated = bounded.truncated
    } else {
      const args = ['diff', '--no-ext-diff', '--unified=3', ...(mode === 'staged' ? ['--cached'] : []), '--', safePath]
      diff = await git(args, { cwd: root, signal })
    }
    const bounded = trimOutput(diff, this.config.maxDiffBytes)
    return { path: safePath, diff: bounded.text, truncated: truncated || bounded.truncated }
  }

  /** Stage one repository-relative path and return fresh status. */
  @Remote
  async stage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await gitWrite(['add', '--', validateFilePath(root, filePath)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Remove one repository-relative path from the index and return fresh status. */
  @Remote
  async unstage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    await gitWrite(['restore', '--staged', '--', safePath], { cwd: root, signal }).catch(async () => gitWrite(['rm', '--cached', '--', safePath], { cwd: root, signal }))
    return this.getStatus(root, signal)
  }

  /** Stage every working-tree change and return fresh status. */
  @Remote
  async stageAll(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await gitWrite(['add', '--all'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Remove every staged path from the index and return fresh status. */
  @Remote
  async unstageAll(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await gitWrite(['restore', '--staged', '--', '.'], { cwd: root, signal }).catch(async () => gitWrite(['rm', '--cached', '-r', '--', '.'], { cwd: root, signal }))
    return this.getStatus(root, signal)
  }

  /** Commit staged changes with an explicit message and return fresh status. */
  @Remote
  async commit(path: string, message: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await gitWrite(['commit', '-m', commitMessageSchema.parse(message)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Push the current branch through the repository's configured Git transport. */
  @Remote
  async push(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.branch.startsWith('HEAD ')) throw new Error('dsh-github: cannot push a detached HEAD')
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a Git remote is not configured')
    await gitWrite(status.upstream === null ? ['push', '-u', status.remoteName, status.branch] : ['push'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Fetch the selected Git remote and return status with refreshed ahead/behind counts. */
  @Remote
  async fetch(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a Git remote is not configured')
    await gitWrite(['fetch', status.remoteName], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Fast-forward the current branch from its upstream and return fresh status. */
  @Remote
  async pull(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.upstream === null) throw new Error('dsh-github: current branch has no upstream')
    await gitWrite(['pull', '--ff-only'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Pull with fast-forward-only semantics, then push without force. */
  @Remote
  async sync(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.branch.startsWith('HEAD ')) throw new Error('dsh-github: cannot sync a detached HEAD')
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a Git remote is not configured')
    if (status.upstream !== null) await gitWrite(['pull', '--ff-only'], { cwd: status.root, signal })
    await gitWrite(status.upstream === null ? ['push', '-u', status.remoteName, status.branch] : ['push'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  private async checkedBranch(root: string, branch: string, signal?: AbortSignal): Promise<string> {
    const checked = branchNameSchema.parse(branch)
    await gitWrite(['check-ref-format', '--branch', checked], { cwd: root, signal })
    return checked
  }

  /** Checkout a local or selected-remote branch without stashing or discarding changes. */
  @Remote
  async checkoutBranch(path: string, branch: string, remote: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const checked = await this.checkedBranch(root, branch, signal)
    const status = await this.getStatus(root, signal)
    const localExists = await git(['show-ref', '--verify', '--quiet', `refs/heads/${checked}`], { cwd: root, signal }).then(() => true).catch(() => false)
    if (remote && !localExists) {
      if (status.remoteName === null) throw new Error('dsh-github: no configured remote is available for this branch')
      await gitWrite(['switch', '--track', `${status.remoteName}/${checked}`], { cwd: root, signal })
    } else {
      await gitWrite(['switch', checked], { cwd: root, signal })
    }
    return this.getStatus(root, signal)
  }

  /** Create and checkout a branch without modifying working-tree changes. */
  @Remote
  async createBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await gitWrite(['switch', '-c', await this.checkedBranch(root, branch, signal)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Read local and selected-remote branches and browser links derived from the configured GitHub remote. */
  @Remote
  async getRepositoryOverview(path: string, signal?: AbortSignal): Promise<GitRepositoryOverview> {
    const root = await this.root(path, signal)
    const status = await this.getStatus(root, signal)
    const remoteName = status.remoteName
    const refs = remoteName === null ? ['refs/heads'] : ['refs/heads', `refs/remotes/${remoteName}`]
    const branches = parseBranches(await git(['for-each-ref', '--format=%(refname)%09%(refname:short)%09%(upstream:short)%09%(HEAD)%00', ...refs], { cwd: root, signal }), remoteName)
    const repositoryUrl = status.githubUrl
    const current = branches.find(branch => branch.current && !branch.remote)
    const defaultBranch = remoteName === null ? null : await git(['symbolic-ref', '--short', `refs/remotes/${remoteName}/HEAD`], { cwd: root, signal }).then(value => value.trim().replace(new RegExp(`^${remoteName}/`), '')).catch(() => null)
    const linkedBranches = branches.map(branch => ({ ...branch, branchUrl: branchUrl(repositoryUrl, branch.name) }))
    return { branches: linkedBranches, remoteName, githubUrl: repositoryUrl, compareUrl: current === undefined ? null : compareUrl(repositoryUrl, current.name, current.upstream, defaultBranch) }
  }

}
