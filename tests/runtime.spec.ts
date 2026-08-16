import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { GithubRuntime } from '../src/runtime.ts'
import type { ResolvedConfig } from '../src/types.ts'

const execFileAsync = promisify(execFile)
async function git(path: string, ...args: string[]): Promise<string> { return (await execFileAsync('git', args, { cwd: path, encoding: 'utf8' })).stdout }

async function tempRepo(): Promise<string> {
  const path = await mkdtemp('/tmp/dsh-github-')
  await execFileAsync('git', ['init', path])
  await execFileAsync('git', ['branch', '-M', 'main'], { cwd: path })
  await writeFile(`${path}/README.md`, 'initial\n')
  await git(path, 'add', 'README.md')
  await git(path, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial')
  return path
}

const config: ResolvedConfig = {
  maxFiles: 200, maxDiffBytes: 20_000, maxUntrackedBytes: 20_000, maxLogEntries: 50, maxOutputEntries: 50,
}

async function bareRemote(): Promise<string> {
  const path = await mkdtemp('/tmp/dsh-github-remote-')
  await execFileAsync('git', ['init', '--bare', path])
  return path
}

/** Push one new commit into a bare remote by cloning it, committing, and pushing back. */
async function advanceRemote(remote: string, file: string, content: string): Promise<void> {
  const clone = await mkdtemp('/tmp/dsh-github-clone-')
  try {
    await execFileAsync('git', ['clone', remote, clone])
    await git(clone, 'config', 'user.name', 'Test')
    await git(clone, 'config', 'user.email', 'test@example.com')
    await writeFile(`${clone}/${file}`, content)
    await git(clone, 'add', file)
    await git(clone, 'commit', '-m', `advance ${file}`)
    await git(clone, 'push')
  } finally {
    await rm(clone, { recursive: true, force: true })
  }
}

describe('GithubRuntime', () => {
  it('reads status, diffs, and a GitHub remote', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'changed\n')
      await writeFile(`${path}/new.txt`, 'new line\n')
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      const runtime = new GithubRuntime(new Context(), config)
      const status = await runtime.getStatus(path)
      expect(status).toMatchObject({
        remoteName: 'origin', remoteUrl: 'git@github.com:owner/repo.git', githubUrl: 'https://github.com/owner/repo',
        headSha: expect.stringMatching(/^[0-9a-f]{40}$/), commitUrl: expect.stringMatching(/^https:\/\/github\.com\/owner\/repo\/commit\/[0-9a-f]{40}$/),
      })
      expect(status.files).toEqual([
        { path: 'README.md', index: ' ', worktree: 'M', kind: 'modified', previousPath: null, fileUrl: `https://github.com/owner/repo/blob/${status.headSha}/README.md` },
        { path: 'new.txt', index: '?', worktree: '?', kind: 'untracked', previousPath: null, fileUrl: null },
      ])
      await expect(runtime.getDiff(path, 'README.md', 'working')).resolves.toMatchObject({ diff: expect.stringContaining('-initial\n+changed') })
      await expect(runtime.getDiff(path, 'new.txt', 'working')).resolves.toMatchObject({ diff: expect.stringContaining('+new line') })
      await git(path, 'checkout', '--', 'README.md')
      await git(path, 'mv', 'README.md', 'README-renamed.md')
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ files: [expect.objectContaining({ path: 'README-renamed.md', kind: 'renamed', previousPath: 'README.md' }), expect.objectContaining({ path: 'new.txt' })] })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('encodes GitHub links safely for a single remote', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'work', 'git@github.com:owner/repo-name.git')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        remoteName: 'work', remoteUrl: 'git@github.com:owner/repo-name.git', githubUrl: 'https://github.com/owner/repo-name',
      })
      await git(path, 'remote', 'set-url', 'work', 'https://github.com/owner/repo-name.git')
      await git(path, 'switch', '-c', 'feature/topic/name')
      await expect(new GithubRuntime(new Context(), config).getRepositoryOverview(path)).resolves.toMatchObject({
        branches: expect.arrayContaining([expect.objectContaining({ name: 'feature/topic/name', branchUrl: 'https://github.com/owner/repo-name/tree/feature/topic/name' })]),
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('links fetched pull request refs to the GitHub pull request page', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      await git(path, 'update-ref', 'refs/remotes/origin/pr/42/head', 'HEAD')
      await expect(new GithubRuntime(new Context(), config).getRepositoryOverview(path)).resolves.toMatchObject({
        branches: expect.arrayContaining([expect.objectContaining({ name: 'pr/42/head', remote: true, branchUrl: 'https://github.com/owner/repo/pull/42' })]),
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('parses credentialed HTTPS and port-qualified SSH GitHub remotes', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'origin', 'https://user:secret@github.com/owner/repo.git')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        remoteUrl: 'https://github.com/owner/repo.git', githubUrl: 'https://github.com/owner/repo',
      })
      await git(path, 'remote', 'set-url', 'origin', 'ssh://git@github.com:22/owner/repo.git')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        remoteUrl: 'ssh://github.com:22/owner/repo.git', githubUrl: 'https://github.com/owner/repo',
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('does not guess between multiple unconfigured remotes', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/fork.git')
      await git(path, 'remote', 'add', 'upstream', 'git@github.com:owner/upstream.git')
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.getStatus(path)).resolves.toMatchObject({
        remoteName: null, remoteUrl: null, pushRemoteName: null, pushRemoteUrl: null, githubUrl: null,
      })
      await expect(runtime.push(path)).rejects.toThrow('a push remote is not configured')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('uses the current branch remote instead of assuming origin', async () => {
    const path = await tempRepo()
    try {
      const branch = (await git(path, 'branch', '--show-current')).trim()
      await git(path, 'remote', 'add', 'upstream', 'git@github.com:owner/repo.git')
      await git(path, 'config', `branch.${branch}.remote`, 'upstream')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        remoteName: 'upstream', remoteUrl: 'git@github.com:owner/repo.git', githubUrl: 'https://github.com/owner/repo',
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('resolves a per-branch push remote', async () => {
    const path = await tempRepo()
    const other = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      await git(path, 'remote', 'add', 'other', other)
      await git(path, 'config', 'branch.main.pushRemote', 'other')
      const status = await new GithubRuntime(new Context(), config).getStatus(path)
      expect(status.pushRemoteName).toBe('other')
      expect(status.pushRemoteUrl).toBe(other)
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(other, { recursive: true, force: true })
    }
  })

  it('resolves remote.pushDefault regardless of key case', async () => {
    const path = await tempRepo()
    const other = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      await git(path, 'remote', 'add', 'other', other)
      await git(path, 'config', 'remote.PushDefault', 'other')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        pushRemoteName: 'other', pushRemoteUrl: other,
      })
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(other, { recursive: true, force: true })
    }
  })

  it('creates a fork compare URL with the owner prefix', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'upstream', 'git@github.com:upstream-owner/repo.git')
      await git(path, 'remote', 'add', 'fork', 'git@github.com:fork-owner/repo.git')
      await git(path, 'update-ref', 'refs/remotes/upstream/main', 'HEAD')
      await git(path, 'switch', '-c', 'feature/fork')
      await git(path, 'config', 'branch.feature/fork.remote', 'upstream')
      await git(path, 'config', 'branch.feature/fork.merge', 'refs/heads/feature/fork')
      await git(path, 'config', 'branch.feature/fork.pushRemote', 'fork')
      await expect(new GithubRuntime(new Context(), config).getRepositoryOverview(path)).resolves.toMatchObject({
        githubUrl: 'https://github.com/upstream-owner/repo',
        compareUrl: 'https://github.com/upstream-owner/repo/compare/main...fork-owner:feature/fork?expand=1',
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('stages, unstages, commits, and separates working and staged diffs', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'staged\n')
      const runtime = new GithubRuntime(new Context(), config)
      const staged = await runtime.stage(path, 'README.md')
      expect(staged.files[0]).toMatchObject({ index: 'M', worktree: ' ' })
      await writeFile(`${path}/README.md`, 'working\n')
      await expect(runtime.getDiff(path, 'README.md', 'staged')).resolves.toMatchObject({ diff: expect.stringContaining('+staged') })
      await expect(runtime.getDiff(path, 'README.md', 'working')).resolves.toMatchObject({ diff: expect.stringContaining('+working') })
      const unstaged = await runtime.unstage(path, 'README.md')
      expect(unstaged.files[0]).toMatchObject({ index: ' ', worktree: 'M' })
      await runtime.stage(path, 'README.md')
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await expect(runtime.commit(path, 'panel commit', false)).resolves.toMatchObject({ files: [] })
      expect((await git(path, 'log', '-1', '--pretty=%s')).trim()).toBe('panel commit')
      await expect(runtime.commit(path, '   ', false)).rejects.toThrow()
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('stages and unstages every change', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'changed\n')
      await writeFile(`${path}/new.txt`, 'new\n')
      const runtime = new GithubRuntime(new Context(), config)
      const staged = await runtime.stageAll(path)
      expect(staged.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', index: 'M', worktree: ' ' }),
        expect.objectContaining({ path: 'new.txt', index: 'A', worktree: ' ' }),
      ]))
      const working = await runtime.unstageAll(path)
      expect(working.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', index: ' ', worktree: 'M' }),
        expect.objectContaining({ path: 'new.txt', kind: 'untracked' }),
      ]))
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('unstages an unborn repository without masking Git errors', async () => {
    const path = await mkdtemp('/tmp/dsh-github-unborn-')
    try {
      await execFileAsync('git', ['init', path])
      await writeFile(`${path}/new.txt`, 'new\n')
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.stage(path, 'new.txt')
      await expect(runtime.unstage(path, 'new.txt')).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'new.txt', kind: 'untracked' })],
      })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('returns actionable commit errors', async () => {
    const path = await tempRepo()
    try {
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.commit(path, 'empty commit', false)).rejects.toThrow('Nothing is staged to commit.')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('pushes through a configured local origin and lists branches', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', remote)
      const runtime = new GithubRuntime(new Context(), config)
      const result = await runtime.push(path)
      expect(result.remoteName).toBe('origin')
      expect(result.upstream).toMatch(/^origin\/(master|main)$/)
      const overview = await runtime.getRepositoryOverview(path)
      expect(overview.branches.filter(branch => branch.current && !branch.remote)).toHaveLength(1)
      expect(overview.branches.filter(branch => branch.name === result.branch)).toHaveLength(1)
      expect((await readFile(`${remote}/HEAD`, 'utf8')).startsWith('ref:')).toBe(true)
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
    }
  })

  it('rejects unsafe paths and bounds untracked output', async () => {
    await expect(new GithubRuntime(new Context(), config).getStatus('relative')).rejects.toThrow(/relative path/)
    const path = await tempRepo()
    try {
      await mkdir(`${path}/untracked`, { recursive: true })
      await writeFile(`${path}/untracked/large.txt`, 'x'.repeat(500))
      const runtime = new GithubRuntime(new Context(), { ...config, maxDiffBytes: 32, maxUntrackedBytes: 32 })
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ files: [expect.objectContaining({ path: 'untracked/large.txt', kind: 'untracked' })] })
      expect((await runtime.getDiff(path, 'untracked/large.txt', 'working')).truncated).toBe(true)
      await expect(runtime.getDiff(path, '../outside.txt', 'working')).rejects.toThrow(/escapes repository root/)
      await expect(runtime.getDiff(path, '/tmp/outside.txt', 'working')).rejects.toThrow(/repository-relative/)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('creates a pull-request link for a published branch without duplicating its remote ref', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      await git(path, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
      await git(path, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
      await git(path, 'switch', '-c', 'feature/source-control')
      await git(path, 'update-ref', 'refs/remotes/origin/feature/source-control', 'HEAD')
      await git(path, 'config', 'branch.feature/source-control.remote', 'origin')
      await git(path, 'config', 'branch.feature/source-control.merge', 'refs/heads/feature/source-control')
      const overview = await new GithubRuntime(new Context(), config).getRepositoryOverview(path)
      expect(overview).toMatchObject({
        githubUrl: 'https://github.com/owner/repo',
        compareUrl: 'https://github.com/owner/repo/compare/main...feature/source-control?expand=1',
        branches: expect.arrayContaining([
          expect.objectContaining({ name: 'feature/source-control', remote: false, branchUrl: 'https://github.com/owner/repo/tree/feature/source-control' }),
          expect.objectContaining({ name: 'main', remote: false, branchUrl: 'https://github.com/owner/repo/tree/main' }),
        ]),
      })
      expect(overview.branches.filter(branch => branch.name === 'feature/source-control')).toHaveLength(1)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('fetches, pulls, and syncs through a local origin', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    const clone = await mkdtemp('/tmp/dsh-github-clone-')
    try {
      await git(path, 'remote', 'add', 'origin', remote)
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.push(path)
      await execFileAsync('git', ['clone', remote, clone])
      await git(clone, 'config', 'user.name', 'Test')
      await git(clone, 'config', 'user.email', 'test@example.com')
      await writeFile(`${clone}/remote.txt`, 'from remote\n')
      await git(clone, 'add', 'remote.txt')
      await git(clone, 'commit', '-m', 'remote change')
      await git(clone, 'push')
      await expect(runtime.fetch(path, '', false, false)).resolves.toMatchObject({ behind: 1 })
      await expect(runtime.pull(path)).resolves.toMatchObject({ behind: 0 })
      await expect(readFile(`${path}/remote.txt`, 'utf8')).resolves.toBe('from remote\n')

      await writeFile(`${path}/sync.txt`, 'synced\n')
      await git(path, 'add', 'sync.txt')
      await git(path, 'commit', '-m', 'sync change')
      await expect(runtime.sync(path)).resolves.toMatchObject({ ahead: 0, behind: 0 })
      expect(await git(path, 'rev-parse', 'HEAD')).toBe(await git(clone, 'fetch', 'origin').then(() => git(clone, 'rev-parse', 'origin/HEAD')))
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
      await rm(clone, { recursive: true, force: true })
    }
  })

  it('checks out remote branches through the configured non-origin remote', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    const clone = await mkdtemp('/tmp/dsh-github-clone-')
    try {
      await git(path, 'remote', 'add', 'upstream', remote)
      await new GithubRuntime(new Context(), config).push(path)
      await execFileAsync('git', ['clone', remote, clone])
      await git(clone, 'remote', 'rename', 'origin', 'upstream')
      await git(clone, 'config', 'user.name', 'Test')
      await git(clone, 'config', 'user.email', 'test@example.com')
      await git(clone, 'switch', '-c', 'feature/non-origin')
      await writeFile(`${clone}/remote.txt`, 'remote branch\n')
      await git(clone, 'add', 'remote.txt')
      await git(clone, 'commit', '-m', 'remote branch')
      await git(clone, 'push', '-u', 'upstream', 'feature/non-origin')
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.fetch(path, 'upstream', false, false)
      await expect(runtime.checkoutBranch(path, 'feature/non-origin', true)).resolves.toMatchObject({ branch: 'feature/non-origin' })
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
      await rm(clone, { recursive: true, force: true })
    }
  })

  it('explains when a remote branch has not been fetched', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.checkoutBranch(path, 'feature/missing', true)).rejects.toThrow('is not fetched')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('creates branches and checks out local or remote branches safely', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    const clone = await (async () => {
      await git(path, 'remote', 'add', 'origin', remote)
      await new GithubRuntime(new Context(), config).push(path)
      const dir = await mkdtemp('/tmp/dsh-github-clone-')
      await execFileAsync('git', ['clone', remote, dir])
      await git(dir, 'config', 'user.name', 'Test')
      await git(dir, 'config', 'user.email', 'test@example.com')
      return dir
    })()
    try {
      await writeFile(`${clone}/branch.txt`, 'branch\n')
      await git(clone, 'switch', '-c', 'feature/remote')
      await git(clone, 'add', 'branch.txt')
      await git(clone, 'commit', '-m', 'remote branch')
      await git(clone, 'push', '-u', 'origin', 'feature/remote')
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.fetch(path, 'origin', false, false)
      await expect(runtime.getRepositoryOverview(path)).resolves.toMatchObject({ branches: expect.arrayContaining([expect.objectContaining({ name: 'feature/remote', remote: true })]) })
      await expect(runtime.checkoutBranch(path, 'feature/remote', true)).resolves.toMatchObject({ branch: 'feature/remote' })
      await expect(runtime.checkoutBranch(path, 'main', false)).resolves.toMatchObject({ branch: 'main' })
      await expect(runtime.createBranch(path, 'feature/local')).resolves.toMatchObject({ branch: 'feature/local' })
      await expect(runtime.createBranch(path, 'bad branch')).rejects.toThrow()
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
      await rm(clone, { recursive: true, force: true })
    }
  })

  it('discards tracked and untracked changes', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'tracked change\n')
      await writeFile(`${path}/untracked.txt`, 'untracked\n')
      const runtime = new GithubRuntime(new Context(), config)
      const afterTracked = await runtime.discard(path, 'README.md')
      expect(afterTracked.files.map(file => file.path)).toEqual(['untracked.txt'])
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('initial\n')
      const afterUntracked = await runtime.discard(path, 'untracked.txt')
      expect(afterUntracked.files).toEqual([])
      await expect(readFile(`${path}/untracked.txt`, 'utf8')).rejects.toThrow()
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('discards all changes with and without untracked files', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'tracked change\n')
      await writeFile(`${path}/untracked.txt`, 'untracked\n')
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.discardAll(path, false)).resolves.toMatchObject({ files: [expect.objectContaining({ path: 'untracked.txt' })] })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('initial\n')
      expect(await readFile(`${path}/untracked.txt`, 'utf8')).toBe('untracked\n')

      await writeFile(`${path}/README.md`, 'tracked change 2\n')
      await expect(runtime.discardAll(path, true)).resolves.toMatchObject({ files: [] })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('initial\n')
      await expect(readFile(`${path}/untracked.txt`, 'utf8')).rejects.toThrow()
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('undoes the last commit and leaves changes staged', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await writeFile(`${path}/README.md`, 'committed change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'second commit')
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.undoLastCommit(path)).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'README.md', index: 'M', worktree: ' ' })],
      })
      expect((await git(path, 'log', '-1', '--pretty=%s')).trim()).toBe('initial')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('amends the previous commit, replacing it with a new message', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const before = (await git(path, 'rev-parse', 'HEAD')).trim()
      const runtime = new GithubRuntime(new Context(), config)
      await writeFile(`${path}/README.md`, 'amended change\n')
      await runtime.stage(path, 'README.md')
      await expect(runtime.commit(path, 'amended message', true)).resolves.toMatchObject({ files: [] })
      expect((await git(path, 'log', '-1', '--pretty=%s')).trim()).toBe('amended message')
      expect((await git(path, 'rev-list', '--count', 'HEAD')).trim()).toBe('1')
      expect((await git(path, 'rev-parse', 'HEAD')).trim()).not.toBe(before)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('resolves conflicts toward ours, theirs, or both', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await git(path, 'switch', '-c', 'conflict')
      await writeFile(`${path}/README.md`, 'branch change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'branch change')
      await git(path, 'switch', 'main')
      await writeFile(`${path}/README.md`, 'main change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'main change')

      const startConflict = async (): Promise<void> => {
        await expect(runtime.mergeBranch(path, 'conflict')).rejects.toThrow()
        await expect(runtime.getStatus(path)).resolves.toMatchObject({
          mergeState: 'merge',
          files: [expect.objectContaining({ path: 'README.md', kind: 'conflict' })],
        })
      }

      await startConflict()
      await runtime.resolveConflict(path, 'README.md', 'ours')
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('main change\n')
      await runtime.abortMerge(path)

      await startConflict()
      await runtime.resolveConflict(path, 'README.md', 'theirs')
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('branch change\n')
      await runtime.abortMerge(path)

      await startConflict()
      await runtime.resolveConflict(path, 'README.md', 'both')
      const merged = await readFile(`${path}/README.md`, 'utf8')
      expect(merged).toContain('main change')
      expect(merged).toContain('branch change')
      expect(merged).not.toContain('<<<<<<<')
      expect(merged).not.toContain('>>>>>>>')
      await runtime.abortMerge(path)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('merges a branch, completes a conflicted merge, and aborts another', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await git(path, 'switch', '-c', 'feature')
      await writeFile(`${path}/feature.txt`, 'feature\n')
      await git(path, 'add', 'feature.txt')
      await git(path, 'commit', '-m', 'add feature')
      await git(path, 'switch', 'main')
      await expect(runtime.mergeBranch(path, 'feature')).resolves.toMatchObject({ branch: 'main', mergeState: null })
      expect(await readFile(`${path}/feature.txt`, 'utf8')).toBe('feature\n')

      // Divergent edits produce a conflict and a 'merge' state.
      await git(path, 'switch', '-c', 'conflict')
      await writeFile(`${path}/README.md`, 'branch change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'branch change')
      await git(path, 'switch', 'main')
      await writeFile(`${path}/README.md`, 'main change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'main change')
      await expect(runtime.mergeBranch(path, 'conflict')).rejects.toThrow()
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ mergeState: 'merge' })

      await runtime.resolveConflict(path, 'README.md', 'ours')
      await runtime.stage(path, 'README.md')
      await expect(runtime.continueMerge(path)).resolves.toMatchObject({ mergeState: null })

      // A fresh conflict, then abortMerge resets to the pre-merge state.
      await git(path, 'switch', '-c', 'conflict2')
      await writeFile(`${path}/README.md`, 'conflict2 change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'conflict2 change')
      await git(path, 'switch', 'main')
      await writeFile(`${path}/README.md`, 'main change 2\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'main change 2')
      await expect(runtime.mergeBranch(path, 'conflict2')).rejects.toThrow()
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ mergeState: 'merge' })
      await expect(runtime.abortMerge(path)).resolves.toMatchObject({ mergeState: null, branch: 'main' })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('main change 2\n')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('rebase conflict enters rebase state and aborts cleanly', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await git(path, 'switch', '-c', 'feature')
      await writeFile(`${path}/README.md`, 'feature change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'feature change')
      await git(path, 'switch', 'main')
      await writeFile(`${path}/README.md`, 'main change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'main change')
      await git(path, 'switch', 'feature')

      await expect(runtime.rebaseBranch(path, 'main')).rejects.toThrow()
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ mergeState: 'rebase' })
      await expect(runtime.abortRebase(path)).resolves.toMatchObject({ mergeState: null, branch: 'feature' })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('feature change\n')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('renames and deletes branches, refusing unmerged deletions', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await expect(runtime.branchRename(path, 'main', 'renamed')).resolves.toMatchObject({ branch: 'renamed' })
      await expect(runtime.branchRename(path, 'renamed', 'main')).resolves.toMatchObject({ branch: 'main' })

      await git(path, 'switch', '-c', 'merged-branch')
      await git(path, 'switch', 'main')
      await expect(runtime.branchDelete(path, 'merged-branch')).resolves.toMatchObject({ branch: 'main' })

      await git(path, 'switch', '-c', 'unmerged-branch')
      await writeFile(`${path}/unmerged.txt`, 'unmerged\n')
      await git(path, 'add', 'unmerged.txt')
      await git(path, 'commit', '-m', 'unmerged commit')
      await git(path, 'switch', 'main')
      await expect(runtime.branchDelete(path, 'unmerged-branch')).rejects.toThrow()
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('creates a branch from a commit and checks out commits into detached HEAD', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)
      const initialSha = (await git(path, 'rev-parse', 'HEAD')).trim()
      await expect(runtime.createBranchFrom(path, 'from-initial', initialSha)).resolves.toMatchObject({ branch: 'from-initial' })
      await expect(runtime.checkoutCommit(path, initialSha)).resolves.toMatchObject({ branch: `HEAD ${initialSha.slice(0, 7)}` })
      expect((await runtime.getStatus(path)).branch.startsWith('HEAD ')).toBe(true)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('lists history with refs and filters by subject', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await writeFile(`${path}/a.txt`, 'a\n')
      await git(path, 'add', 'a.txt')
      await git(path, 'commit', '-m', 'add alpha feature')
      await writeFile(`${path}/b.txt`, 'b\n')
      await git(path, 'add', 'b.txt')
      await git(path, 'commit', '-m', 'fix beta bug')
      await git(path, 'tag', 'v1', 'HEAD')
      const runtime = new GithubRuntime(new Context(), config)

      const all = await runtime.log(path, '')
      expect(all.commits.map(commit => commit.subject)).toEqual(['fix beta bug', 'add alpha feature', 'initial'])
      expect(all.commits[0]?.refs).toEqual(['main', 'v1'])

      expect((await runtime.log(path, 'alpha')).commits.map(commit => commit.subject)).toEqual(['add alpha feature'])
      expect((await runtime.log(path, 'zzz-no-match')).commits).toEqual([])
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('parses commit details including renames and refs', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await git(path, 'mv', 'README.md', 'README-renamed.md')
      await git(path, 'commit', '-m', 'rename the readme')
      await git(path, 'tag', 'v1', 'HEAD')
      const runtime = new GithubRuntime(new Context(), config)
      const detail = await runtime.showCommit(path, 'HEAD')
      expect(detail).toMatchObject({
        subject: 'rename the readme',
        refs: ['main', 'v1'],
        files: [{ status: 'renamed', path: 'README-renamed.md', previousPath: 'README.md' }],
      })
      expect(typeof detail.body).toBe('string')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('parses a commit body and refs', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await writeFile(`${path}/README.md`, 'body change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'subject line', '-m', 'body line')
      await git(path, 'tag', 'v1', 'HEAD')
      const runtime = new GithubRuntime(new Context(), config)
      const detail = await runtime.showCommit(path, 'HEAD')
      expect(detail.subject).toBe('subject line')
      expect(detail.body).toBe('body line')
      expect(detail.refs).toEqual(['main', 'v1'])
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('parses multiline commit bodies containing pipe characters', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await writeFile(`${path}/README.md`, 'pipe change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'pipe subject', '-m', 'first|part', '-m', 'second part')
      const runtime = new GithubRuntime(new Context(), config)
      const detail = await runtime.showCommit(path, 'HEAD')
      expect(detail.subject).toBe('pipe subject')
      expect(detail.body).toBe('first|part\n\nsecond part')
      expect(detail.refs).toEqual(['main'])
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('bounds showCommitDiff output', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      await writeFile(`${path}/big.txt`, 'x'.repeat(500) + '\n')
      await git(path, 'add', 'big.txt')
      await git(path, 'commit', '-m', 'add big file')
      const runtime = new GithubRuntime(new Context(), { ...config, maxDiffBytes: 32 })
      const diff = await runtime.showCommitDiff(path, 'HEAD', 'big.txt')
      expect(diff.truncated).toBe(true)
      expect(diff.diff.length).toBeLessThan(500)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('creates stashes in plain, untracked, and keep-index modes', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await writeFile(`${path}/README.md`, 'stash plain\n')
      await writeFile(`${path}/untracked.txt`, 'untracked\n')
      await expect(runtime.stashCreate(path, 'plain', false, false)).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'untracked.txt' })],
      })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('initial\n')

      await expect(runtime.stashCreate(path, 'with untracked', true, false)).resolves.toMatchObject({ files: [] })
      await expect(readFile(`${path}/untracked.txt`, 'utf8')).rejects.toThrow()

      await writeFile(`${path}/README.md`, 'keep me\n')
      await runtime.stage(path, 'README.md')
      await expect(runtime.stashCreate(path, 'keep index', false, true)).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'README.md', index: 'M', worktree: ' ' })],
      })

      const list = await runtime.stashList(path)
      expect(list.stashes.map(stash => stash.message)).toEqual([
        expect.stringContaining('keep index'),
        expect.stringContaining('with untracked'),
        expect.stringContaining('plain'),
      ])
      expect(list.stashes[0]?.ref).toBe('stash@{0}')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('applies, pops, and drops stashes', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)

      await writeFile(`${path}/README.md`, 'stash one\n')
      await runtime.stashCreate(path, 'first', false, false)
      await writeFile(`${path}/README.md`, 'stash two\n')
      await runtime.stashCreate(path, 'second', false, false)
      expect((await runtime.stashList(path)).stashes).toHaveLength(2)

      await expect(runtime.stashApply(path, 'stash@{0}', false)).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'README.md' })],
      })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('stash two\n')
      expect((await runtime.stashList(path)).stashes).toHaveLength(2)

      await git(path, 'checkout', '--', 'README.md')
      await expect(runtime.stashApply(path, 'stash@{0}', true)).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'README.md' })],
      })
      expect(await readFile(`${path}/README.md`, 'utf8')).toBe('stash two\n')
      expect((await runtime.stashList(path)).stashes).toHaveLength(1)

      await runtime.stashDrop(path, 'stash@{0}')
      expect((await runtime.stashList(path)).stashes).toHaveLength(0)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('returns a bounded stash diff', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'config', 'user.name', 'Test')
      await git(path, 'config', 'user.email', 'test@example.com')
      const runtime = new GithubRuntime(new Context(), config)
      await writeFile(`${path}/README.md`, 'stash diff\n')
      await runtime.stashCreate(path, 'diff stash', false, false)
      const diff = await runtime.stashDiff(path, 'stash@{0}')
      expect(diff.path).toBe('stash@{0}')
      expect(diff.diff).toContain('+stash diff')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('creates annotated and lightweight tags, lists, deletes, and pushes them', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', remote)
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.push(path)

      await runtime.tagCreate(path, 'v1', 'version one', '')
      await runtime.tagCreate(path, 'v2', '', '')
      const list = await runtime.tagList(path)
      expect(list.tags).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'v1', subject: 'version one' }),
        expect.objectContaining({ name: 'v2', subject: 'initial' }),
      ]))

      await runtime.tagDelete(path, 'v1')
      expect((await runtime.tagList(path)).tags.map(tag => tag.name)).not.toContain('v1')

      await runtime.pushTags(path)
      const remoteTags = await git(path, 'ls-remote', '--tags', remote)
      expect(remoteTags).toContain('refs/tags/v2')
      expect(remoteTags).not.toContain('refs/tags/v1')
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
    }
  })

  it('lists, adds, and removes remotes with credential stripping', async () => {
    const path = await tempRepo()
    try {
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.remoteAdd(path, 'origin', 'https://user:secret@example.com/x.git')
      expect((await runtime.remoteList(path)).remotes).toEqual([
        { name: 'origin', fetchUrl: 'https://example.com/x.git', pushUrl: 'https://example.com/x.git' },
      ])
      await runtime.remoteRemove(path, 'origin')
      expect((await runtime.remoteList(path)).remotes).toEqual([])
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('fetches a targeted remote or all remotes', async () => {
    const path = await tempRepo()
    const origin = await bareRemote()
    const other = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', origin)
      await git(path, 'remote', 'add', 'other', other)
      const runtime = new GithubRuntime(new Context(), config)
      await git(path, 'push', '-u', 'origin', 'main')
      await git(path, 'push', 'other', 'main')
      await git(path, 'fetch', 'other')
      const originBefore = (await git(path, 'rev-parse', 'refs/remotes/origin/main')).trim()
      const otherBefore = (await git(path, 'rev-parse', 'refs/remotes/other/main')).trim()

      await advanceRemote(origin, 'origin.txt', 'origin change\n')
      await expect(runtime.fetch(path, 'origin', false, false)).resolves.toMatchObject({ behind: 1 })
      expect((await git(path, 'rev-parse', 'refs/remotes/origin/main')).trim()).not.toBe(originBefore)
      expect((await git(path, 'rev-parse', 'refs/remotes/other/main')).trim()).toBe(otherBefore)

      await advanceRemote(other, 'other.txt', 'other change\n')
      const originAfterTargeted = (await git(path, 'rev-parse', 'refs/remotes/origin/main')).trim()
      await runtime.fetch(path, '', true, false)
      expect((await git(path, 'rev-parse', 'refs/remotes/other/main')).trim()).not.toBe(otherBefore)
      expect((await git(path, 'rev-parse', 'refs/remotes/origin/main')).trim()).toBe(originAfterTargeted)
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(origin, { recursive: true, force: true })
      await rm(other, { recursive: true, force: true })
    }
  })

  it('records output newest-first and redacts credential URLs', async () => {
    const path = await tempRepo()
    try {
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.remoteAdd(path, 'origin', 'https://user:secret@example.com/x.git')
      const output = await runtime.getOutput()
      expect(output.entries.length).toBeGreaterThan(0)

      const serialized = JSON.stringify(output.entries.map(entry => ({ args: entry.args, output: entry.output })))
      expect(serialized).not.toContain('secret')
      expect(serialized).toContain('https://[credentials]@example.com/x.git')

      const addIndex = output.entries.findIndex(entry => entry.args[0] === 'remote' && entry.args[1] === 'add')
      const checkIndex = output.entries.findIndex(entry => entry.args[0] === 'check-ref-format')
      expect(addIndex).toBeGreaterThanOrEqual(0)
      expect(addIndex).toBeLessThan(checkIndex)
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('rejects an untracked symlink that escapes the repository root', async () => {
    const path = await tempRepo()
    const outside = await mkdtemp('/tmp/dsh-github-outside-')
    try {
      await writeFile(`${outside}/secret.txt`, 'secret\n')
      await symlink(`${outside}/secret.txt`, `${path}/link.txt`)
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.getDiff(path, 'link.txt', 'working')).rejects.toThrow(/escapes repository root/)
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('truncates a large tracked diff when maxDiffBytes is tiny', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'x'.repeat(2000) + '\n')
      const runtime = new GithubRuntime(new Context(), { ...config, maxDiffBytes: 32 })
      const diff = await runtime.getDiff(path, 'README.md', 'working')
      expect(diff.truncated).toBe(true)
      expect(diff.diff.length).toBeLessThan(2000)
    } finally { await rm(path, { recursive: true, force: true }) }
  })
})
