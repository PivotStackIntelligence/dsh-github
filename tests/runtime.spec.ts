import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { GithubRuntime } from '../src/runtime.ts'

const execFileAsync = promisify(execFile)
async function git(path: string, ...args: string[]): Promise<string> { return (await execFileAsync('git', args, { cwd: path, encoding: 'utf8' })).stdout }

async function tempRepo(): Promise<string> {
  const path = await mkdtemp('/tmp/dsh-github-')
  await execFileAsync('git', ['init', path])
  await writeFile(`${path}/README.md`, 'initial\n')
  await git(path, 'add', 'README.md')
  await git(path, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial')
  return path
}

const config = { maxFiles: 200, maxDiffBytes: 20_000, maxUntrackedBytes: 20_000 }

async function bareRemote(): Promise<string> {
  const path = await mkdtemp('/tmp/dsh-github-remote-')
  await execFileAsync('git', ['init', '--bare', path])
  return path
}

async function cloneRemote(remote: string): Promise<string> {
  const path = await mkdtemp('/tmp/dsh-github-clone-')
  await execFileAsync('git', ['clone', remote, path])
  await git(path, 'config', 'user.name', 'Test')
  await git(path, 'config', 'user.email', 'test@example.com')
  return path
}


describe('GithubRuntime', () => {
  it('reads status, diffs, and a GitHub remote', async () => {
    const path = await tempRepo()
    try {
      await writeFile(`${path}/README.md`, 'changed\n')
      await writeFile(`${path}/new.txt`, 'new line\n')
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.getStatus(path)).resolves.toMatchObject({
        remoteUrl: 'git@github.com:owner/repo.git', githubUrl: 'https://github.com/owner/repo',
        files: [{ path: 'README.md', index: ' ', worktree: 'M' }, { path: 'new.txt', kind: 'untracked' }],
      })
      await expect(runtime.getDiff(path, 'README.md', 'working')).resolves.toMatchObject({ diff: expect.stringContaining('-initial\n+changed') })
      await expect(runtime.getDiff(path, 'new.txt', 'working')).resolves.toMatchObject({ diff: expect.stringContaining('+new line') })
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
      await expect(runtime.commit(path, 'panel commit')).resolves.toMatchObject({ files: [] })
      expect((await git(path, 'log', '-1', '--pretty=%s')).trim()).toBe('panel commit')
      await expect(runtime.commit(path, '   ')).rejects.toThrow()
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

  it('marks unmerged paths as conflicts', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'switch', '-c', 'conflict')
      await writeFile(`${path}/README.md`, 'branch change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'branch change')
      await git(path, 'switch', '-')
      await writeFile(`${path}/README.md`, 'main change\n')
      await git(path, 'add', 'README.md')
      await git(path, 'commit', '-m', 'main change')
      await expect(git(path, 'merge', 'conflict')).rejects.toThrow()
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({ files: [expect.objectContaining({ path: 'README.md', kind: 'conflict' })] })
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('returns actionable commit errors', async () => {
    const path = await tempRepo()
    try {
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.commit(path, 'empty commit')).rejects.toThrow('Nothing is staged to commit.')
    } finally { await rm(path, { recursive: true, force: true }) }
  })

  it('pushes through a configured local origin and lists branches', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    try {
      await git(path, 'remote', 'add', 'origin', remote)
      const runtime = new GithubRuntime(new Context(), config)
      const result = await runtime.push(path)
      expect(result.upstream).toMatch(/^origin\/(master|main)$/)
      const overview = await runtime.getRepositoryOverview(path)
      expect(overview.branches.some(branch => branch.current && !branch.remote)).toBe(true)
      expect(overview.branches.some(branch => branch.remote)).toBe(true)
      expect((await readFile(`${remote}/HEAD`, 'utf8')).startsWith('ref:')).toBe(true)
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
    }
  })

  it('rejects unsafe paths and bounds output', async () => {
    await expect(new GithubRuntime(new Context(), config).getStatus('relative')).rejects.toThrow(/relative path/)
    const path = await tempRepo()
    try {
      await writeFile(`${path}/large.txt`, 'x'.repeat(500))
      const runtime = new GithubRuntime(new Context(), { ...config, maxDiffBytes: 32, maxUntrackedBytes: 32 })
      expect((await runtime.getDiff(path, 'large.txt', 'working')).truncated).toBe(true)
      await expect(runtime.getDiff(path, '../outside.txt', 'working')).rejects.toThrow(/escapes repository root/)
      await expect(runtime.getDiff(path, '/tmp/outside.txt', 'working')).rejects.toThrow(/repository-relative/)
    } finally { await rm(path, { recursive: true, force: true }) }
  })


  it('derives GitHub repository and compare links from local Git config', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'branch', '-M', 'main')
      await git(path, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
      await git(path, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
      await git(path, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
      await git(path, 'switch', '-c', 'feature/source-control')
      await expect(new GithubRuntime(new Context(), config).getRepositoryOverview(path)).resolves.toMatchObject({
        githubUrl: 'https://github.com/owner/repo',
        compareUrl: 'https://github.com/owner/repo/compare/main...feature%2Fsource-control?expand=1',
      })
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
      await expect(runtime.fetch(path)).resolves.toMatchObject({ behind: 1 })
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

  it('creates branches and checks out local or remote branches safely', async () => {
    const path = await tempRepo()
    const remote = await bareRemote()
    const clone = await (async () => {
      await git(path, 'remote', 'add', 'origin', remote)
      await new GithubRuntime(new Context(), config).push(path)
      return cloneRemote(remote)
    })()
    try {
      await writeFile(`${clone}/branch.txt`, 'branch\n')
      await git(clone, 'switch', '-c', 'feature/remote')
      await git(clone, 'add', 'branch.txt')
      await git(clone, 'commit', '-m', 'remote branch')
      await git(clone, 'push', '-u', 'origin', 'feature/remote')
      const runtime = new GithubRuntime(new Context(), config)
      await runtime.fetch(path)
      await expect(runtime.checkoutBranch(path, 'feature/remote', true)).resolves.toMatchObject({ branch: 'feature/remote' })
      const defaultBranch = (await git(path, 'branch', '--format=%(refname:short)')).includes('main') ? 'main' : 'master'
      await expect(runtime.checkoutBranch(path, defaultBranch, false)).resolves.toMatchObject({ branch: defaultBranch })
      await expect(runtime.createBranch(path, 'feature/local')).resolves.toMatchObject({ branch: 'feature/local' })
      await expect(runtime.createBranch(path, 'bad branch')).rejects.toThrow()
    } finally {
      await rm(path, { recursive: true, force: true })
      await rm(remote, { recursive: true, force: true })
      await rm(clone, { recursive: true, force: true })
    }
  })


})
