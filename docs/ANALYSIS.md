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

GitLens 将仓库导航、分支导航和浏览器链接作为相互独立的功能。插件沿用这一划分：Source Control tab 负责改动和 commit，Repository tab 负责分支、同步和 GitHub 链接。

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
src/client/panel.tsx  Source Control / Repository 面板和交互状态
src/client/row.tsx    Workspace 菜单入口
src/client/legacy-menu.tsx
                      rc.6 下的 Workspace 菜单兼容适配
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

对于没有首个 commit 的 unborn repository，插件使用 Git 当前可用的 index/worktree 状态，不假设 HEAD 已经存在。

## 5. 操作设计

### 改动操作

- `stage(path)`：使用 `git add -- <path>`。
- `unstage(path)`：有 HEAD 时使用 `git restore --staged -- <path>`；unborn repository 使用 `git rm --cached`。
- `stageAll()`：使用 `git add --all`。
- `unstageAll()`：有 HEAD 时恢复整个 index；unborn repository 移除 index 中的缓存路径。
- `getDiff()`：使用 staged 或 working-tree 对应的 `git diff`，未跟踪文件生成受限的预览，不读取无限大小内容。

### Commit 与同步

Commit message 在 wire 层校验为非空且有长度上限。Commit、Push、Fetch、`pull --ff-only` 和 Sync 都有独立的运行状态，并在成功或失败后刷新状态。

Push 遵循当前分支的 `branch.<name>.pushRemote`、`branch.<name>.remote` 和 `remote.pushDefault` 配置。没有 upstream 时，首次 Push 使用 `git push -u <remote> <branch>`；已有 upstream 时使用普通 `git push`。

Sync 只做 Pull（fast-forward only）和 Push，不自动处理冲突，不执行 merge、rebase 或 force push。用户可以在 Git 工具或终端中解决复杂同步问题，然后刷新面板。

### 分支

Repository tab 展示本地分支和当前 fetch remote 已经存在的远程跟踪分支。相同名称的本地分支和远程分支不会重复展示。

创建分支使用 `git switch -c`，切换分支使用 `git switch`。切换远程跟踪分支前要求该 ref 已经由本地 Git Fetch 得到；插件不会为了猜测分支而隐式 Fetch，也不会在有未提交改动时自动 stash。

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
| Source Control view | Source Control tab |
| Staged Changes / Changes | 改动分组 |
| Stage / Unstage resource | 文件级 Stage / Unstage |
| Commit message box | 面板中的 commit message 输入框 |
| Commit | `Cmd/Ctrl+Enter` 或 Commit 按钮 |
| Sync Changes | Pull fast-forward only + Push |
| Branch picker | Repository tab 的本地和远程分支列表 |
| Open in Remote / repository browser | GitHub 浏览器链接 |
| operation progress | 面板 operation 状态和 live status |

## 8. 有意不实现的功能

以下功能不属于本插件的本地 Git + 浏览器交接范围：

- 通过 GitHub API 查询 issue、PR 列表、评论或 checks；
- 通过 Token、OAuth 或 GitHub App 管理远程身份；
- 在 Harness 内嵌 PR 创建、评论、审查或合并界面；
- 自动 stash、自动冲突解决、自动 rebase 或 force push；
- 在本地未 Fetch 时远程猜测 PR 或分支；
- 复制 `gh` 的认证、配置和命令语义。

这些限制是为了保持插件的权限范围与 VS Code Git 本地工作流一致，并避免在 Harness 中维护第二套 GitHub 客户端。

## 9. 验证范围

当前实现通过以下验证：

- TypeScript typecheck；
- ESLint；
- Vitest 单元测试；
- production build；
- `git diff --check`；
- 临时 Git 仓库中的 status、diff、stage、unstage、commit、unborn repository、conflict、push、fetch、pull、sync、branch、remote branch、PR ref 和 fork compare 场景；
- 真实 Web Harness 重启后的 Workspace 菜单、Source Control tab、Repository tab、操作面板和浏览器 console/page error 检查。

## 10. 后续维护原则

继续扩展时，优先复用本地 Git 已有的 remote、ref 和 credential 配置；不要为了增加 GitHub 功能而引入远程 API、Token 或新的 Git 客户端抽象。

如果 Harness 提供正式的 Workspace 菜单 slot，应删除当前 rc.6 兼容适配并迁移到正式扩展点。除非出现明确的用户需求和可验证的本地 Git 使用场景，否则不增加 GitHub API、PR 管理或复杂的自动同步功能。
