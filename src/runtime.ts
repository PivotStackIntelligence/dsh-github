import { execFile } from 'node:child_process'
import { open } from 'node:fs/promises'
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

function parseStatus(output: string, maxFiles: number, fileUrlFor: (file: GitFileChange) => string | null): { files: GitFileChange[]; truncated: boolean } {
  const records = output.split('\0').filter(Boolean)
  const files: GitFileChange[] = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    if (record.length < 4) continue
    const index = record[0]!
    const worktree = record[1]!
    const path = record.slice(3)
    const renameOrCopy = index === 'R' || index === 'C'
    const previousPath = renameOrCopy ? records[++i] : undefined
    const file: GitFileChange = { path, index, worktree, kind: kindOf(index, worktree), previousPath: previousPath ?? null, fileUrl: null }
    file.fileUrl = fileUrlFor(file)
    files.push(file)
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
  let path: string
  const scp = remoteUrl.match(/^git@github\.com:(.+)$/i)
  if (scp !== null) path = scp[1]!
  else {
    let parsed: URL
    try { parsed = new URL(remoteUrl) } catch { return null }
    if (parsed.hostname.toLowerCase() !== 'github.com' || !['http:', 'https:', 'ssh:', 'git:', 'git+ssh:'].includes(parsed.protocol)) return null
    path = parsed.pathname
  }
  const parts = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/')
  if (parts.length !== 2 || parts.some(part => part === '')) return null
  return `https://github.com/${parts.map(encodeURIComponent).join('/')}`
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

async function readBoundedUntrackedFile(filePath: string, maxBytes: number): Promise<{ text: string; truncated: boolean; binary: boolean }> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const bytes = buffer.subarray(0, bytesRead)
    return { text: bytes.toString('utf8'), truncated: bytesRead > maxBytes, binary: bytes.includes(0) }
  } finally {
    await handle.close()
  }
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

