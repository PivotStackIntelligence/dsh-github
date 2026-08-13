# dsh-github

面向 DeepSeek Harness 的 Source Control 与 GitHub 仓库面板。

## 现有功能

- 展示当前 Workspace 的分支、上游分支、ahead/behind 数量和改动文件。
- 分组展示已暂存、工作区、未跟踪和合并冲突改动，并预览受限大小的文件 diff。
- 通过固定参数的本机 `git` 命令暂存和取消暂存单个文件或全部改动，并可暂存已经解决的合并冲突。
- 在面板中填写 commit message 并提交已暂存改动，支持 `Cmd/Ctrl+Enter` 和操作状态反馈；提交后推送失败时会明确提示提交已经创建。
- 通过仓库现有的 Git remote 与 credential helper 执行 Push、Fetch、仅 fast-forward 的 Pull 和同步；存在多个 remote 时，必须由 Git 配置明确分支 remote 或 push remote，不会猜测目标。
- 查看本地分支与当前分支远程的远程跟踪分支，在面板中切换分支并创建新的本地分支；同名的本地分支与远程跟踪分支只展示一次。
- 将本地 Git 已经 Fetch 的 pull request ref 展示为 GitHub 页面链接，不通过 GitHub API 查询 pull request。
- 根据当前分支配置的 fetch remote 与 push remote 生成 GitHub 仓库、分支和 compare 链接，并在浏览器打开；compare 链接支持常见的 fork 工作流。

插件使用仓库现有的本地 Git 配置、SSH 密钥、HTTPS credential helper 和 Git remote。不调用 GitHub API、不保存 GitHub token、不实现 OAuth、不依赖 GitHub CLI，也不暴露任意 shell 命令。GitHub 链接只打开对应的浏览器页面；Compare 页面是创建 pull request 的交接入口。Git 写操作需要用户明确触发，并在完成后重新读取仓库状态。

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

重新构建插件后需要重启 Web Harness。在 Workspace 的更多菜单中选择 **查看 Source Control**。

## 开发检查

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
