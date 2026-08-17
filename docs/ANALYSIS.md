# dsh-github 实现分析

## 1. 目标与约束

`dsh-github` 的目标不是重新实现一个 GitHub 客户端，而是在 DeepSeek Harness 中提供接近 VS Code Source Control 的本地 Git 工作流，并把 GitHub 相关动作收敛为浏览器交接。

插件只使用当前 Workspace 中的本地 Git 仓库、`.git/config`、Git remote、SSH agent、SSH key 和 HTTPS credential helper。插件不使用 `gh` CLI、GitHub REST/GraphQL API、Octokit、Token 或 OAuth，也不暴露任意 shell 执行能力。

所有写操作都必须由用户在面板中明确触发。插件不会自动 stash、discard、merge、rebase、force push 或 prune remote refs。

## 2. 参考实现与可迁移经验

### VS Code Git

VS Code Git 的核心经验是把 Repository 状态、当前操作状态和 Source Control 资源分开管理：index、working tree、untracked files 和 conflicts 是不同的展示来源，同一个文件可以同时出现在 staged 和 working-tree 分组中。

本插件采用相同的状态分离方式，直接保留 Git porcelain status 的 index 与 worktree 两列，而不是将文件压缩成一个 `modified` 标记。这样可以正确决定每个文件当前应该显示 `Stage`、`Unstage`、冲突解决后的 `Stage`，还是 diff 查看入口。

VS Code 的另一个重要经验是操作状态必须可见。面板维护一个当前 operation，运行期间禁用相互冲突的按钮，操作结束后重新读取仓库状态；Commit 成功但后续 Push 失败时，不能回滚或隐藏已经创建的本地 commit。

### GitLens

GitLens 将仓库导航、分支导航和浏览器链接作为相互独立的功能。插件沿用功能划分的思路，但把改动、提交、分支、同步和浏览器链接收敛进「会话头部开关 + 右缘滑入 overlay 面板（绑定当前会话工作区）」：改动/提交区 + 懒加载的 COMMITS、BRANCHES、REMOTES、TAGS、STASHES 区段。

GitHub 页面是本地 Git 状态的浏览器入口，而不是第二套远程仓库数据源。仓库、分支、commit、文件、compare 和已经 Fetch 的 PR ref 都由本地 remote 与 ref 推导，打开后交由 GitHub 网页完成 PR 创建、评论和其他 GitHub 专属操作。

### isomorphic-git

isomorphic-git 对 HEAD、index 和 worktree 的分离说明了为什么不能只读取当前文件内容：Source Control 需要知道文件在 index 中的状态、工作区中的状态以及是否存在冲突或 rename 来源路径。

本插件没有引入 isomorphic-git 运行时依赖，而是使用系统 Git 的稳定输出格式读取这些状态，减少依赖和自维护代码。

## 3. 当前实现结构

```text
src/contract.ts       Typert invocation、输入约束和返回值 wire schema
src/types.ts          Host 与 Client 共用的 Git 状态类型
src/runtime.ts        本地 Git 命令、状态解析、操作和 GitHub URL 推导
src/client/remote.ts  Client 到 Host Remote 的适配
src/client/source-control.tsx
                      会话头部 ⑂ 开关（header.actions）+ 右缘滑入 overlay 面板（shell.overlay）+ 模块级 store（open 标志 + 开关元素）+ 当前会话 cwd 绑定
src/client/panel.tsx   滑入面板内的 SCM 面板：左分组/提交区、右 diff 查看器、懒加载区段与操作状态
src/client/diff.tsx   side-by-side / inline diff 查看器
src/client/confirm.tsx
                      内联确认弹窗（破坏性操作）
src/client/styles.ts  SCM 面板与 diff 的样式
src/client/locales.ts zh/en 词条（DshGithubKey）
```

Host 侧只有一个 Git 命令入口：固定调用 `execFile('git', args)`，所有路径通过仓库根目录解析并校验，所有写入操作完成后重新读取状态。Client 侧只通过 Typert Remote 调用 Host，不直接访问文件系统或凭据。

## 4. 状态模型

插件把一个文件的状态表示为两个 Git 状态列：

