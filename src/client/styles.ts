/**
 * dsh-github client stylesheet: DeepSeek-native Source Control view styling.
 * All colors/fonts ride `--dsw-*` / `--ds-*` theme tokens with neutral-light
 * fallbacks only (no VS Code dark hardcodes). Class names are stable.
 * Author: bugmaker2 · PivotStack Intelligence
 */
const STYLE_ID = 'dsh-github-styles'

/* Font shorthands for UI copy. */
const FONT = {
  xxs: 'var(--dsw-font-xxs-12, 12px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  xs: 'var(--dsw-font-xs-13, 13px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  xsStrong: 'var(--dsw-font-xs-strong-13, 500 13px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  xxxs: 'var(--dsw-font-xxxs-11, 11px/14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
}
const CODE = 'var(--ds-font-family-code, "SF Mono", ui-monospace, Menlo, Consolas, monospace)'

const css = `
/* ===== View-tab fill (rendered inside the conversation view ring) ===== */
.dsh-github-view{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.dsh-github-view-empty{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--dsw-alias-label-secondary,#555555);font:${FONT.xs}}

/* ===== Panel shell ===== */
.dsh-github-panel{width:100%;height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#f7f7f7);color:var(--dsw-alias-label-primary,#111111);font:${FONT.xs}}
.dsh-github-panel button,.dsh-github-panel textarea,.dsh-github-panel input{font:inherit}
.dsh-github-panel button:focus-visible,.dsh-github-panel textarea:focus-visible,.dsh-github-panel input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px}
.dsh-github-panel button:disabled{opacity:.45;cursor:not-allowed}
.dsh-github-panel button,.dsh-github-panel input,.dsh-github-panel textarea{transition:background-color .12s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1)),color .12s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1)),border-color .12s var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1))}

/* ===== Header ===== */
.dsh-github-panel-header{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:44px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#d5d5d5);background:var(--dsw-alias-bg-base,#f7f7f7)}
.dsh-github-panel-header strong,.dsh-github-panel-header small{display:block}
.dsh-github-panel-header strong{font:${FONT.xsStrong}}
.dsh-github-panel-header small{margin-top:2px;color:var(--dsw-alias-label-caption,#999999);font:11px/14px ${CODE};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-github-panel-actions{display:flex;gap:6px;flex:none}
.dsh-github-panel-actions button{border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;padding:6px 10px;background:transparent;color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;font:${FONT.xs}}
.dsh-github-panel-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111111)}

/* ===== Live / error / notice surfaces ===== */
.dsh-github-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dsh-github-panel-error{margin:0;padding:8px 16px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d1242f) 10%, transparent);color:var(--dsw-alias-state-error-primary,#d1242f);border-bottom:1px solid var(--dsw-alias-border-l1,#e5e5e5);font:${FONT.xs};white-space:pre-wrap}
.dsh-github-panel-notice{margin:0;padding:8px 16px;background:var(--dsw-alias-state-success-tertiary,#e6f4ea);color:var(--dsw-alias-state-success-primary,#1a7f37);border-bottom:1px solid var(--dsw-alias-border-l1,#e5e5e5);font:${FONT.xs}}
.dsh-github-panel-message{padding:16px 20px;color:var(--dsw-alias-label-tertiary,#777777)}
.dsh-github-panel-message.compact{padding:10px 0;font:${FONT.xs}}

/* ===== Two-column layout ===== */
.dsh-github-source-layout{display:flex;flex:1;min-height:0}
.dsh-github-source-sidebar{width:480px;min-width:340px;flex:none;overflow-y:auto;border-right:1px solid var(--dsw-alias-border-l1,#e5e5e5);padding:12px 0 24px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,#d5d5d5) transparent}
.dsh-github-source-sidebar::-webkit-scrollbar{width:8px}
.dsh-github-source-sidebar::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,#d5d5d5);border-radius:4px}
.dsh-github-source-sidebar::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,#bdbdbd)}
.dsh-github-diff-view{flex:1;min-width:0;overflow-y:auto;background:var(--dsw-alias-bg-layer-1,#ffffff);scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,#d5d5d5) transparent}
.dsh-github-diff-view::-webkit-scrollbar{width:8px}
.dsh-github-diff-view::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,#d5d5d5);border-radius:4px}
.dsh-github-diff-view::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,#bdbdbd)}

/* ===== Commit area ===== */
.dsh-github-commit-area{padding:12px 16px 14px}
.dsh-github-commit-area textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#f2f2f2);color:var(--dsw-alias-label-primary,#111111);font:13px/20px ${CODE}}
.dsh-github-commit-area textarea:focus{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px}
.dsh-github-commit-hint{display:flex;justify-content:space-between;color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs};padding:4px 2px 0}
.dsh-github-commit-controls{display:flex;align-items:center;gap:8px;margin-top:10px}
.dsh-github-commit-controls .spacer{flex:1}
.dsh-github-amend{display:inline-flex;align-items:center;gap:5px;font:${FONT.xs};color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;user-select:none}
.dsh-github-amend input{margin:0}
.dsh-github-btn{border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;padding:6px 12px;background:transparent;color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;font:${FONT.xs}}
.dsh-github-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-btn.primary{background:var(--dsw-alias-brand-primary,#2563eb);border-color:var(--dsw-alias-brand-primary,#2563eb);color:var(--dsw-alias-label-primary-inverted,#ffffff)}
.dsh-github-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#2563eb));border-color:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#2563eb));color:var(--dsw-alias-label-primary-inverted,#ffffff)}
.dsh-github-btn.danger{background:var(--dsw-alias-state-error-primary,#d1242f);border-color:var(--dsw-alias-state-error-primary,#d1242f);color:var(--dsw-alias-label-primary-inverted,#ffffff)}
.dsh-github-dropdown{position:relative;display:inline-block}
.dsh-github-dropdown-menu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:200px;padding:4px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:8px;background:var(--dsw-alias-bg-overlay,#ffffff);box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.12))}
.dsh-github-dropdown-menu button{display:block;width:100%;text-align:left;border:0;border-radius:6px;padding:7px 10px;background:transparent;color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;font:${FONT.xs}}
.dsh-github-dropdown-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-dropdown-menu button.danger{color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsh-github-sync-btn{width:32px;height:32px;border-radius:50%;border:1px solid transparent;background:var(--dsw-alias-button-info-fill,var(--dsw-alias-brand-primary,#2563eb));color:var(--dsw-alias-label-primary-inverted,#ffffff);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.dsh-github-sync-btn:hover:not(:disabled){background:var(--dsw-alias-button-info-hover,var(--dsw-alias-button-info-fill,var(--dsw-alias-brand-primary,#2563eb)))}
.dsh-github-sync-icon{display:block}
.dsh-github-sync-btn.publish{width:auto;border-radius:16px;padding:0 12px;font:${FONT.xsStrong}}

/* ===== Merge/rebase banner ===== */
.dsh-github-merge-banner{display:flex;align-items:center;gap:8px;margin:0 16px 12px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:8px;background:var(--dsw-alias-state-warn-tertiary,#fff3d6);color:var(--dsw-alias-state-warn-primary,#9a6700);font:${FONT.xs}}
.dsh-github-merge-banner strong{flex:1}

/* ===== Change groups ===== */
.dsh-github-change-group{margin:0 0 4px}
.dsh-github-change-group-header{display:flex;align-items:center;gap:8px;padding:0 16px}
.dsh-github-group-toggle{display:flex;align-items:center;gap:6px;flex:1;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#555555);padding:7px 0;cursor:pointer;text-align:left;font:${FONT.xsStrong};text-transform:uppercase;letter-spacing:.02em}
.dsh-github-group-toggle:hover{color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-group-toggle .chevron{width:12px;color:var(--dsw-alias-label-caption,#999999)}
.dsh-github-count-badge{min-width:18px;padding:0 6px;border-radius:9px;background:var(--dsw-alias-bg-module-platform,#ececec);color:var(--dsw-alias-label-secondary,#555555);font:${FONT.xxxs};font-weight:500;text-align:center}
.dsh-github-group-action{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;font:${FONT.xs};padding:4px 6px;border-radius:4px}
.dsh-github-group-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-group-action.danger:hover{color:var(--dsw-alias-state-error-primary,#d1242f)}

/* ===== File rows ===== */
.dsh-github-change-row{display:flex;align-items:center;gap:2px;padding:0 12px 0 16px;height:28px;position:relative}
.dsh-github-change-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsh-github-change-row.selected{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.09));box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-github-change-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0;border:0;background:transparent;color:inherit;cursor:pointer;text-align:left;padding:0;height:100%}
.dsh-github-kind{flex:none;min-width:16px;height:18px;padding:0 4px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-family:${CODE};font-size:10px;font-weight:600;line-height:1}
.dsh-github-kind.kind-untracked{background:var(--dsw-alias-bg-module-platform,#ececec);color:var(--dsw-alias-label-secondary,#555555)}
.dsh-github-kind.kind-added{background:var(--dsw-alias-state-success-tertiary,#e6f4ea);color:var(--dsw-alias-state-success-primary,#1a7f37)}
.dsh-github-kind.kind-modified{background:var(--dsw-alias-state-warn-tertiary,#fff3d6);color:var(--dsw-alias-state-warn-primary,#9a6700)}
.dsh-github-kind.kind-deleted{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d1242f) 12%, transparent);color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsh-github-kind.kind-renamed,.dsh-github-kind.kind-copied{background:var(--dsw-alias-state-business-tertiary,#e6f0ff);color:var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-github-kind.kind-conflict{background:var(--dsw-alias-state-warn-tertiary,#fff3d6);color:var(--dsw-alias-state-warn-primary,#9a6700)}
.dsh-github-change-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:${FONT.xs};display:flex;align-items:center;gap:6px}
.dsh-github-change-path small{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs}}
.dsh-github-row-actions{display:none;align-items:center;gap:2px;flex:none}
.dsh-github-change-row:hover .dsh-github-row-actions,
.dsh-github-branch-row:hover .dsh-github-row-actions,
.dsh-github-remote-row:hover .dsh-github-row-actions,
.dsh-github-tag-row:hover .dsh-github-row-actions,
.dsh-github-stash-row:hover .dsh-github-row-actions{display:inline-flex}
.dsh-github-icon-btn{width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary,#555555);cursor:pointer;font:13px/1 ${CODE};padding:0;display:inline-flex;align-items:center;justify-content:center}
.dsh-github-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-icon-btn.danger:hover{color:var(--dsw-alias-state-error-primary,#d1242f)}

/* ===== Collapsible sections ===== */
.dsh-github-section{border-top:1px solid var(--dsw-alias-border-l1,#e5e5e5);margin-top:12px}
.dsh-github-section-header{display:flex;align-items:center;gap:8px;padding:0 16px;margin:4px 0}
.dsh-github-section-body{padding:4px 16px 12px}
.dsh-github-section-empty{padding:6px 0;color:var(--dsw-alias-label-secondary,#555555);font:${FONT.xs}}
.dsh-github-search{width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#ffffff);color:var(--dsw-alias-label-primary,#111111);font:${FONT.xs}}

/* ===== Commits ===== */
.dsh-github-commit-item{margin-bottom:2px}
.dsh-github-commit-summary{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;padding:6px 8px;cursor:pointer;text-align:left;border-radius:6px}
.dsh-github-commit-summary:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsh-github-commit-sha{font-family:${CODE};color:var(--dsw-alias-state-business-primary,#2563eb);font-size:12px}
.dsh-github-commit-subject{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:${FONT.xs}}
.dsh-github-commit-meta{flex:none;color:var(--dsw-alias-label-tertiary,#777777);font:${FONT.xxxs};white-space:nowrap}
.dsh-github-ref-badge{display:inline-block;margin-left:4px;padding:0 5px;border-radius:8px;background:var(--dsw-alias-bg-module-platform,#ececec);color:var(--dsw-alias-label-secondary,#555555);font-size:10px;vertical-align:middle}
.dsh-github-commit-detail{padding:8px 8px 12px;border-left:2px solid var(--dsw-alias-border-l1,#e5e5e5);margin:2px 0 8px 10px}
.dsh-github-commit-detail-meta{font:${FONT.xs};color:var(--dsw-alias-label-secondary,#555555);margin:0 0 8px;white-space:pre-wrap}
.dsh-github-commit-detail-actions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.dsh-github-commit-file{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;padding:3px 6px;cursor:pointer;text-align:left;border-radius:4px;font:12px/18px ${CODE}}
.dsh-github-commit-file:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsh-github-commit-file .kind{color:var(--dsw-alias-label-secondary,#555555);width:14px;text-align:center}

/* ===== Branches / remotes / tags / stashes rows ===== */
.dsh-github-branch-row,.dsh-github-remote-row,.dsh-github-tag-row,.dsh-github-stash-row{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;font:${FONT.xs};min-height:28px}
.dsh-github-branch-row:hover,.dsh-github-remote-row:hover,.dsh-github-tag-row:hover,.dsh-github-stash-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsh-github-branch-row.current{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.09))}
.dsh-github-branch-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:0;color:inherit;cursor:pointer;text-align:left;padding:0}
.dsh-github-branch-name.current{font-weight:600}
.dsh-github-branch-upstream{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs}}
.dsh-github-remote-row,.dsh-github-tag-row,.dsh-github-stash-row{cursor:default}
.dsh-github-remote-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.dsh-github-remote-url{display:block;color:var(--dsw-alias-label-caption,#999999);font:11px/14px ${CODE};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-github-row-actions.static{display:inline-flex}
.dsh-github-tag-row .dsh-github-branch-name,.dsh-github-stash-row .dsh-github-branch-name{font-family:${CODE};font-size:12px}
.dsh-github-tag-subject{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs};flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.dsh-github-stash-message{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:${FONT.xs};background:transparent;border:0;color:inherit;cursor:pointer;text-align:left;padding:0}
.dsh-github-stash-date{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs};white-space:nowrap}
.dsh-github-inline-form{display:flex;flex-direction:column;gap:6px;margin:8px 0}
.dsh-github-inline-form input{width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#ffffff);color:var(--dsw-alias-label-primary,#111111);font:${FONT.xs}}
.dsh-github-inline-form .row{display:flex;gap:6px}
.dsh-github-inline-form .row input{flex:1}
.dsh-github-inline-form label{display:inline-flex;align-items:center;gap:5px;font:${FONT.xs};color:var(--dsw-alias-label-secondary,#555555);cursor:pointer}

/* ===== Git output ===== */
.dsh-github-output-entry{border:1px solid var(--dsw-alias-border-l1,#e5e5e5);border-radius:8px;margin-bottom:8px;overflow:hidden}
.dsh-github-output-cmd{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-2,#f2f2f2);font:12px/18px ${CODE}}
.dsh-github-output-cmd .ok{color:var(--dsw-alias-state-success-primary,#1a7f37)}
.dsh-github-output-cmd .fail{color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsh-github-output-cmd .time{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs}}
.dsh-github-output-text{margin:0;padding:8px 10px;font:11px/14px ${CODE};white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;color:var(--dsw-alias-label-secondary,#555555);background:var(--dsw-alias-bg-base,#f7f7f7)}

/* ===== Diff viewer ===== */
.dsh-github-diff-header{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#d5d5d5);position:sticky;top:0;background:var(--dsw-alias-bg-layer-1,#ffffff);z-index:2;flex-wrap:wrap}
.dsh-github-diff-header .dsh-github-diff-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:13px/20px ${CODE};color:var(--dsw-alias-label-primary,#111111)}
.dsh-github-diff-header .dsh-github-diff-path .arrow{color:var(--dsw-alias-label-caption,#999999);margin:0 4px}
.dsh-github-diff-header small{color:var(--dsw-alias-label-caption,#999999);font:${FONT.xxxs}}
.dsh-github-diff-toggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;overflow:hidden}
.dsh-github-diff-toggle button{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#555555);padding:4px 10px;cursor:pointer;font:${FONT.xs}}
.dsh-github-diff-toggle button.active{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.09));color:var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-github-diff-body{padding:0 0 24px;font-family:${CODE};font-size:12px;line-height:1.5}
.dsh-github-diff-binary{padding:20px;color:var(--dsw-alias-label-secondary,#555555);font-style:italic}
.dsh-github-diff-hunk-header{padding:6px 16px;background:var(--dsw-alias-bg-module-platform,#ececec);color:var(--dsw-alias-label-caption,#999999);font:11px/14px ${CODE};white-space:pre-wrap;word-break:break-all}
.dsh-github-diff-grid{display:block}
.dsh-github-diff-row{display:grid;grid-template-columns:48px 1fr 48px 1fr;min-width:0}
.dsh-github-diff-row .line{white-space:pre-wrap;word-break:break-all;padding:0 8px;min-width:0}
.dsh-github-diff-line-no{padding:0 6px;text-align:right;color:var(--dsw-alias-label-caption,#999999);user-select:none;background:var(--dsw-alias-bg-layer-1,#ffffff);border-right:1px solid var(--dsw-alias-border-l1,#e5e5e5);font:11px/20px ${CODE}}
.dsh-github-diff-row .line.left{border-right:1px solid var(--dsw-alias-border-l2,#d5d5d5)}
.dsh-github-diff-row .line.context{color:var(--dsw-alias-label-secondary,#555555)}
.dsh-github-diff-row .line.remove{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d1242f) 12%, var(--dsw-alias-bg-layer-1,#ffffff));color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsh-github-diff-row .line.add{background:var(--dsw-alias-state-success-tertiary,#e6f4ea);color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#1a7f37) 72%, var(--dsw-alias-label-primary,#111111))}
.dsh-github-diff-row .line.empty{background:var(--dsw-alias-bg-layer-1,#ffffff)}
.dsh-github-diff-row.meta{display:block;padding:2px 16px;color:var(--dsw-alias-label-caption,#999999);background:var(--dsw-alias-bg-module-platform,#ececec);font-style:italic}
.dsh-github-diff-inline-line{display:grid;grid-template-columns:48px 20px 1fr;min-width:0}
.dsh-github-diff-inline-line .text{white-space:pre-wrap;word-break:break-all;padding:0 8px;min-width:0}
.dsh-github-diff-inline-line .prefix{padding-left:6px;user-select:none}
.dsh-github-diff-inline-line.context{color:var(--dsw-alias-label-secondary,#555555)}
.dsh-github-diff-inline-line.remove{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d1242f) 12%, var(--dsw-alias-bg-layer-1,#ffffff));color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsh-github-diff-inline-line.add{background:var(--dsw-alias-state-success-tertiary,#e6f4ea);color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#1a7f37) 72%, var(--dsw-alias-label-primary,#111111))}
.dsh-github-diff-inline-line.meta{display:block;padding:2px 16px;color:var(--dsw-alias-label-caption,#999999);background:var(--dsw-alias-bg-module-platform,#ececec);font-style:italic}
.dsh-github-empty{padding:20px;color:var(--dsw-alias-label-secondary,#555555)}

/* ===== Confirm modal ===== */
.dsh-github-modal-root{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center}
.dsh-github-modal-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}
.dsh-github-modal{position:relative;width:min(440px,calc(100vw - 32px));padding:18px 20px;border-radius:12px;background:var(--dsw-alias-bg-overlay,#ffffff);color:var(--dsw-alias-label-primary,#111111);box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.12));border:1px solid var(--dsw-alias-border-l2,#d5d5d5)}
.dsh-github-modal-title{margin:0 0 10px;font:${FONT.xsStrong}}
.dsh-github-modal-message{margin:0 0 6px;font:${FONT.xs};line-height:1.5;white-space:pre-wrap}
.dsh-github-modal-detail{margin:0 0 12px;font:${FONT.xxs};color:var(--dsw-alias-label-tertiary,#777777);white-space:pre-wrap}
.dsh-github-modal-fields{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.dsh-github-modal-input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2,#d5d5d5);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#ffffff);color:var(--dsw-alias-label-primary,#111111);font:${FONT.xs}}
.dsh-github-modal-checkbox{display:inline-flex;align-items:center;gap:7px;font:${FONT.xs};cursor:pointer;color:var(--dsw-alias-label-secondary,#555555)}
.dsh-github-modal-checkbox input{margin:0}
.dsh-github-modal-actions{display:flex;justify-content:flex-end;gap:8px}

@media (prefers-reduced-motion: reduce){
  .dsh-github-panel button,.dsh-github-panel input,.dsh-github-panel textarea{transition:none}
}
`

/** Inject the Source Control view stylesheet once. */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
}
