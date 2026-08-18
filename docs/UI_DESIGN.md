# dsh-github UI 设计规范（DeepSeek 风格）

本文件是 dsh-github 面板视觉与交互的唯一设计依据。目标：与 DeepSeek Harness（DSH）本体
一致的设计语言——中性分层表面、品牌色焦点、状态色语义、代码字体承载 Git 数据、轻量 hover 交互，
同时保持 VS Code Source Control 的信息架构。**所有颜色/字体/间距一律走 `--dsw-*` 主题变量**，
仅在不提供主题时使用中性回退值；不再使用 VS Code 深色硬编码（#1e1e1e / #2b2b2b 等）。

## 1. 设计原则

1. **融入宿主**：面板是 DSH 会话主区里的一个视图 tab，必须与对话/轨迹视图共享同一套
   表面、文本、边框与交互 token，用户在明暗主题下都自然。
2. **语义即状态**：Git 状态用 DSH 状态色表达（成功=新增、错误=删除、警告=修改/冲突），
   徽章保留 VS Code 字母语义但用 DSH 调色板。
3. **数据用代码字体**：路径、SHA、diff、commit message 输入等 Git 数据一律
   `var(--ds-font-family-code)`；UI 文案用 `--dsw-font-*` 体系。
4. **克制**：行内操作 hover 才显示；主操作（Commit/Sync）用品牌色；破坏性操作永远有确认。
5. **无障碍**：focus-visible 统一 `2px var(--dsw-alias-brand-primary)` 描边；图标按钮有
   aria-label；操作状态进 aria-live。

## 2. Token 映射（权威，来自运行时 Theme 注册表 + 宿主在用别名）

| 用途 | Token | 回退 |
| --- | --- | --- |
| 视图背景 | `--dsw-alias-bg-base` | `#f7f7f7`（浅）/ 中性 |
| 面板主体 / 分组卡 | `--dsw-alias-bg-layer-1` / `--dsw-alias-bg-layer-2` | `#ffffff` / `#f2f2f2` |
| 弹层（confirm） | `--dsw-alias-bg-overlay` | `#ffffff` |
| 一级文本 | `--dsw-alias-label-primary` | `#111111` |
| 二级文本 | `--dsw-alias-label-secondary` | `#555555` |
| 三级/说明 | `--dsw-alias-label-tertiary` / `--dsw-alias-label-caption` | `#777777` / `#999999` |
| 边框 | `--dsw-alias-border-l1`（细分隔）/ `--dsw-alias-border-l2`（结构） | `#e5e5e5` / `#d5d5d5` |
| 品牌/焦点 | `--dsw-alias-brand-primary`（焦点环、激活 tab、主按钮） | `#2563eb` |
| 业务主色 | `--dsw-alias-state-business-primary`（选中态、激活标识） | 同品牌 |
| 成功 | `--dsw-alias-state-success-primary` + `-tertiary`（底色） | `#1a7f37` / `#e6f4ea` |
| 错误 | `--dsw-alias-state-error-primary`（文本）+ `color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-layer-1))`（底色） | `#d1242f` / error 12% 混合 layer-1 |
| 警告 | `--dsw-alias-state-warn-primary` + `-tertiary`（底色） | `#9a6700` / `#fff3d6` |
| hover / active | `--dsw-alias-interactive-bg-hover` / `-active` | `rgba(0,0,0,.05)` / `.09` |
| 阴影 | `--dsw-shadow-lv2`（仅弹层） | `0 4px 16px rgba(0,0,0,.12)` |
| 滚动条 | `--dsw-alias-scrollbar-bg-l2` / `--dsw-alias-scrollbar-hover-l2` | 中性 |

字体：UI 文案 `--dsw-font-xxs-12` / `--dsw-font-xs-13` / `--dsw-font-xs-strong-13`；
Git 数据（路径、SHA、diff、tag、remote URL）`var(--ds-font-family-code)` 11–13px。
动效：`var(--ds-ease-in-out)`，`prefers-reduced-motion: reduce` 时关闭。

## 3. 布局（tab 视图内）

- 面板占满视图（`height:100%`，flex 列）：头部（约 44px，`border-bottom: l2`）→ 主体 flex 行。
- 主体左右分栏：左侧 SCM 栏（约 480px，`border-right: l1`，内部滚动），右侧 diff 查看器（flex:1）。
- 左侧从上到下：Commit 输入区 → STAGED / CHANGES / MERGE 分组 → COMMITS / BRANCHES /
  REMOTES / TAGS / STASHES / GIT OUTPUT 折叠区段。
