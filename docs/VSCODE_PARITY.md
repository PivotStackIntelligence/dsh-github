# dsh-github VS Code 原生 Git 对齐规格（feat/vscode-parity）

本文件是本次改造的**唯一权威产品规格**。所有实现 agent 必须以此文件 + 已经定稿的共享契约
（`src/types.ts`、`src/contract.ts`、`src/typert.ts`、`src/client/remote.ts`、`src/index.ts`）为准。

目标：在 DeepSeek Harness Web 的**会话头部 Source Control 按钮 + 右缘滑入面板**里，**在形态与功能上完全模拟 VS Code 原生 Git 扩展的
Source Control 视图**，同时保留本插件的既有边界（本地 Git + GitHub 浏览器交接，无 GitHub API、无 token）。

## 1. 产品形态

### 1.1 总体布局

会话头部的 **Source Control 动作按钮**（⑂，`conversation.session.header.actions`）+ **右缘滑入 overlay 面板**（`shell.overlay`，宽 `min(980px, 96vw)`，滑入动画）；面板只绑定当前会话的工作区（cwd），无工作区切换下拉；面板内左右分栏（左 SCM 分组/提交区、右 diff 查看器）；不占满屏幕、无遮罩；`Esc`/`×`/再次点击按钮关闭，焦点归还按钮；无 cwd 时显示提示文案。

- 面板头部：仓库/workspace 名 + root 路径 + 刷新按钮 + GitHub 链接按钮（如有）+ `×` 关闭按钮。
- 左侧栏（VS Code SCM 侧栏的等价物），自上而下：
  1. **仓库头部**：仓库名（workspace 名）、当前分支、ahead/behind、GitHub 链接按钮、刷新按钮。
  2. **Commit 消息输入区**：多行 textarea + `Amend` 复选框 + `Commit` 主按钮 + `⌄` 下拉
     （Commit / Commit & Push / Commit & Sync / Undo Last Commit）+ 右侧圆形 `Sync/Publish` 按钮（带 ↑n ↓n 计数）。
  3. **STAGED CHANGES / CHANGES / MERGE CHANGES** 三个分组（VS Code 分组语义，untracked 并入 CHANGES 不再单独分组），
     可折叠、带数量 badge、组级动作（+ 全部暂存 / − 全部取消暂存 / ↶ 全部丢弃）。
  4. **COMMITS** 区段：搜索框（message/author）、提交列表（短 SHA + 标题 + 作者 + 相对日期 + refs badge）、
     点击展开详情（完整信息 + 改动文件列表，点文件看 diff）；操作：Copy SHA、Checkout Commit、Create Branch、Create Tag。
  5. **BRANCHES** 区段：当前分支高亮，hover 操作：checkout；右键/菜单：Rename、Delete、Merge into Current、Rebase onto。
  6. **REMOTES** 区段：每个 remote 一行（fetch url、push url），操作：Fetch、Fetch (Prune)、Add Remote、Remove Remote。
  7. **TAGS** 区段：tag 列表，操作：Create Tag、Push Tags、Delete Tag。
  8. **STASHES** 区段：stash 列表（message + 日期），操作：Apply、Apply & Drop、Drop、查看 diff。
  9. **GIT OUTPUT** 可折叠区（底部）：最近 git 命令及其输出（脱敏后）。
- 右侧 = **diff 查看器**：默认 side-by-side（左右两栏 + 行号 + 增删着色），可切换 inline 模式；
  文件头显示旧路径 → 新路径；冲突文件在 diff 头上提供 Accept Current / Accept Incoming / Accept Both。
- 面板打开即自动刷新；**打开期间每 3 秒轮询一次 getStatus**（关闭即停止）；窗口 focus / visibilitychange 立即刷新。

区段 4–8 采用**懒加载**：区段首次展开时才请求对应数据，之后随每次 status 刷新一并刷新（已展开的区段）。

### 1.2 视觉

