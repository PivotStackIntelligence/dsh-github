import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

  it('uses configured pushDefault and encodes GitHub links safely', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'remote', 'add', 'work', 'git@github.com:owner/repo-name.git')
      await git(path, 'config', 'remote.pushDefault', 'work')
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

  it('keeps fetch and push remotes separate when local Git config says so', async () => {
    const path = await tempRepo()
    try {
      const branch = (await git(path, 'branch', '--show-current')).trim()
      await git(path, 'remote', 'add', 'upstream', 'git@github.com:owner/upstream.git')
      await git(path, 'remote', 'add', 'fork', 'git@github.com:owner/fork.git')
      await git(path, 'config', `branch.${branch}.remote`, 'upstream')
      await git(path, 'config', `branch.${branch}.pushRemote`, 'fork')
      await expect(new GithubRuntime(new Context(), config).getStatus(path)).resolves.toMatchObject({
        remoteName: 'upstream', remoteUrl: 'git@github.com:owner/upstream.git',
        pushRemoteName: 'fork', pushRemoteUrl: 'git@github.com:owner/fork.git', githubUrl: 'https://github.com/owner/upstream',
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
      const runtime = new GithubRuntime(new Context(), config)
      await expect(runtime.getStatus(path)).resolves.toMatchObject({ files: [expect.objectContaining({ path: 'README.md', kind: 'conflict' })] })
      await writeFile(`${path}/README.md`, 'resolved\n')
      await expect(runtime.stage(path, 'README.md')).resolves.toMatchObject({
        files: [expect.objectContaining({ path: 'README.md', index: 'M', worktree: ' ', kind: 'modified' })],
      })
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

  it('rejects unsafe paths and bounds output', async () => {
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
      await git(path, 'branch', '-M', 'main')
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

  it('creates a fork pull-request link using configured fetch and push remotes', async () => {
    const path = await tempRepo()
    try {
      await git(path, 'branch', '-M', 'main')
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
      await runtime.fetch(path)
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
      await expect(runtime.getRepositoryOverview(path)).resolves.toMatchObject({ branches: expect.arrayContaining([expect.objectContaining({ name: 'feature/remote', remote: true })]) })
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