- 分组/区段头：约 28–30px 高，`--dsw-font-xs-strong-13`，chevron + 标题 + 计数 badge，
  与宿主 section header 观感一致；展开/收起走 aria-expanded。

## 4. 组件规范

### 4.1 文件行与徽章

- 行高 28px，hover 背景 `interactive-bg-hover`；选中行 `interactive-bg-active` + 左侧 2px
  `state-business-primary` 指示条。
- 徽章：10px 等宽圆角小标（radius 4px，padding 0 4px），字母保留 VS Code 语义，配色换 DSH：
  - `A` 新增 → `state-success-primary` 文本 + `state-success-tertiary` 底
  - `D` 删除 → `state-error-primary` 文本 + `color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-layer-1))` 底
  - `M` 修改 → `state-warn-primary` + `state-warn-tertiary`
  - `R`/`C` 重命名/复制 → `state-business-primary` + 其 tertiary（无则 brand 12% 底）
  - `U` 未跟踪 → `label-secondary` 文本 + `bg-module-platform` 底
  - `!` 冲突 → `state-warn-primary` 文本 + `state-warn-tertiary` 底
- 行操作（打开本地 / 打开 GitHub / + / − / ↶ / Accept 三选一）hover 才显示，图标按钮
  28×28，hover `interactive-bg-hover`，aria-label 完整。

### 4.2 Commit 输入区

- textarea：`bg-layer-2`、`border-l2`、radius 8px、focus 2px `brand-primary` 环；代码字体 13px；
  长度计数 `label-caption`。
- Commit 主按钮：`--dsw-alias-brand-primary` 底 + `--dsw-alias-label-primary-inverted` 文字
  （hover 用 `--dsw-alias-button-primary-hover`）；disabled `opacity .45`。
- 次要按钮（Push/Pull/Fetch/Refresh/GitHub）：透明底 + `border-l2`，hover `interactive-bg-hover`。
- Sync/Publish 圆形按钮：同主按钮样式，`aria-label` 带 ↑ahead ↓behind 计数；无 upstream 时
  显示 Publish（warn 色点提示）。

### 4.3 diff 查看器

- 双栏（默认）：左右各 50%，中线 `border-l2`；行号列 `label-caption`、代码字体、右对齐。
- 行着色（DeepSeek 原生 diff 风格，对齐轨迹视图的 promptDiff）：
  - 新增行：文本 `state-success-primary` 72% 混合 primary，底 `state-success-tertiary`
  - 删除行：文本 `state-error-primary`，底 `color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-layer-1))`
  - 上下文行：文本 `label-secondary`；meta 行（@@）底 `bg-module-platform`、`label-caption`
- 文件头：旧路径 → 新路径（rename 时），代码字体；二进制文件显示提示文本。
- inline 模式：同色映射的整行着色。

### 4.4 折叠区段（COMMITS/BRANCHES/REMOTES/TAGS/STASHES/GIT OUTPUT）

- 区段头同 §3；内容为紧凑卡片列表（`bg-layer-2`、radius 8px、`border-l1`）。
- 提交列表：短 SHA 用代码字体 + `state-business-primary`；refs badge 用 `bg-module-platform` 底。
- GIT OUTPUT：等宽 11px 终端观感块，`bg-base` 底、`border-l1`，错误行 `state-error-primary`。

### 4.5 Confirm 弹窗

- 遮罩：`--dsw-alias-bg-mask-1`（回退 `rgba(0,0,0,.32)`），铺满 `inset:0`。
- 容器 `bg-overlay`、`--dsw-shadow-lv2`、radius 12px、`border-l2`；标题 `xs-strong-13`；
  破坏性确认按钮用 `state-error-primary` 底 + `label-primary-inverted` 文字；取消用次要按钮样式。

### 4.6 空态 / 加载态 / 错误

- 空态/提示：`label-secondary` 13px，居中或区段内。
- 错误：`state-error-primary` 文本；操作状态进 `aria-live="polite"`。

## 5. 明暗主题

全部经 `--dsw-*` token 自动切换；任何新增硬编码色必须提供浅/深两组回退且仅作兜底。

## 6. 验收清单

1. 面板内 grep 不到 `#1e1e1e`、`#2b2b2b`、`#3a3a3a` 等 VS Code 深色硬编码（回退值改用中性浅色组）。
2. 明/暗主题下：文本对比、badge 可读、focus 环、hover 状态全部符合 §2 映射。
3. 与轨迹视图并排时视觉同源（同 token、同字号、同 border 观感）。
4. 全部类名保持稳定（`.dsh-github-*`），既有 63 个测试不改动即通过。