- 文件状态 badge 颜色模仿 VS Code：`A` 绿、`M` 棕黄、`D` 红、`R/C` 蓝、`U`(untracked) 绿、`!`(conflict) 黄。
- diff 增删行颜色用主题变量 + 回退色（dark 风格：added `#1a7f37`/`#a5d6a7`，removed `#82071e`/`#ffa198`）；
  如页面提供 `--dsw-alias-*` 变量则优先使用，但需保证回退可读。
- 全部新增 UI 必须走 `src/client/locales.ts` 的 zh/en 词条（`DshGithubKey`），不许硬编码文案。
- 文件行 hover 才显示操作按钮（VS Code 行为）。

## 2. 功能清单与确切 git 命令（argv-only，禁止任何 shell 拼接）

所有命令使用 `execFile('git', args)`，环境统一加 `GIT_EDITOR=true`、`GIT_TERMINAL_PROMPT=0`（防编辑器/终端挂起）。
所有写操作执行前校验路径/分支名（复用 `validateFilePath` / `check-ref-format --branch`），执行后重读真实状态。
破坏性操作（下表标 ⚠️）必须在 UI 里走内联确认弹窗（自建 React modal，不用 window.confirm）。

### 2.1 改动与提交

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| Stage / Unstage / Stage All / Unstage All | 现有实现不变 | |
| Discard file ⚠️ | 未跟踪：unlink 文件（先 `status --porcelain` 确认 `??` 再 `fs.rm`）；已跟踪：`git restore -- <path>` | 返回新 status |
| Discard All ⚠️ | `git restore -- .`；参数 `includeUntracked=true` 时追加 `git clean -fd` | 弹窗明示影响范围 |
| Commit | `git commit -m <msg>` | 不变 |
| Commit (Amend) | `git commit --amend -m <msg>` | UI 勾选 Amend |
| Undo Last Commit ⚠️ | `git reset --soft HEAD~1` | 保留改动在 index |
| Resolve conflict ⚠️ | `git checkout --ours/--theirs -- <path>`；`both`：读文件、解析 `<<<<<<< / ======= / >>>>>>>` 标记、保留双方内容后写回 | kind=conflict 时文件行菜单 + diff 头按钮 |

### 2.2 同步

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| Fetch | `remoteName` 非空 → `git fetch <remoteName>`；否则 `all=true` → `git fetch --all`；`prune=true` 追加 `--prune`；两者皆空 → 当前分支 remote | REMOTES 区段每个 remote 提供独立 Fetch/Fetch(Prune) |
| Pull | `git pull --no-edit`（遵循本地 pull.rebase / ff 配置，替代旧 `--ff-only`） | |
| Push | 现逻辑不变（无 upstream 时 `push -u <remote> <branch>`） | 仍然禁止 force |
| Sync | pull + push 序列（现逻辑，pull 语义随上） | 无 upstream → Publish（即 push -u） |

### 2.3 分支

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| Checkout / Create | 现逻辑不变 | |
| Rename ⚠️ | `git branch -m <old> <new>`（新名过 check-ref-format） | |
| Delete ⚠️ | `git branch -d <name>` | 拒绝 unmerged 时报错提示，不提供 -D |
| Merge into current ⚠️ | `git merge --no-edit <branch>` | 冲突后 status 呈现 mergeState='merge' |
| Rebase onto ⚠️ | `git rebase <branch>` | 冲突后 mergeState='rebase' |
| Continue Merge | `git merge --continue`（mergeState='merge' 时显示） | |
| Abort Merge ⚠️ | `git merge --abort` | |
| Continue Rebase | `git rebase --continue` | |
| Abort Rebase ⚠️ | `git rebase --abort` | |
| Checkout Commit ⚠️ | `git checkout <sha>`（detach） | COMMITS 详情操作 |
| Create Branch From | `git switch -c <branch> <sha>` | COMMITS 详情操作 |

