/** Product copy for the Source Control menu and panel. */
export const zh = {
  'menu.viewChanges': '查看 Source Control', 'menu.viewChanges.aria': '查看 {name} 的 Source Control',
  'panel.title': 'Source Control', 'panel.refresh': '刷新', 'panel.openGithub': '打开 GitHub', 'panel.close': '关闭',
  'panel.sourceControl': 'Source Control', 'panel.repository': '仓库', 'panel.loading': '正在读取 Git 状态…',
  'panel.loadingDiff': '正在读取文件差异…', 'panel.loadingRepository': '正在读取分支和仓库链接…',
  'panel.noUpstream': '未设置上游分支', 'panel.commitPlaceholder': '提交消息', 'panel.commit': '提交', 'panel.commitAndPush': '提交并推送',
  'panel.push': '推送', 'panel.fetch': 'Fetch', 'panel.pull': 'Pull', 'panel.syncChanges': '同步更改',
  'panel.publishBranch': '发布分支', 'panel.newBranchPlaceholder': '新分支名称', 'panel.createBranch': '创建分支',
  'panel.currentBranch': '当前分支', 'panel.openBranch': '打开分支', 'panel.remoteBranch': '{name} 远程分支', 'panel.filesChanged': '个文件改动', 'panel.commitShortcut': '⌘/Ctrl+Enter 提交',
  'panel.stage': '暂存改动', 'panel.unstage': '取消暂存', 'panel.stageAll': '全部暂存', 'panel.unstageAll': '全部取消暂存',
  'panel.stagedChanges': '已暂存的改动', 'panel.changes': '改动', 'panel.clean': '工作区干净',
  'panel.fileListTruncated': '文件列表已截断。', 'panel.selectFile': '选择一个文件查看差异', 'panel.staged': '已暂存',
  'panel.workingTree': '工作区', 'panel.noDiff': '没有可显示的差异。', 'panel.truncated': '差异输出已截断。',
  'panel.branches': '分支', 'panel.localBranches': '本地分支', 'panel.remoteBranches': '远程分支', 'panel.localBranch': '本地分支',
  'panel.githubLinks': 'GitHub 链接', 'panel.openCompare': '在 GitHub 创建 Pull Request',
  'panel.noGithubRemote': '未检测到 GitHub 远程仓库。',
  'panel.operation.stage': '正在暂存…', 'panel.operation.unstage': '正在取消暂存…',
  'panel.operation.stageAll': '正在暂存全部改动…', 'panel.operation.unstageAll': '正在取消全部暂存…',
  'panel.operation.commit': '正在提交…', 'panel.operation.commitAndPush': '正在提交并推送…', 'panel.operation.push': '正在推送…', 'panel.operation.fetch': '正在获取…',
  'panel.operation.pull': '正在拉取…', 'panel.operation.sync': '正在同步…',
  'panel.operation.checkoutBranch': '正在切换分支…', 'panel.operation.createBranch': '正在创建分支…',
} satisfies Record<string, string>
export type DshGithubKey = keyof typeof zh
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'dsh-github': DshGithubKey } }
export const en = {
  'menu.viewChanges': 'View Source Control', 'menu.viewChanges.aria': 'View Source Control for {name}',
  'panel.title': 'Source Control', 'panel.refresh': 'Refresh', 'panel.openGithub': 'Open GitHub', 'panel.close': 'Close',
  'panel.sourceControl': 'Source Control', 'panel.repository': 'Repository', 'panel.loading': 'Reading Git status…',
  'panel.loadingDiff': 'Reading file diff…', 'panel.loadingRepository': 'Reading branches and repository links…',
  'panel.noUpstream': 'No upstream branch', 'panel.commitPlaceholder': 'Commit message', 'panel.commit': 'Commit', 'panel.commitAndPush': 'Commit & Push',
  'panel.push': 'Push', 'panel.fetch': 'Fetch', 'panel.pull': 'Pull', 'panel.syncChanges': 'Sync Changes',
  'panel.publishBranch': 'Publish Branch', 'panel.newBranchPlaceholder': 'New branch name', 'panel.createBranch': 'Create Branch',
  'panel.currentBranch': 'Current branch', 'panel.openBranch': 'Open branch', 'panel.remoteBranch': '{name} remote branch', 'panel.filesChanged': 'files changed', 'panel.commitShortcut': '⌘/Ctrl+Enter to commit',
  'panel.stage': 'Stage changes', 'panel.unstage': 'Unstage changes', 'panel.stageAll': 'Stage All', 'panel.unstageAll': 'Unstage All',
  'panel.stagedChanges': 'Staged Changes', 'panel.changes': 'Changes', 'panel.clean': 'Working tree clean',
  'panel.fileListTruncated': 'File list truncated.', 'panel.selectFile': 'Select a file to view its diff', 'panel.staged': 'Staged',
  'panel.workingTree': 'Working Tree', 'panel.noDiff': 'No diff available.', 'panel.truncated': 'Diff output truncated.',
  'panel.branches': 'Branches', 'panel.localBranches': 'Local branches', 'panel.remoteBranches': 'Remote branches', 'panel.localBranch': 'Local branch',
  'panel.githubLinks': 'GitHub links', 'panel.openCompare': 'Create Pull Request in GitHub',
  'panel.noGithubRemote': 'No GitHub remote detected.',
  'panel.operation.stage': 'Staging…', 'panel.operation.unstage': 'Unstaging…', 'panel.operation.stageAll': 'Staging all changes…',
  'panel.operation.unstageAll': 'Unstaging all changes…', 'panel.operation.commit': 'Committing…', 'panel.operation.commitAndPush': 'Committing and pushing…', 'panel.operation.push': 'Pushing…',
  'panel.operation.fetch': 'Fetching…', 'panel.operation.pull': 'Pulling…', 'panel.operation.sync': 'Syncing…',
  'panel.operation.checkoutBranch': 'Switching branch…', 'panel.operation.createBranch': 'Creating branch…',
} satisfies Record<DshGithubKey, string>
export const NS = 'dsh-github'
export function fmt(template: string, params: Record<string, string>): string { return template.replace(/\{(\w+)\}/g, (_match, key: string) => params[key] ?? `{${key}}`) }