function fileUrl(repositoryUrl: string | null, headSha: string | null, file: GitFileChange): string | null {
  if (repositoryUrl === null || headSha === null || file.kind === 'untracked' || file.kind === 'added') return null
  const path = file.kind === 'renamed' || file.kind === 'copied' ? file.previousPath : file.path
  return path === null ? null : `${repositoryUrl}/blob/${encodeURIComponent(headSha)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function commitUrl(repositoryUrl: string | null, sha: string | null): string | null {
  return repositoryUrl === null || sha === null ? null : `${repositoryUrl}/commit/${encodeURIComponent(sha)}`
}

function branchUrl(repositoryUrl: string | null, branch: string): string | null {
  if (repositoryUrl === null) return null
  const pull = branch.match(/^(?:pull|pr)\/(\d+)\/(?:head|merge)$/i)
  return pull === null
    ? `${repositoryUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
    : `${repositoryUrl}/pull/${pull[1]}`
}

function compareUrl(repositoryUrl: string | null, branch: string, upstream: string | null, defaultBranch: string | null, pushRepositoryUrl: string | null): string | null {
  if (repositoryUrl === null || branch.startsWith('HEAD ')) return null
  const slash = upstream?.indexOf('/') ?? -1
  const upstreamBranch = upstream === null ? null : slash < 0 ? upstream : upstream.slice(slash + 1)
  const base = defaultBranch ?? (upstreamBranch === branch ? null : upstreamBranch)
  if (base === null || base === branch) return null
  const encodedBase = base.split('/').map(encodeURIComponent).join('/')
  const encodedBranch = branch.split('/').map(encodeURIComponent).join('/')
  if (pushRepositoryUrl === null || pushRepositoryUrl === repositoryUrl) return `${repositoryUrl}/compare/${encodedBase}...${encodedBranch}?expand=1`
  const owner = new URL(pushRepositoryUrl).pathname.split('/').filter(Boolean)[0]
  return owner === undefined ? null : `${repositoryUrl}/compare/${encodedBase}...${owner}:${encodedBranch}?expand=1`
}

/** Host-side Remote service for local Git state and GitHub browser links. */
export class GithubRuntime extends TypertRemoteService {
  /** @param ctx - owning Cordis context. @param config - resolved limits. */
  constructor(ctx: Context, private readonly config: ResolvedConfig) { super(ctx, 'github') }

  private async root(path: string, signal?: AbortSignal): Promise<string> {
    if (!isAbsolute(path)) throw new Error(`dsh-github: refusing relative path "${path}"`)
    return (await git(['rev-parse', '--show-toplevel'], { cwd: path, signal })).trim()
  }

  private async remoteForBranch(root: string, branch: string, upstream: string | null, signal?: AbortSignal): Promise<{
    fetch: { name: string; url: string } | null
    push: { name: string; url: string } | null
  } | null> {
    const detached = branch.startsWith('HEAD ')
    const configured = detached ? '' : await git(['config', '--get', `branch.${branch}.remote`], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const upstreamRemote = detached || configured === '.' ? '' : upstream?.split('/', 1)[0] ?? ''
    const branchPush = detached ? '' : await git(['config', '--get', `branch.${branch}.pushRemote`], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const pushDefault = await git(['config', '--get', 'remote.pushDefault'], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const remotes = (await git(['remote'], { cwd: root, signal }).catch(() => '')).split(/\s+/).filter(Boolean)
    const soleRemote = remotes.length === 1 ? remotes[0]! : ''
    const fetchName = configured && configured !== '.' ? configured : upstreamRemote || soleRemote
    const pushName = branchPush || pushDefault || (configured !== '.' ? configured : '') || upstreamRemote || soleRemote
    if (!fetchName && !pushName) return null
    const fetchUrl = fetchName === '' ? '' : await git(['remote', 'get-url', fetchName], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const pushUrl = pushName === '' ? '' : await git(['remote', 'get-url', '--push', pushName], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    return {
      fetch: fetchName && fetchUrl ? { name: fetchName, url: fetchUrl } : null,
      push: pushName && pushUrl ? { name: pushName, url: pushUrl } : null,
    }
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
    const displayedRemote = remoteForDisplay(remote?.fetch?.url ?? null)
    const repositoryUrl = githubUrl(remote?.fetch?.url ?? remote?.push?.url ?? null)
    const headSha = await git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(value => value.trim()).catch(() => null)
    const parsed = parseStatus(await git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, signal, maxBuffer: Math.max(64 * 1024, this.config.maxFiles * 4 * 1024) }), this.config.maxFiles, file => fileUrl(repositoryUrl, headSha, file))
    return { root, branch, upstream, ahead, behind, remoteName: remote?.fetch?.name ?? null, remoteUrl: displayedRemote, githubUrl: repositoryUrl, pushRemoteName: remote?.push?.name ?? null, pushRemoteUrl: remoteForDisplay(remote?.push?.url ?? null), headSha, commitUrl: commitUrl(repositoryUrl, headSha), ...parsed }
  }

  /** Read one repository-relative file's bounded unified diff. */
  @Remote
  async getDiff(path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal): Promise<GitDiff> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const status = parseStatus(await git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, signal, maxBuffer: Math.max(64 * 1024, this.config.maxFiles * 4 * 1024) }), this.config.maxFiles * 4, () => null).files.find(file => file.path === safePath)
    let diff: string
    let truncated = false
    if (mode === 'working' && status?.kind === 'untracked') {
      const bounded = await readBoundedUntrackedFile(resolve(root, safePath), this.config.maxUntrackedBytes)
      if (bounded.binary) return { path: safePath, diff: `Binary file ${safePath} is not shown.\n`, truncated: bounded.truncated }
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
    const hasHead = await git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(() => true).catch(() => false)
    await gitWrite(hasHead ? ['restore', '--staged', '--', safePath] : ['rm', '--cached', '--', safePath], { cwd: root, signal })
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
    const hasHead = await git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(() => true).catch(() => false)
    await gitWrite(hasHead ? ['restore', '--staged', '--', '.'] : ['rm', '--cached', '-r', '--', '.'], { cwd: root, signal })
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
    if (status.pushRemoteName === null || status.pushRemoteUrl === null) throw new Error('dsh-github: a push remote is not configured')
    await gitWrite(status.upstream === null ? ['push', '-u', status.pushRemoteName, status.branch] : ['push'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Fetch the selected Git remote and return status with refreshed ahead/behind counts. */
  @Remote
  async fetch(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a fetch remote is not configured')
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
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a fetch remote is not configured')
    if (status.pushRemoteName === null || status.pushRemoteUrl === null) throw new Error('dsh-github: a push remote is not configured')
    if (status.upstream !== null) await gitWrite(['pull', '--ff-only'], { cwd: status.root, signal })
    await gitWrite(status.upstream === null ? ['push', '-u', status.pushRemoteName, status.branch] : ['push'], { cwd: status.root, signal })
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
      const remoteRef = `refs/remotes/${status.remoteName}/${checked}`
      const fetched = await git(['show-ref', '--verify', '--quiet', remoteRef], { cwd: root, signal }).then(() => true).catch(() => false)
      if (!fetched) throw new Error(`dsh-github: remote branch ${status.remoteName}/${checked} is not fetched. Fetch the remote, then try again.`)
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
    const defaultBranch = remoteName === null ? null : await git(['symbolic-ref', '--short', `refs/remotes/${remoteName}/HEAD`], { cwd: root, signal }).then(value => value.trim().replace(new RegExp(`^${remoteName}/`), '')).catch(() => {
      const remoteBranches = new Set(branches.filter(branch => branch.remote).map(branch => branch.name))
      return remoteBranches.has('main') ? 'main' : remoteBranches.has('master') ? 'master' : null
    })
    const localBranches = new Set(branches.filter(branch => !branch.remote).map(branch => branch.name))
    const linkedBranches = branches.filter(branch => !branch.remote || !localBranches.has(branch.name)).map(branch => ({ ...branch, branchUrl: branchUrl(repositoryUrl, branch.name) }))
    const pushRepositoryUrl = githubUrl(status.pushRemoteUrl)
    return { branches: linkedBranches, remoteName, githubUrl: repositoryUrl, compareUrl: current === undefined ? null : compareUrl(repositoryUrl, current.name, current.upstream, defaultBranch, pushRepositoryUrl) }
  }

}