mergeState 检测：Host 在 `getStatus` 里通过 `git rev-parse --git-path` 定位 git dir，用 fs 检查
`MERGE_HEAD`（merge）、`rebase-merge`/`rebase-apply`（rebase）是否存在；状态模型加 `mergeState: 'merge' | 'rebase' | null`。

### 2.4 Remotes

| 操作 | 命令 |
| --- | --- |
| 列表 | `git remote -v` 解析为 `[{name, fetchUrl, pushUrl}]`，URL 经 `remoteForDisplay` 脱敏 |
| Add | `git remote add <name> <url>`（name 过 check-ref-format 的 remote 规则） |
| Remove ⚠️ | `git remote remove <name>` |
| Fetch / Fetch (Prune) | 见 2.2 |

### 2.5 Tags

| 操作 | 命令 |
| --- | --- |
| 列表 | `git tag --list --sort=-creatordate --format=%(refname:short)%09%(objectname:short)%09%(subject)` |
| Create | `git tag -a <name> -m <message>`（message 可空 → 轻量 `git tag <name>`；可选 atRef） |
| Delete ⚠️ | `git tag -d <name>` |
| Push Tags | `git push <pushRemote> --tags`（无 push remote 时报错） |

### 2.6 Stashes

| 操作 | 命令 |
| --- | --- |
| 列表 | `git stash list --format=%gd%x09%H%x09%aI%x09%gs` |
| Create | `git stash push [-u] [--keep-index] [-m <message>]` |
| Apply | `git stash apply <ref>` |
| Apply & Drop | `git stash pop <ref>` |
| Drop ⚠️ | `git stash drop <ref>` |
| Diff | `git stash show -p --unified=3 <ref>`，经 trimOutput 截断返回 |

### 2.7 历史

| 操作 | 命令 |
| --- | --- |
| 列表 | `git log --all --format=<format> --grep=<query> -i --author=<query> -i --max-count=<maxLogEntries>`，query 为空时不传过滤；format 输出 `%H|%h|%an|%ae|%aI|%s|%D`，逐行解析 |
| 详情 | `git show --name-status --format=<format> -M <sha>` 解析文件列表（上限同 maxFiles，置 truncated）；format 输出 `%H|%h|%an|%ae|%aI|%s|%b` |
| 文件 diff | `git show --unified=3 <sha> -- <path>`，经 trimOutput 截断 |

### 2.8 输出

`getOutput()`：Host 在内存维护环形 buffer（默认 50 条）记录每次 git 命令的
`{command, args(脱敏), ok, output(裁剪到 4KB, 脱敏), at}`；面板底部 GIT OUTPUT 区渲染。

## 3. 必须修复的既有问题（上轮审计，全部纳入本次）

1. **子进程编排**：`getStatus` 内 root 之后相互独立的命令用 `Promise.all` 并行；
   `remoteForBranch` 的多次 `git config --get` 合并为一次 `git config --get-regexp '^(branch\..*\.(remote|pushRemote)|remote\.pushDefault)$'`；
   可合并的 `rev-parse` 多参数一次调用（`--show-toplevel`、`--abbrev-ref HEAD`、`--verify HEAD`）。