| 来源 | 含义 | 面板动作 |
| --- | --- | --- |
| index | 已暂存版本相对 HEAD 的状态 | 查看 staged diff、Unstage |
| worktree | 工作区版本相对 index 的状态 | 查看 working diff、Stage |
| `??` | 未跟踪文件 | 查看受限内容、Stage |
| `U` | 未解决冲突 | 查看冲突状态、解决后 Stage |
| `R` / `C` | rename / copy 及其来源路径 | 显示来源路径并保留文件链接 |

仓库级状态同时包含当前分支、upstream、ahead/behind、fetch remote、push remote、HEAD SHA 和可用浏览器链接。没有明确 remote 配置时，插件返回空链接或明确错误，不从多个 remote 中猜测一个目标。

本次新增 `mergeState: 'merge' | 'rebase' | null`：Host 在 `getStatus` 里通过 `git rev-parse --git-path` 定位 git dir，用 fs 检查 `MERGE_HEAD`（merge）与 `rebase-merge`/`rebase-apply`（rebase）是否存在，据此驱动面板上的 continue/abort 动作。

区段数据按需加载：COMMITS、BRANCHES、REMOTES、TAGS、STASHES 首次展开时才请求对应列表，之后随每次 status 刷新一并刷新（仅已展开的区段）。历史搜索、commit 详情、stash diff 等详情级查询单独按需发起。

Git 命令输出在 Host 内存维护一个环形 buffer（默认 50 条），记录每次 git 命令的 `{command, args(脱敏), ok, output(裁剪到 4KB 并脱敏), at}`，由 `getOutput()` 返回并在面板底部 GIT OUTPUT 区渲染。

对于没有首个 commit 的 unborn repository，插件使用 Git 当前可用的 index/worktree 状态，不假设 HEAD 已经存在。

## 5. 操作设计

所有命令使用 `execFile('git', args)`（argv-only，禁止任何 shell 拼接），环境统一加 `GIT_EDITOR=true`、`GIT_TERMINAL_PROMPT=0`。写操作执行前校验路径/分支名（复用 `validateFilePath` / `check-ref-format --branch`），执行后重读真实状态。破坏性操作（下表标 ⚠️）在 UI 里走内联确认弹窗（自建 React modal，不用 `window.confirm`）。

### 改动与提交

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| Stage / Unstage | `git add --` / 有 HEAD 时 `git restore --staged --`，unborn 用 `git rm --cached` | 现有实现不变 |
| Stage All / Unstage All | `git add --all` / 恢复整个 index | |
| Discard file ⚠️ | 未跟踪：确认 `??` 后 `fs.rm`；已跟踪：`git restore -- <path>` | 返回新 status |
| Discard All ⚠️ | `git restore -- .`；`includeUntracked=true` 追加 `git clean -fd` | 弹窗明示影响范围 |
| Commit | `git commit -m <msg>` | message 在 wire 层校验非空且有上限 |
| Commit (Amend) | `git commit --amend -m <msg>` | UI 勾选 Amend |
| Undo Last Commit ⚠️ | `git reset --soft HEAD~1` | 保留改动在 index |
| Resolve conflict ⚠️ | `git checkout --ours/--theirs -- <path>`；`both`：解析 `<<<<<<< / ======= / >>>>>>>` 标记、保留双方内容写回 | |

### 同步

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| Fetch | `git fetch <remote>`；`all=true` → `--all`；`prune=true` 追加 `--prune` | |
| Pull | `git pull --no-edit` | 遵循本地 pull.rebase / ff 配置（替代旧 `--ff-only`） |
| Push | 无 upstream 时 `push -u <remote> <branch>` | 仍然禁止 force |
| Sync | pull + push 序列；无 upstream → Publish | 不自动处理冲突 |

### 分支

| 操作 | 命令 |
| --- | --- |
| Checkout / Create | `git switch` / `git switch -c` |
| Rename ⚠️ | `git branch -m <old> <new>`（新名过 check-ref-format） |
| Delete ⚠️ | `git branch -d <name>`（不提供 -D） |
| Merge into current ⚠️ | `git merge --no-edit <branch>` |
| Rebase onto ⚠️ | `git rebase <branch>` |
| Continue / Abort Merge | `git merge --continue` / `git merge --abort` |
| Continue / Abort Rebase | `git rebase --continue` / `git rebase --abort` |
| Checkout Commit ⚠️ | `git checkout <sha>`（detach） |
| Create Branch From | `git switch -c <branch> <sha>` |

