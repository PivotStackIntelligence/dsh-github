import { execFile } from 'node:child_process'
import { access, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { branchNameSchema, commitMessageSchema } from './contract.ts'
import type {
  GitBranch, GitCommitDetail, GitCommitFile, GitCommitSummary, GitConflictStrategy,
  GitDiff, GitDiffMode, GitFileChange, GitLog, GitMergeState, GitOutput, GitOutputEntry,
  GitRemote, GitRemoteList, GitRepositoryOverview, GitStash, GitStashList, GitStatus,
  GitTag, GitTagList, ResolvedConfig,
} from './types.ts'

const execFileAsync = promisify(execFile)
type ExecOptions = { cwd?: string; maxBuffer?: number; signal?: AbortSignal }
type OutputRecorder = (entry: GitOutputEntry) => void

/** Byte cap for one recorded command's combined stdout/stderr text. */
const MAX_OUTPUT_BYTES = 4 * 1024

/** Strip credential material from an https URL's userinfo segment. */
function redactCredentials(text: string): string {
  return text.replace(/https?:\/\/[^\s@]*@/gi, 'https://[credentials]@')
}

/** Run one executable, capture both streams, and record the bounded redacted execution. */
async function command(file: string, args: string[], options: ExecOptions = {}, record?: OutputRecorder): Promise<string> {
  const env = { ...process.env, GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' }
  let ok = true
  let stdout = ''
  let stderr = ''
  try {
    const result = await execFileAsync(file, args, { ...options, encoding: 'utf8', env })
    stdout = result.stdout
    stderr = result.stderr
    return result.stdout
  } catch (error) {
    ok = false
    const captured = error as { stdout?: unknown; stderr?: unknown }
    stdout = typeof captured.stdout === 'string' ? captured.stdout : ''
    stderr = typeof captured.stderr === 'string' ? captured.stderr : ''
    throw error
  } finally {
    const combined = stdout !== '' && stderr !== '' ? `${stdout}\n${stderr}` : stdout !== '' ? stdout : stderr
    record?.({
      command: file,
      args: args.map(redactCredentials),
      ok,
      output: trimOutput(redactCredentials(combined), MAX_OUTPUT_BYTES).text,
      at: new Date().toISOString(),
    })
  }
}

function boundedGitError(error: unknown): Error {
  const raw = typeof error === 'object' && error !== null
    ? ['stderr', 'stdout'].flatMap(key => key in error && typeof error[key as keyof typeof error] === 'string' ? [error[key as keyof typeof error] as string] : []).join('\n').trim()
    : ''
  const detail = redactCredentials(raw) || (error instanceof Error ? redactCredentials(error.message) : redactCredentials(String(error)))
  const lower = detail.toLowerCase()
  if (lower.includes('non-fast-forward') || lower.includes('fetch first') || lower.includes('rejected')) return new Error('Push rejected because the remote branch has newer commits. Pull or sync before pushing.')
  if (lower.includes('nothing to commit') || lower.includes('no changes added to commit')) return new Error('Nothing is staged to commit.')
  if (lower.includes('please tell me who you are') || lower.includes('author identity unknown')) return new Error('Git author identity is not configured. Set user.name and user.email, then try again.')
  if (lower.includes('would be overwritten by') || lower.includes('local changes to the following files')) return new Error('Local changes block this operation. Commit or stash them, then try again.')
  if (lower.includes('conflict')) return new Error('Git found conflicts. Resolve them in the working tree before continuing.')
  const firstLine = detail.split('\n').find(line => line.trim() !== '')?.trim() ?? 'Git command failed.'
  const redacted = firstLine.slice(0, 600)
  return new Error(redacted.startsWith('dsh-github:') ? redacted : `dsh-github: ${redacted}`)
}

function isStatusOverflow(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined
  return code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || code === 'ENOBUFS'
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
  const buffer = Buffer.from(text)
  if (buffer.byteLength <= maxBytes) return { text, truncated: false }
  let end = maxBytes
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--
  return { text: buffer.subarray(0, end).toString('utf8'), truncated: true }
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

async function readBoundedUntrackedFile(root: string, safePath: string, maxBytes: number): Promise<{ text: string; truncated: boolean; binary: boolean }> {
  const resolved = await realpath(resolve(root, safePath))
  const escaped = relative(root, resolved)
  if (escaped === '..' || escaped.startsWith(`..${sep}`) || isAbsolute(escaped)) throw new Error('dsh-github: file path escapes repository root')
  const handle = await open(resolved, 'r')
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

function parseLog(output: string): GitCommitSummary[] {
  return output.split('\n').map(line => line.trimEnd()).filter(Boolean).map(line => {
    const parts = line.split('|')
    const refsField = parts.pop() ?? ''
    const refs = refsField.split(', ').filter(Boolean).map(ref => ref.startsWith('HEAD -> ') ? ref.slice('HEAD -> '.length) : ref.startsWith('tag: ') ? ref.slice('tag: '.length) : ref)
    return {
      sha: parts[0] ?? '', shortSha: parts[1] ?? '', author: parts[2] ?? '', email: parts[3] ?? '',
      date: parts[4] ?? '', subject: parts.slice(5).join('|'), refs,
    }
  })
}

function isNameStatusLine(line: string): boolean {
  return /^(?:[AMD]\t|[RC]\d*\t)/.test(line)
}

function parseNameStatus(record: string): GitCommitFile | null {
  if (record.startsWith('R') || record.startsWith('C')) {
    const [, previousPath = null, path = ''] = record.split('\t')
    return { status: record.startsWith('R') ? 'renamed' : 'copied', path, previousPath }
  }
  if (record.startsWith('A')) return { status: 'added', path: record.slice(2), previousPath: null }
  if (record.startsWith('M')) return { status: 'modified', path: record.slice(2), previousPath: null }
  if (record.startsWith('D')) return { status: 'deleted', path: record.slice(2), previousPath: null }
  return null
}

function parseRefs(raw: string): string[] {
  return raw.split(', ').map(ref => ref.replace(/^HEAD -> /, '').replace(/^tag: /, '')).filter(Boolean)
}

function parseShowCommit(output: string, maxFiles: number): GitCommitDetail {
  const lines = output.split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const parts = (lines.shift() ?? '').split('|')
  const fileStart = lines.findIndex(isNameStatusLine)
  const bodyTail = fileStart === -1 ? lines : lines.slice(0, fileStart)
  const body = [parts.slice(7).join('|'), ...bodyTail].join('\n').replace(/\s+$/, '')
  const files: GitCommitFile[] = []
  let truncated = false
  if (fileStart !== -1) {
    for (const record of lines.slice(fileStart)) {
      if (files.length >= maxFiles) { truncated = true; break }
      const file = parseNameStatus(record)
      if (file !== null) files.push(file)
    }
  }
  return {
    sha: parts[0] ?? '', shortSha: parts[1] ?? '', author: parts[2] ?? '', email: parts[3] ?? '',
    date: parts[4] ?? '', subject: parts[5] ?? '', body, refs: parseRefs(parts[6] ?? ''), files, truncated,
  }
}

function parseStashList(output: string): GitStash[] {
  return output.split('\n').map(line => line.trimEnd()).filter(Boolean).map(line => {
    const [ref = '', sha = '', date = '', message = ''] = line.split('\t')
    return { ref, sha, date, message }
  })
}

function parseTagList(output: string): GitTag[] {
  return output.split('\n').map(line => line.trimEnd()).filter(Boolean).map(line => {
    const [name = '', sha = '', subject = ''] = line.split('\t')
    return { name, sha, subject }
  })
}

function parseRemotes(output: string): GitRemote[] {
  const byName = new Map<string, { fetchUrl: string; pushUrl: string }>()
  for (const line of output.split('\n')) {
    const trimmed = line.trimEnd()
    if (trimmed === '') continue
    const tab = trimmed.indexOf('\t')
    if (tab === -1) continue
    const name = trimmed.slice(0, tab)
    const rest = trimmed.slice(tab + 1)
    const push = rest.endsWith(' (push)')
    const fetch = rest.endsWith(' (fetch)')
    const url = push || fetch ? rest.slice(0, -(push ? ' (push)'.length : ' (fetch)'.length)) : rest
    const entry = byName.get(name) ?? { fetchUrl: '', pushUrl: '' }
    const displayed = remoteForDisplay(url) ?? url
    if (push) entry.pushUrl = displayed
    else if (fetch) entry.fetchUrl = displayed
    else if (entry.fetchUrl === '') entry.fetchUrl = displayed
    byName.set(name, entry)
  }
  return [...byName.entries()].map(([name, { fetchUrl, pushUrl }]) => ({ name, fetchUrl, pushUrl }))
}

/** Resolve one conflicted file by keeping the current side then the incoming side of every block. */
function mergeConflictBlocks(text: string): string {
  const lines = text.split('\n')
  const merged: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (line.startsWith('<<<<<<<')) {
      index++
      const ours: string[] = []
      while (index < lines.length && !lines[index]!.startsWith('=======')) { ours.push(lines[index]!); index++ }
      index++ // drop =======
      const theirs: string[] = []
      while (index < lines.length && !lines[index]!.startsWith('>>>>>>>')) { theirs.push(lines[index]!); index++ }
      index++ // drop >>>>>>>
      merged.push(...ours, ...theirs)
    } else {
      merged.push(line)
      index++
    }
  }
  return merged.join('\n')
}

/** Host-side Remote service for local Git state and GitHub browser links. */
export class GithubRuntime extends TypertRemoteService {
  private readonly rootCache = new Map<string, string>()
  private readonly knownRoots = new Set<string>()
  private readonly outputBuffer: GitOutputEntry[] = []

  /** @param ctx - owning Cordis context. @param config - resolved limits. */
  constructor(ctx: Context, private readonly config: ResolvedConfig) { super(ctx, 'github') }

  private recordOutput(entry: GitOutputEntry): void {
    this.outputBuffer.push(entry)
    if (this.outputBuffer.length > this.config.maxOutputEntries) {
      this.outputBuffer.splice(0, this.outputBuffer.length - this.config.maxOutputEntries)
    }
  }

  private git(args: string[], options: ExecOptions = {}): Promise<string> {
    return command('git', args, options, entry => this.recordOutput(entry))
  }

  /** Run a mutating Git command, map its failure, and invalidate the resolved-root cache. */
  private async write(args: string[], options: ExecOptions): Promise<string> {
    try {
      const output = await this.git(args, options)
      this.invalidateRootCache()
      return output
    } catch (error) {
      throw boundedGitError(error)
    }
  }

  /** Run a read-only Git validation command with a friendly error, without touching the root cache. */
  private async assertRef(args: string[], options: ExecOptions): Promise<void> {
    try { await this.git(args, options) } catch (error) { throw boundedGitError(error) }
  }

  private invalidateRootCache(): void {
    this.rootCache.clear()
  }

  private statusMaxBuffer(): number {
    return Math.max(64 * 1024, this.config.maxFiles * 8 * 1024 * 2)
  }

  private async root(path: string, signal?: AbortSignal): Promise<string> {
    if (!isAbsolute(path)) throw new Error(`dsh-github: refusing relative path "${path}"`)
    if (this.knownRoots.has(path)) return path
    const cached = this.rootCache.get(path)
    if (cached !== undefined) return cached
    const found = (await this.git(['rev-parse', '--show-toplevel'], { cwd: path, signal })).trim()
    this.rootCache.set(path, found)
    this.knownRoots.add(found)
    return found
  }

  private async readBranchState(root: string, signal?: AbortSignal): Promise<{ branch: string; upstream: string | null; ahead: number; behind: number }> {
    const branch = (await this.git(['branch', '--show-current'], { cwd: root, signal })).trim()
      || `HEAD ${(await this.git(['rev-parse', '--short', 'HEAD'], { cwd: root, signal })).trim()}`
    const upstream = await this.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: root, signal }).then(value => value.trim()).catch(() => null)
    let ahead = 0
    let behind = 0
    if (upstream !== null) {
      const [behindText, aheadText] = (await this.git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], { cwd: root, signal }).catch(() => '')).trim().split(/\s+/)
      behind = Number.parseInt(behindText ?? '0', 10) || 0
      ahead = Number.parseInt(aheadText ?? '0', 10) || 0
    }
    return { branch, upstream, ahead, behind }
  }

  private async readMergeState(root: string, signal?: AbortSignal): Promise<GitMergeState> {
    const [mergeHead, rebaseMerge, rebaseApply] = await Promise.all([
      this.git(['rev-parse', '--git-path', 'MERGE_HEAD'], { cwd: root, signal }).then(value => value.trim()),
      this.git(['rev-parse', '--git-path', 'rebase-merge'], { cwd: root, signal }).then(value => value.trim()),
      this.git(['rev-parse', '--git-path', 'rebase-apply'], { cwd: root, signal }).then(value => value.trim()),
    ])
    const exists = async (gitPath: string): Promise<boolean> => {
      try { await access(resolve(root, gitPath)); return true } catch { return false }
    }
    if (await exists(mergeHead)) return 'merge'
    if (await exists(rebaseMerge) || await exists(rebaseApply)) return 'rebase'
    return null
  }

  private async readStatusOutput(root: string, signal?: AbortSignal): Promise<string> {
    try {
      return await this.git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, signal, maxBuffer: this.statusMaxBuffer() })
    } catch (error) {
      if (isStatusOverflow(error)) throw new Error('dsh-github: too many changed files to list; raise maxFiles or commit changes')
      throw error
    }
  }

  private async remoteForBranch(root: string, branch: string, upstream: string | null, signal?: AbortSignal): Promise<{
    fetch: { name: string; url: string } | null
    push: { name: string; url: string } | null
  } | null> {
    const detached = branch.startsWith('HEAD ')
    const config = await this.git(['config', '--get-regexp', '^(branch\\..*\\.(remote|pushremote|pushRemote)|remote\\.(pushdefault|pushDefault))$'], { cwd: root, signal }).catch(() => '')
    const branchRemote = new Map<string, string>()
    const branchPushRemote = new Map<string, string>()
    let pushDefault = ''
    for (const line of config.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      const space = trimmed.search(/\s/)
      const key = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase()
      const value = space === -1 ? '' : trimmed.slice(space + 1)
      if (key === 'remote.pushdefault') pushDefault = value
      else if (key.startsWith('branch.') && key.endsWith('.pushremote')) branchPushRemote.set(key.slice('branch.'.length, -'.pushremote'.length), value)
      else if (key.startsWith('branch.') && key.endsWith('.remote')) branchRemote.set(key.slice('branch.'.length, -'.remote'.length), value)
    }
    const configured = detached ? '' : branchRemote.get(branch) ?? ''
    const upstreamRemote = detached || configured === '.' ? '' : upstream?.split('/', 1)[0] ?? ''
    const branchPush = detached ? '' : branchPushRemote.get(branch) ?? ''
    const remotes = (await this.git(['remote'], { cwd: root, signal }).catch(() => '')).split(/\s+/).filter(Boolean)
    const soleRemote = remotes.length === 1 ? remotes[0]! : ''
    const fetchName = configured && configured !== '.' ? configured : upstreamRemote || soleRemote
    const pushName = branchPush || pushDefault || (configured !== '.' ? configured : '') || upstreamRemote || soleRemote
    if (!fetchName && !pushName) return null
    const fetchUrl = fetchName === '' ? '' : await this.git(['remote', 'get-url', fetchName], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    const pushUrl = pushName === '' ? '' : await this.git(['remote', 'get-url', '--push', pushName], { cwd: root, signal }).then(value => value.trim()).catch(() => '')
    return {
      fetch: fetchName && fetchUrl ? { name: fetchName, url: fetchUrl } : null,
      push: pushName && pushUrl ? { name: pushName, url: pushUrl } : null,
    }
  }

  private async checkedBranch(root: string, branch: string, signal?: AbortSignal): Promise<string> {
    const checked = branchNameSchema.parse(branch)
    await this.assertRef(['check-ref-format', '--branch', checked], { cwd: root, signal })
    return checked
  }

  /** Read repository metadata and the bounded changed-file list. */
  @Remote
  async getStatus(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const branchStatePromise = this.readBranchState(root, signal)
    const headShaPromise = this.git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(value => value.trim()).catch(() => null)
    const statusPromise = this.readStatusOutput(root, signal)
    const mergeStatePromise = this.readMergeState(root, signal)
    const remotePromise = branchStatePromise.then(branchState => this.remoteForBranch(root, branchState.branch, branchState.upstream, signal))
    const [branchState, headSha, statusOutput, remote, mergeState] = await Promise.all([
      branchStatePromise, headShaPromise, statusPromise, remotePromise, mergeStatePromise,
    ])
    const displayedRemote = remoteForDisplay(remote?.fetch?.url ?? null)
    const repositoryUrl = githubUrl(remote?.fetch?.url ?? remote?.push?.url ?? null)
    const parsed = parseStatus(statusOutput, this.config.maxFiles, file => fileUrl(repositoryUrl, headSha, file))
    return {
      root, branch: branchState.branch, upstream: branchState.upstream,
      ahead: branchState.ahead, behind: branchState.behind,
      remoteName: remote?.fetch?.name ?? null,
      remoteUrl: displayedRemote,
      githubUrl: repositoryUrl,
      pushRemoteName: remote?.push?.name ?? null,
      pushRemoteUrl: remoteForDisplay(remote?.push?.url ?? null),
      headSha, commitUrl: commitUrl(repositoryUrl, headSha),
      mergeState, ...parsed,
    }
  }

  /** Read one repository-relative file's bounded unified diff. */
  @Remote
  async getDiff(path: string, filePath: string, mode: GitDiffMode, signal?: AbortSignal): Promise<GitDiff> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const statusOutput = await this.git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', safePath], { cwd: root, signal, maxBuffer: this.statusMaxBuffer() })
    const status = parseStatus(statusOutput, this.config.maxFiles * 4, () => null).files.find(file => file.path === safePath)
    let diff: string
    let truncated = false
    if (mode === 'working' && status?.kind === 'untracked') {
      const bounded = await readBoundedUntrackedFile(root, safePath, this.config.maxUntrackedBytes)
      if (bounded.binary) return { path: safePath, diff: `Binary file ${safePath} is not shown.\n`, truncated: bounded.truncated }
      diff = syntheticUntrackedDiff(safePath, bounded.text)
      truncated = bounded.truncated
    } else {
      const args = ['diff', '--no-ext-diff', '--unified=3', ...(mode === 'staged' ? ['--cached'] : []), '--', safePath]
      diff = await this.git(args, { cwd: root, signal })
    }
    const bounded = trimOutput(diff, this.config.maxDiffBytes)
    return { path: safePath, diff: bounded.text, truncated: truncated || bounded.truncated }
  }

  /** Stage one repository-relative path and return fresh status. */
  @Remote
  async stage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['add', '--', validateFilePath(root, filePath)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Remove one repository-relative path from the index and return fresh status. */
  @Remote
  async unstage(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const hasHead = await this.git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(() => true).catch(() => false)
    await this.write(hasHead ? ['restore', '--staged', '--', safePath] : ['rm', '--cached', '--', safePath], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Stage every working-tree change and return fresh status. */
  @Remote
  async stageAll(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['add', '--all'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Remove every staged path from the index and return fresh status. */
  @Remote
  async unstageAll(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const hasHead = await this.git(['rev-parse', '--verify', 'HEAD'], { cwd: root, signal }).then(() => true).catch(() => false)
    await this.write(hasHead ? ['restore', '--staged', '--', '.'] : ['rm', '--cached', '-r', '--', '.'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Discard one file's working-tree change (untracked files are unlinked) and return fresh status. */
  @Remote
  async discard(path: string, filePath: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const statusOutput = await this.git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', safePath], { cwd: root, signal, maxBuffer: this.statusMaxBuffer() })
    const file = parseStatus(statusOutput, 1, () => null).files.find(entry => entry.path === safePath)
    if (file?.kind === 'untracked') {
      await rm(resolve(root, safePath), { recursive: true, force: true })
      this.invalidateRootCache()
    } else {
      await this.write(['restore', '--', safePath], { cwd: root, signal })
    }
    return this.getStatus(root, signal)
  }

  /** Discard every working-tree change, optionally removing untracked files, and return fresh status. */
  @Remote
  async discardAll(path: string, includeUntracked: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['restore', '--', '.'], { cwd: root, signal })
    if (includeUntracked) await this.write(['clean', '-fd'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Commit staged changes with an explicit message and return fresh status. */
  @Remote
  async commit(path: string, message: string, amend: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const checked = commitMessageSchema.parse(message)
    await this.write(amend ? ['commit', '--amend', '-m', checked] : ['commit', '-m', checked], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Reset the last commit softly, preserving changes in the index, and return fresh status. */
  @Remote
  async undoLastCommit(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['reset', '--soft', 'HEAD~1'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Resolve one conflicted file toward ours, theirs, or a combined "both" and return fresh status. */
  @Remote
  async resolveConflict(path: string, filePath: string, strategy: GitConflictStrategy, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    if (strategy === 'ours') await this.write(['checkout', '--ours', '--', safePath], { cwd: root, signal })
    else if (strategy === 'theirs') await this.write(['checkout', '--theirs', '--', safePath], { cwd: root, signal })
    else {
      const absolute = resolve(root, safePath)
      const text = await readFile(absolute, 'utf8')
      await writeFile(absolute, mergeConflictBlocks(text))
      this.invalidateRootCache()
    }
    return this.getStatus(root, signal)
  }

  /** Push the current branch through the repository's configured Git transport. */
  @Remote
  async push(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.branch.startsWith('HEAD ')) throw new Error('dsh-github: cannot push a detached HEAD')
    if (status.pushRemoteName === null || status.pushRemoteUrl === null) throw new Error('dsh-github: a push remote is not configured')
    await this.write(status.upstream === null ? ['push', '-u', status.pushRemoteName, status.branch] : ['push'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Fetch one named remote (or all remotes) and return refreshed status. */
  @Remote
  async fetch(path: string, remoteName: string, all: boolean, prune: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    const pruneArgs = prune ? ['--prune'] : []
    let args: string[]
    if (remoteName !== '') {
      await this.assertRef(['check-ref-format', `refs/remotes/${remoteName}`], { cwd: status.root, signal })
      args = ['fetch', remoteName, ...pruneArgs]
    } else if (all) {
      args = ['fetch', '--all', ...pruneArgs]
    } else {
      if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a fetch remote is not configured')
      args = ['fetch', status.remoteName, ...pruneArgs]
    }
    await this.write(args, { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Pull the current branch from its upstream honoring local pull config and return fresh status. */
  @Remote
  async pull(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.upstream === null) throw new Error('dsh-github: current branch has no upstream')
    await this.write(['pull', '--no-edit'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Pull then push without force. */
  @Remote
  async sync(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.branch.startsWith('HEAD ')) throw new Error('dsh-github: cannot sync a detached HEAD')
    if (status.remoteName === null || status.remoteUrl === null) throw new Error('dsh-github: a fetch remote is not configured')
    if (status.pushRemoteName === null || status.pushRemoteUrl === null) throw new Error('dsh-github: a push remote is not configured')
    if (status.upstream !== null) await this.write(['pull', '--no-edit'], { cwd: status.root, signal })
    await this.write(status.upstream === null ? ['push', '-u', status.pushRemoteName, status.branch] : ['push'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Checkout a local or selected-remote branch without stashing or discarding changes. */
  @Remote
  async checkoutBranch(path: string, branch: string, remote: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const checked = await this.checkedBranch(root, branch, signal)
    const status = await this.getStatus(root, signal)
    const localExists = await this.git(['show-ref', '--verify', '--quiet', `refs/heads/${checked}`], { cwd: root, signal }).then(() => true).catch(() => false)
    if (remote && !localExists) {
      if (status.remoteName === null) throw new Error('dsh-github: no configured remote is available for this branch')
      const remoteRef = `refs/remotes/${status.remoteName}/${checked}`
      const fetched = await this.git(['show-ref', '--verify', '--quiet', remoteRef], { cwd: root, signal }).then(() => true).catch(() => false)
      if (!fetched) throw new Error(`dsh-github: remote branch ${status.remoteName}/${checked} is not fetched. Fetch the remote, then try again.`)
      await this.write(['switch', '--track', `${status.remoteName}/${checked}`], { cwd: root, signal })
    } else {
      await this.write(['switch', checked], { cwd: root, signal })
    }
    return this.getStatus(root, signal)
  }

  /** Create and checkout a branch without modifying working-tree changes. */
  @Remote
  async createBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['switch', '-c', await this.checkedBranch(root, branch, signal)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Create and checkout a branch rooted at a specific commit and return fresh status. */
  @Remote
  async createBranchFrom(path: string, branch: string, sha: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const checked = await this.checkedBranch(root, branch, signal)
    await this.write(['switch', '-c', checked, sha], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Rename a local branch, validating the new name, and return fresh status. */
  @Remote
  async branchRename(path: string, oldName: string, newName: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const oldChecked = branchNameSchema.parse(oldName)
    const newChecked = branchNameSchema.parse(newName)
    await this.assertRef(['check-ref-format', '--branch', newChecked], { cwd: root, signal })
    await this.write(['branch', '-m', oldChecked, newChecked], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Delete a fully-merged local branch and return fresh status. */
  @Remote
  async branchDelete(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['branch', '-d', await this.checkedBranch(root, branch, signal)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Merge a branch into the current branch without opening an editor and return fresh status. */
  @Remote
  async mergeBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['merge', '--no-edit', await this.checkedBranch(root, branch, signal)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Rebase the current branch onto another branch and return fresh status. */
  @Remote
  async rebaseBranch(path: string, branch: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['rebase', await this.checkedBranch(root, branch, signal)], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Abort an in-progress merge and return fresh status. */
  @Remote
  async abortMerge(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['merge', '--abort'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Abort an in-progress rebase and return fresh status. */
  @Remote
  async abortRebase(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['rebase', '--abort'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Continue an in-progress merge after resolving conflicts and return fresh status. */
  @Remote
  async continueMerge(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['merge', '--continue'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Continue an in-progress rebase after resolving conflicts and return fresh status. */
  @Remote
  async continueRebase(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['rebase', '--continue'], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Detach HEAD at a specific commit and return fresh status. */
  @Remote
  async checkoutCommit(path: string, sha: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['checkout', sha], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Read local and selected-remote branches and browser links derived from the configured GitHub remote. */
  @Remote
  async getRepositoryOverview(path: string, signal?: AbortSignal): Promise<GitRepositoryOverview> {
    const root = await this.root(path, signal)
    const status = await this.getStatus(root, signal)
    const remoteName = status.remoteName
    const refs = remoteName === null ? ['refs/heads'] : ['refs/heads', `refs/remotes/${remoteName}`]
    const branches = parseBranches(await this.git(['for-each-ref', '--format=%(refname)%09%(refname:short)%09%(upstream:short)%09%(HEAD)%00', ...refs], { cwd: root, signal }), remoteName)
    const repositoryUrl = status.githubUrl
    const current = branches.find(branch => branch.current && !branch.remote)
    const defaultBranch = remoteName === null ? null : await this.git(['symbolic-ref', '--short', `refs/remotes/${remoteName}/HEAD`], { cwd: root, signal }).then(value => value.trim().replace(new RegExp(`^${remoteName}/`), '')).catch(() => {
      const remoteBranches = new Set(branches.filter(branch => branch.remote).map(branch => branch.name))
      return remoteBranches.has('main') ? 'main' : remoteBranches.has('master') ? 'master' : null
    })
    const localBranches = new Set(branches.filter(branch => !branch.remote).map(branch => branch.name))
    const linkedBranches = branches.filter(branch => !branch.remote || !localBranches.has(branch.name)).map(branch => ({ ...branch, branchUrl: branchUrl(repositoryUrl, branch.name) }))
    const pushRepositoryUrl = githubUrl(status.pushRemoteUrl)
    return { branches: linkedBranches, remoteName, githubUrl: repositoryUrl, compareUrl: current === undefined ? null : compareUrl(repositoryUrl, current.name, current.upstream, defaultBranch, pushRepositoryUrl) }
  }

  /** Read the capped commit history, optionally filtered by a message/author query. */
  @Remote
  async log(path: string, query: string, signal?: AbortSignal): Promise<GitLog> {
    const root = await this.root(path, signal)
    const args = ['log', '--all', '--format=%H|%h|%an|%ae|%aI|%s|%D', `--max-count=${this.config.maxLogEntries}`]
    const search = query.trim()
    if (search !== '') args.push(`--grep=${search}`, '-i')
    const commits = parseLog(await this.git(args, { cwd: root, signal }))
    return { commits, truncated: commits.length >= this.config.maxLogEntries }
  }

  /** Read one commit's detail and capped file list. */
  @Remote
  async showCommit(path: string, sha: string, signal?: AbortSignal): Promise<GitCommitDetail> {
    const root = await this.root(path, signal)
    const output = await this.git(['show', '--name-status', '--format=%H|%h|%an|%ae|%aI|%s|%D|%b', '-M', sha], { cwd: root, signal })
    return parseShowCommit(output, this.config.maxFiles)
  }

  /** Read one commit's bounded diff for a single repository-relative file. */
  @Remote
  async showCommitDiff(path: string, sha: string, filePath: string, signal?: AbortSignal): Promise<GitDiff> {
    const root = await this.root(path, signal)
    const safePath = validateFilePath(root, filePath)
    const bounded = trimOutput(await this.git(['show', '--unified=3', sha, '--', safePath], { cwd: root, signal }), this.config.maxDiffBytes)
    return { path: safePath, diff: bounded.text, truncated: bounded.truncated }
  }

  /** Read the stash list, newest first. */
  @Remote
  async stashList(path: string, signal?: AbortSignal): Promise<GitStashList> {
    const root = await this.root(path, signal)
    const output = await this.git(['stash', 'list', '--format=%gd%x09%H%x09%aI%x09%gs'], { cwd: root, signal })
    return { stashes: parseStashList(output) }
  }

  /** Stash working-tree changes and return fresh status. */
  @Remote
  async stashCreate(path: string, message: string, includeUntracked: boolean, keepIndex: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    const args = ['stash', 'push']
    if (includeUntracked) args.push('-u')
    if (keepIndex) args.push('--keep-index')
    const trimmed = message.trim()
    if (trimmed !== '') args.push('-m', trimmed)
    await this.write(args, { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Apply (optionally dropping) one stash entry and return fresh status. */
  @Remote
  async stashApply(path: string, ref: string, drop: boolean, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(drop ? ['stash', 'pop', ref] : ['stash', 'apply', ref], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Drop one stash entry and return fresh status. */
  @Remote
  async stashDrop(path: string, ref: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['stash', 'drop', ref], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Read one stash entry's bounded diff. */
  @Remote
  async stashDiff(path: string, ref: string, signal?: AbortSignal): Promise<GitDiff> {
    const root = await this.root(path, signal)
    const bounded = trimOutput(await this.git(['stash', 'show', '-p', '--unified=3', ref], { cwd: root, signal }), this.config.maxDiffBytes)
    return { path: ref, diff: bounded.text, truncated: bounded.truncated }
  }

  /** Read the tag list, newest first. */
  @Remote
  async tagList(path: string, signal?: AbortSignal): Promise<GitTagList> {
    const root = await this.root(path, signal)
    const output = await this.git(['tag', '--list', '--sort=-creatordate', '--format=%(refname:short)%09%(objectname:short)%09%(subject)'], { cwd: root, signal })
    return { tags: parseTagList(output) }
  }

  /** Create an annotated or lightweight tag and return fresh status. */
  @Remote
  async tagCreate(path: string, name: string, message: string, atRef: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.assertRef(['check-ref-format', `refs/tags/${name}`], { cwd: root, signal })
    const trimmed = message.trim()
    const args = trimmed !== '' ? ['tag', '-a', name, '-m', trimmed] : ['tag', name]
    const target = atRef.trim()
    if (target !== '') args.push(target)
    await this.write(args, { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Delete a local tag and return fresh status. */
  @Remote
  async tagDelete(path: string, name: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['tag', '-d', name], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Push all local tags through the configured push remote and return fresh status. */
  @Remote
  async pushTags(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const status = await this.getStatus(path, signal)
    if (status.pushRemoteName === null || status.pushRemoteUrl === null) throw new Error('dsh-github: a push remote is not configured')
    await this.write(['push', status.pushRemoteName, '--tags'], { cwd: status.root, signal })
    return this.getStatus(status.root, signal)
  }

  /** Read the configured remotes with credential-free URLs. */
  @Remote
  async remoteList(path: string, signal?: AbortSignal): Promise<GitRemoteList> {
    const root = await this.root(path, signal)
    const output = await this.git(['remote', '-v'], { cwd: root, signal })
    return { remotes: parseRemotes(output) }
  }

  /** Add a remote with a validated name and return fresh status. */
  @Remote
  async remoteAdd(path: string, name: string, url: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.assertRef(['check-ref-format', `refs/remotes/${name}`], { cwd: root, signal })
    await this.write(['remote', 'add', name, url], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Remove a remote and return fresh status. */
  @Remote
  async remoteRemove(path: string, name: string, signal?: AbortSignal): Promise<GitStatus> {
    const root = await this.root(path, signal)
    await this.write(['remote', 'remove', name], { cwd: root, signal })
    return this.getStatus(root, signal)
  }

  /** Read the recorded Git command output buffer, newest first. */
  @Remote
  async getOutput(signal?: AbortSignal): Promise<GitOutput> {
    void signal
    return { entries: [...this.outputBuffer].reverse() }
  }
}