2. **root 缓存**：`root()` 按 path 缓存（Map），写操作成功后失效；`getStatus`/写方法内部调用 `getStatus(root)` 时不再重复 `rev-parse --show-toplevel`（path 已是绝对 root 时短路）。
3. **getDiff 定向 status**：`git status --porcelain=v1 -z --untracked-files=all -- <safePath>` 替代全仓 status。
4. **trimOutput O(n²) 修复**：`Buffer.from` 后从 maxBytes 回退到 UTF-8 字符边界，单次 O(n)。
5. **maxBuffer 上限**：`Math.max(64*1024, maxFiles * 8 * 1024 * 2)`；buffer 溢出映射为友好错误（`dsh-github: too many changed files to list, raise maxFiles`）。
6. **凭据脱敏加宽**：错误信息里 `https?://` 之后到 `@` 的整段（无论是否含 `:`）统一替换为 `[credentials]@`；新增输出 buffer 同样脱敏。
7. **符号链接防护**：`readBoundedUntrackedFile` 前用 `realpath` 校验解析后路径仍在 root 内。
8. **MutationObserver 收窄**：`legacy-menu.tsx` 的 menu 扫描适配已随 v0.2 删除（入口改为会话头部按钮 + shell.overlay 右缘滑入面板），该条不再适用。
9. **client actions 生成**：`src/client/index.tsx` 用 contract 方法名列表生成 actions 包装（消除 14 段重复代码），保持 `GithubPanelActions` 面与契约一致。
10. **打包/工程**：`package.json` 加 `"prepublishOnly": "pnpm run check"`；`dsh.plugin.json` 的 contributes 填真实贡献；lockfile 里 `/Users/brianq` 绝对路径问题由 docs/打包 agent 处理（优先改用 registry 版本 devDeps 并重新生成 lockfile，若 registry 无对应版本则保留 link: 并在 README 说明本地开发要求 + CI 用发布版本）；新增 GitHub Actions `ci.yml`（install + pnpm run check）。

## 4. 共享契约（已定稿，实现 agent 禁止修改）

`src/types.ts`、`src/contract.ts`、`src/typert.ts`、`src/client/remote.ts`、`src/index.ts` 由协调者定稿，
Host/Client agent **只读**。方法名、wire 参数、schema 全部以这些文件为准；若发现契约缺字段导致无法实现，
在交付报告里写明，由协调者统一修订，不得自行改契约文件。

新增/变更的方法（详见 contract.ts）：

- 变更：`commit(path, message, amend, signal)`；`fetch(path, remoteName, all, prune, signal)`。
- 新增：`discard`、`discardAll`、`undoLastCommit`、`resolveConflict`、`stashList`、`stashCreate`、
  `stashApply`、`stashDrop`、`stashDiff`、`branchRename`、`branchDelete`、`mergeBranch`、`rebaseBranch`、
  `abortMerge`、`abortRebase`、`continueRebase`、`tagList`、`tagCreate`、`tagDelete`、`pushTags`、
  `remoteList`、`remoteAdd`、`remoteRemove`、`log`、`showCommit`、`showCommitDiff`、`checkoutCommit`、
  `createBranchFrom`、`getOutput`。

## 5. 明确不做（保持产品边界）

- GitHub API / token / OAuth / gh CLI；PR 创建仍走浏览器 compare 链接。
- force push、`reset --hard`、interactive rebase、自动 commit/push、git clean 默认包含 untracked 的隐式行为（仅显式勾选）。
- blame / 行内 gutter 指示（面板没有编辑器，无法等价）。
- 多根 workspace（DSH 面板一次绑定一个 workspace，与现状一致）。

## 6. 验收标准（全部满足才算完成）

1. `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build` 全绿。
2. 每个 Host 新方法都有 Vitest 用例（临时裸仓库 + 本地 bare remote 场景），破坏性操作的错误路径有断言。
3. 面板用例覆盖：分组折叠/计数、stage/unstage/discard 交互、Amend 提交、冲突 Accept 三选一、
   sync/publish 按钮状态、懒加载区段渲染、3s 轮询启动/停止、Esc/焦点圈闭。
4. 与 VS Code 对照：STAGED/CHANGES/MERGE 分组语义（untracked 在 CHANGES 内）、hover 才显操作、
   提交区布局、Sync 按钮的 ↑↓ 计数、区段折叠头 — 视觉与交互一致。
5. 性能：打开面板一次 getStatus ≤ 3 轮子进程批量（root 后并行），轮询期间 CPU 占用平稳。
6. 安全回归：路径逃逸、分支名校验、凭据脱敏、无 shell 拼接的既有测试全部保持通过。