### Remotes

| 操作 | 命令 |
| --- | --- |
| 列表 | `git remote -v` 解析 `[{name, fetchUrl, pushUrl}]`，URL 经脱敏 |
| Add | `git remote add <name> <url>`（name 过 remote 规则校验） |
| Remove ⚠️ | `git remote remove <name>` |

### Tags

| 操作 | 命令 |
| --- | --- |
| 列表 | `git tag --list --sort=-creatordate --format=...` |
| Create | `git tag -a <name> -m <message>`（message 空 → 轻量；可选 atRef） |
| Delete ⚠️ | `git tag -d <name>` |
| Push Tags | `git push <pushRemote> --tags` |

### Stashes

| 操作 | 命令 |
| --- | --- |
| 列表 | `git stash list --format=...` |
| Create | `git stash push [-u] [--keep-index] [-m <message>]` |
| Apply / Apply & Drop | `git stash apply <ref>` / `git stash pop <ref>` |
| Drop ⚠️ | `git stash drop <ref>` |
| Diff | `git stash show -p --unified=3 <ref>`（trimOutput 截断） |

### 历史与输出

| 操作 | 命令 |
| --- | --- |
| 列表 | `git log --all --format=<format> --grep=<query> -i --author=<query> -i --max-count=<max>` |
| 详情 | `git show --name-status --format=<format> -M <sha>` |
| 文件 diff | `git show --unified=3 <sha> -- <path>`（trimOutput 截断） |
| 输出 | `getOutput()` 返回环形 buffer（见 §4） |

commit message 在 wire 层校验为非空且有长度上限。所有写操作（stage/unstage/discard/commit/fetch/pull/push/sync/branch/merge/rebase/tag/remote/stash）都有独立的运行状态，并在成功或失败后刷新状态。Push 遵循当前分支的 `branch.<name>.pushRemote`、`branch.<name>.remote` 和 `remote.pushDefault` 配置；没有 upstream 时，首次 Push 使用 `git push -u <remote> <branch>`，已有 upstream 时使用普通 `git push`。切换远程跟踪分支前要求该 ref 已经由本地 Git Fetch 得到；插件不会为了猜测分支而隐式 Fetch，也不会在有未提交改动时自动 stash。

## 6. GitHub 链接推导

插件只识别 GitHub remote URL，包括常见的 SSH、HTTPS 和 Git 协议形式，并去除凭据和 `.git` 后缀。非 GitHub remote 仍然可以用于本地 Git 操作，但不会生成 GitHub 页面链接。

支持的浏览器入口包括：

- repository：当前 remote 对应的仓库首页；
- branch：当前分支或已知远程分支页面；
- commit：当前 HEAD；
- file：当前 commit 中的文件；
- compare：当前分支相对默认分支或 upstream 的比较页面；
- pull request：本地已经 Fetch 的 `pull/<number>/head`、`pull/<number>/merge`、`pr/<number>/head` 或 `pr/<number>/merge` ref。

Fork 场景使用 fetch remote 作为 base repository，push remote 作为 head repository，生成 GitHub compare URL。创建 PR、评论、审查和合并仍由用户在浏览器中完成，避免本地插件复制 GitHub 权限和远程 API 逻辑。

## 7. 与 VS Code Source Control 的对应关系

