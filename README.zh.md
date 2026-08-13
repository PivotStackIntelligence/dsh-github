# dsh-github

面向 DeepSeek Harness 的 Source Control 与 GitHub 仓库面板。

## 现有功能

- 展示当前 Workspace 的分支、上游分支、ahead/behind 数量和改动文件。
- 分组展示已暂存与工作区改动，并预览受限大小的文件 diff。
- 通过固定参数的本机 `git` 命令暂存和取消暂存单个文件或全部改动。
- 在面板中填写 commit message 并提交已暂存改动，支持 `Cmd/Ctrl+Enter` 和操作状态反馈。
- 通过仓库现有的 Git remote 与 credential helper 执行 Push、Fetch、仅 fast-forward 的 Pull 和同步。
- 查看本地分支与 `origin` 远程跟踪分支，在面板中切换分支并创建新的本地分支。
- 从 `origin` 检测 GitHub 仓库，在浏览器打开仓库，并打开 GitHub compare 页面创建 Pull Request。

插件使用仓库现有的本地 Git 配置，不保存 GitHub token、不实现 OAuth、不依赖 GitHub CLI，也不暴露任意 shell 命令。Git 写操作需要用户明确触发，并在完成后重新读取仓库状态。

## 环境要求

- DeepSeek Harness `>=0.1.0-rc.6`
- `PATH` 中可以使用 Git
- 已配置 Git remote 和 credential helper，以执行 Push、Fetch、Pull

## 从本地目录安装

```sh
pnpm install
pnpm run build
dsh plugins install .
```

重新构建插件后需要重启 Web Harness。在 Workspace 的更多菜单中选择 **查看 Source Control**。

## 开发检查

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
