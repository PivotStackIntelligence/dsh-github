# dsh-github

面向 DeepSeek Harness 的 Source Control 与 GitHub 仓库面板，对齐 VS Code 原生 Git Source Control 视图。

## 功能

- **视图 tab** — 会话视图环中的第三个 "Source Control" tab（与对话/轨迹并列）；tab 活跃时占满主区、主体内左右分栏（左 SCM 分组/提交区、右 diff 查看器），无遮罩；仅显示当前会话的工作区；切回对话即恢复。
- **仓库头部** — 仓库（workspace）名、当前分支、ahead/behind 数量、GitHub 链接和刷新按钮。
- **提交栏** — 多行 commit message、`Amend` 复选框、`Commit` 主按钮及下拉菜单（Commit / Commit & Push / Commit & Sync / Undo Last Commit），以及带 ↑n ↓n 计数的圆形 Sync/Publish 按钮。
- **改动分组** — STAGED CHANGES / CHANGES / MERGE CHANGES（未跟踪文件并入 CHANGES），可折叠、带数量 badge，组级动作（+ 全部暂存 / − 全部取消暂存 / ↶ 全部丢弃）。文件状态 badge 颜色对齐 VS Code：`A` 绿、`M` 棕黄、`D` 红、`R`/`C` 蓝、`U` 绿、`!` 黄。
- **Diff 查看器** — side-by-side 与 inline 两种模式，带行号和增删着色；文件头显示旧路径 → 新路径。冲突文件提供 Accept Current / Accept Incoming / Accept Both。
- **带确认的丢弃** — 通过内联确认弹窗丢弃单个文件或全部改动（不使用裸 `window.confirm`）。
- **Commits** — 可搜索的历史（message/author），短 SHA + 标题 + 作者 + 相对日期 + refs badge；展开查看完整信息与逐文件 diff，提供 Copy SHA、Checkout Commit、Create Branch、Create Tag。
- **Branches** — 高亮当前分支；checkout、rename、delete、merge-into-current、rebase-onto。
- **Remotes** — 每个 remote 的 fetch/push URL；fetch、fetch (prune)、add、remove。
- **Tags** — 列表、create、push、delete。
- **Stashes** — 列表、apply、apply & drop、drop、查看 diff。
- **Merge / Rebase 状态** — 从面板继续或中止进行中的 merge / rebase。
- **Git 输出** — 可折叠区段，展示最近 git 命令及其（脱敏后）输出。
- **自动刷新** — 打开即刷新，tab 活跃期间每 3 秒轮询一次（切走停止），窗口 focus / visibilitychange 时立即刷新；懒加载区段（commits、branches、remotes、tags、stashes）首次展开时加载，之后随每次 status 刷新。

插件使用仓库现有的本地 Git 配置、SSH 密钥、HTTPS credential helper 和 Git remote。不调用 GitHub API、不保存 GitHub token、不实现 OAuth、不依赖 GitHub CLI，也不暴露任意 shell 命令。GitHub 链接只打开对应的浏览器页面；Compare 页面是创建 pull request 的交接入口。Git 写操作需要用户明确触发，并在完成后重新读取仓库状态。

## 实现分析

状态模型、VS Code Git 对齐方式、本地认证边界和 GitHub 浏览器交接设计见 [docs/ANALYSIS.md](docs/ANALYSIS.md)。面板视觉遵循 DeepSeek 设计规范，见 [docs/UI_DESIGN.md](docs/UI_DESIGN.md)。

## 环境要求

- DeepSeek Harness `>=0.1.0-rc.6`
- `PATH` 中可以使用 Git
- 已配置 Git remote 和 credential helper，以执行 Push、Fetch、Pull

## 从本地目录安装

```sh
pnpm install
pnpm run build
dsh plugin --profile web add .
```

重新构建插件后需要重启 Web Harness。会话视图环中会出现第三个 "Source Control" tab（与对话/轨迹并列）。

## 开发

- Node.js `>= 22.19`
- pnpm `>= 9`

```sh
pnpm run check
```

`pnpm run check` 依次执行 `typecheck`、`lint`、`test` 和 `build`。CI 在 `pnpm install --frozen-lockfile` 之后运行同一命令。