| VS Code 习惯 | dsh-github 对应功能 |
| --- | --- |
| Source Control view | 会话头部开关 + 右缘滑入 overlay 面板（绑定当前会话工作区，左右分栏） |
| Staged Changes / Changes / Merge Changes | STAGED CHANGES / CHANGES / MERGE CHANGES 分组（带数量 badge） |
| Stage / Unstage resource | 文件级 Stage / Unstage |
| Discard / Discard All Changes | 带内联确认的 Discard / Discard All |
| Commit message box + Amend | commit 输入框 + Amend 复选框 |
| Commit / Commit & Push / Commit & Sync | Commit 下拉（Commit / Commit & Push / Commit & Sync） |
| Undo Last Commit | Undo Last Commit（`reset --soft HEAD~1`） |
| Accept Current / Incoming / Both Changes | 冲突文件的 Accept Current / Incoming / Both |
| Sync Changes + ↑↓ 计数 | Sync/Publish 按钮（pull --no-edit + push） |
| Commits history / commit details | COMMITS 区段 + 详情与逐文件 diff |
| Branch picker / branches | BRANCHES 区段（checkout/rename/delete/merge/rebase） |
| Remotes view | REMOTES 区段（fetch/prune/add/remove） |
| Tags view | TAGS 区段（create/push/delete） |
| Stashes view | STASHES 区段（apply/apply&drop/drop/diff） |
| Merge / Rebase continue & abort | mergeState 驱动的 continue/abort 动作 |
| Git output channel | GIT OUTPUT 可折叠区（环形 buffer） |
| Open in Remote / repository browser | GitHub 浏览器链接 |
| auto refresh | 打开即刷新 + 每 3s 轮询 + focus/visibilitychange 立即刷新 |
| operation progress | 面板 operation 状态和 live status |

## 8. 有意不实现的功能

以下功能不属于本插件的本地 Git + 浏览器交接范围：

- 通过 GitHub API 查询 issue、PR 列表、评论或 checks；
- 通过 Token、OAuth 或 GitHub App 管理远程身份；
- 在 Harness 内嵌 PR 创建、评论、审查或合并界面；
- force push、`reset --hard`、interactive rebase、自动 commit/push；
- blame / 行内 gutter 指示（面板没有编辑器，无法等价）；
- 多根 workspace（DSH 面板一次绑定一个 workspace）；
- 在本地未 Fetch 时远程猜测 PR 或分支；
- 复制 `gh` 的认证、配置和命令语义。

显式的 discard、stash、merge、rebase（含 continue/abort）与 `reset --soft`（Undo Last Commit）已纳入范围，但都要求用户明确触发并走内联确认，绝不自动执行。

这些限制是为了保持插件的权限范围与 VS Code Git 本地工作流一致，并避免在 Harness 中维护第二套 GitHub 客户端。

## 9. 验证范围

当前实现通过以下验证：

- TypeScript typecheck；
- ESLint；
- Vitest 单元测试：每个 Host 新方法都有用例（临时裸仓库 + 本地 bare remote 场景），破坏性操作的错误路径有断言；
- production build；
- `git diff --check`；
- 临时 Git 仓库中的 status、diff、stage/unstage、discard、commit/amend/undo-last-commit、conflict 三选一、fetch/pull/push/sync、branch rename/delete、merge/rebase continue-abort、remotes、tags、stashes、log/showCommit/showCommitDiff、unborn repository、PR ref 和 fork compare 场景；
- 面板用例：分组折叠/计数、stage/unstage/discard 交互、Amend 提交、冲突 Accept 三选一、sync/publish 按钮状态、懒加载区段渲染、3s 轮询启动/停止、Esc/焦点圈闭；
- 真实 Web Harness 重启后的会话头部 Source Control 开关与右缘滑入 overlay 面板（打开/关闭与轮询启停、Esc/×/再点按钮关闭、焦点归还、无 cwd 提示）、diff 查看器、各区段与 GIT OUTPUT、操作面板和浏览器 console/page error 检查。

## 10. 后续维护原则

继续扩展时，优先复用本地 Git 已有的 remote、ref 和 credential 配置；不要为了增加 GitHub 功能而引入远程 API、Token 或新的 Git 客户端抽象。

rc.6 的 Workspace 菜单兼容适配（`legacy-menu.tsx`）已于 v0.2 删除，入口为会话头部动作按钮（`conversation.session.header.actions`）与 `shell.overlay` 右缘滑入面板；壳层 details 列由官方工具详情占用、不可占用，因此采用头部开关 + overlay 的官方集成方式。除非出现明确的用户需求和可验证的本地 Git 使用场景，否则不增加 GitHub API、PR 管理或复杂的自动同步功能。
