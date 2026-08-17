/**
 * dsh-github client stylesheet: the session-header toggle button, the
 * right-edge slide-in Source Control overlay panel, commit area, collapsible
 * sections, side-by-side diff viewer, and confirm modal. Injected once.
 */
const STYLE_ID = 'dsh-github-styles'

const css = `
/* ===== Header toggle button ===== */
.dsh-github-header-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary,#c5c5c5);cursor:pointer;font-size:16px;line-height:1}
.dsh-github-header-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary,#e8e8e8)}
.dsh-github-header-action[aria-pressed="true"]{color:var(--dsw-alias-brand-primary,#75beff)}
.dsh-github-header-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:-2px}

/* ===== Right-edge slide-in overlay panel ===== */
@keyframes dsh-github-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
.dsh-github-overlay{position:fixed;right:0;top:0;bottom:0;z-index:1200;width:min(980px,96vw);height:100%;pointer-events:auto;transform:translateX(0);animation:dsh-github-slide-in .18s ease;border-left:1px solid var(--dsw-alias-border-l2,#2b2b2b);box-shadow:-8px 0 30px rgba(0,0,0,.35);background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#e8e8e8);overflow:hidden}
@media (prefers-reduced-motion: reduce){.dsh-github-overlay{animation:none}}
.dsh-github-overlay-empty{display:flex;flex-direction:column;height:100%}
.dsh-github-overlay-empty-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 22px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b2b)}
.dsh-github-overlay-empty-head button{border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:6px;padding:4px 9px;background:transparent;color:inherit;cursor:pointer}
.dsh-github-overlay-empty-head button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-overlay-empty p{color:var(--dsw-alias-label-secondary,#c5c5c5);padding:22px;font-size:13px}
.dsh-github-panel{width:100%;height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#e8e8e8)}
.dsh-github-panel button,.dsh-github-panel textarea,.dsh-github-panel input{font:inherit}
.dsh-github-panel button:focus-visible,.dsh-github-panel textarea:focus-visible,.dsh-github-panel input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px}
.dsh-github-panel button:disabled{opacity:.45;cursor:not-allowed}

/* ===== Header ===== */
.dsh-github-panel-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 20px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b2b)}
.dsh-github-panel-header strong,.dsh-github-panel-header small{display:block}
.dsh-github-panel-header small{margin-top:4px;color:var(--dsw-alias-label-tertiary,#9a9a9a);font:12px ui-monospace,SFMono-Regular,monospace;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-github-panel-actions{display:flex;gap:6px;flex:none}
.dsh-github-panel-actions button{border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:5px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer}
.dsh-github-panel-actions button:hover{background:var(--dsw-alias-interactive-bg-hover)}

/* ===== Live / error surfaces ===== */
.dsh-github-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dsh-github-panel-error{margin:0;padding:8px 20px;background:var(--dsw-alias-danger-bg,rgba(244,135,113,.14));color:var(--dsw-alias-label-primary,#ffa198);border-bottom:1px solid var(--dsw-alias-border-l2,#3c3c3c);font-size:13px;white-space:pre-wrap}
.dsh-github-panel-notice{margin:0;padding:8px 20px;background:var(--dsw-alias-success-bg,rgba(115,201,145,.14));color:var(--dsw-alias-label-primary,#7ee2a8);border-bottom:1px solid var(--dsw-alias-border-l2,#3c3c3c);font-size:13px}
.dsh-github-panel-message{padding:16px 20px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.dsh-github-panel-message.compact{padding:10px 0;font-size:13px}

/* ===== Two-column layout ===== */
.dsh-github-source-layout{display:flex;flex:1;min-height:0}
.dsh-github-source-sidebar{width:480px;min-width:340px;flex:none;overflow-y:auto;border-right:1px solid var(--dsw-alias-border-l2,#2b2b2b);padding:12px 0 24px}
.dsh-github-diff-view{flex:1;min-width:0;overflow-y:auto;background:var(--dsw-alias-bg-layer-1,#1a1a1a)}

/* ===== Commit area ===== */
.dsh-github-commit-area{padding:0 16px 14px}
.dsh-github-commit-area textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:5px;background:var(--dsw-alias-bg-layer-1,#252526);color:inherit;font:13px/1.5 ui-monospace,SFMono-Regular,monospace}
.dsh-github-commit-hint{display:flex;justify-content:space-between;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;padding:4px 2px 0}
.dsh-github-commit-controls{display:flex;align-items:center;gap:8px;margin-top:10px}
.dsh-github-commit-controls .spacer{flex:1}
.dsh-github-amend{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary,#c5c5c5);cursor:pointer;user-select:none}
.dsh-github-amend input{margin:0}
.dsh-github-btn{border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:4px;padding:6px 12px;background:transparent;color:inherit;cursor:pointer;font-size:13px}
.dsh-github-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-btn.primary{background:var(--dsw-alias-brand-primary,#0e639c);border-color:var(--dsw-alias-brand-primary,#0e639c);color:#fff}
.dsh-github-btn.primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary-hover,#1177bb)}
.dsh-github-btn.danger{background:var(--dsw-alias-danger,#a1260d);border-color:var(--dsw-alias-danger,#a1260d);color:#fff}
.dsh-github-dropdown{position:relative;display:inline-block}
.dsh-github-dropdown-menu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:200px;padding:4px;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#252526);box-shadow:0 8px 24px rgba(0,0,0,.4)}
.dsh-github-dropdown-menu button{display:block;width:100%;text-align:left;border:0;border-radius:4px;padding:7px 10px;background:transparent;color:inherit;cursor:pointer}
.dsh-github-dropdown-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-dropdown-menu button.danger{color:var(--dsw-alias-danger-text,#f48771)}
.dsh-github-sync-btn{width:32px;height:32px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-family:ui-monospace,SFMono-Regular,monospace;line-height:1}
.dsh-github-sync-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-sync-btn.publish{width:auto;border-radius:16px;padding:0 12px;font-family:inherit}

/* ===== Merge/rebase banner ===== */
.dsh-github-merge-banner{display:flex;align-items:center;gap:8px;margin:0 16px 12px;padding:8px 12px;border:1px solid var(--dsw-alias-warning,#f7d154);border-radius:5px;background:var(--dsw-alias-warning-bg,rgba(247,209,84,.12));color:inherit;font-size:13px}
.dsh-github-merge-banner strong{flex:1}

/* ===== Change groups ===== */
.dsh-github-change-group{margin:0 0 4px}
.dsh-github-change-group-header{display:flex;align-items:center;gap:8px;padding:0 16px}
.dsh-github-group-toggle{display:flex;align-items:center;gap:6px;flex:1;border:0;background:transparent;color:inherit;padding:8px 0;cursor:pointer;text-align:left;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
.dsh-github-group-toggle .chevron{width:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}
.dsh-github-count-badge{min-width:18px;padding:0 6px;border-radius:10px;background:var(--dsw-alias-interactive-bg,#3c3c3c);color:var(--dsw-alias-label-secondary,#c5c5c5);font-size:11px;font-weight:500;text-align:center}
.dsh-github-group-action{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#c5c5c5);cursor:pointer;font-size:12px;padding:4px 6px;border-radius:4px}
.dsh-github-group-action:hover{background:var(--dsw-alias-interactive-bg-hover)}

/* ===== File rows ===== */
.dsh-github-change-row{display:flex;align-items:center;gap:2px;padding:0 12px 0 16px;height:26px;position:relative}
.dsh-github-change-row:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2d2e)}
.dsh-github-change-row.selected{background:var(--dsw-alias-interactive-bg-selected,#04395e)}
.dsh-github-change-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0;border:0;background:transparent;color:inherit;cursor:pointer;text-align:left;padding:0;height:100%}
.dsh-github-kind{flex:none;width:16px;height:16px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;line-height:1}
.dsh-github-kind.kind-untracked{background:#73c991;color:#062b1a}
.dsh-github-kind.kind-added{background:#89d185;color:#123a12}
.dsh-github-kind.kind-modified{background:#e2c08d;color:#3d2c08}
.dsh-github-kind.kind-deleted{background:#f48771;color:#3d0d06}
.dsh-github-kind.kind-renamed,.dsh-github-kind.kind-copied{background:#75beff;color:#0a2d4d}
.dsh-github-kind.kind-conflict{background:#f7d154;color:#3d3105}
.dsh-github-change-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;display:flex;align-items:center;gap:6px}
.dsh-github-change-path small{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px}
.dsh-github-row-actions{display:none;align-items:center;gap:2px;flex:none}
.dsh-github-change-row:hover .dsh-github-row-actions,
.dsh-github-branch-row:hover .dsh-github-row-actions,
.dsh-github-remote-row:hover .dsh-github-row-actions,
.dsh-github-tag-row:hover .dsh-github-row-actions,
.dsh-github-stash-row:hover .dsh-github-row-actions{display:inline-flex}
.dsh-github-icon-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#c5c5c5);cursor:pointer;font-size:13px;line-height:1;padding:4px 5px;border-radius:3px;min-width:22px}
.dsh-github-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary,#e8e8e8)}
.dsh-github-icon-btn.danger:hover{color:var(--dsw-alias-danger-text,#f48771)}

/* ===== Collapsible sections (commits/branches/remotes/tags/stashes/output) ===== */
.dsh-github-section{border-top:1px solid var(--dsw-alias-border-l2,#2b2b2b);margin-top:12px}
.dsh-github-section-header{display:flex;align-items:center;gap:8px;padding:0 16px;margin:4px 0}
.dsh-github-section-body{padding:4px 16px 12px}
.dsh-github-section-empty{padding:6px 0;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:13px}
.dsh-github-search{width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:4px;background:var(--dsw-alias-bg-layer-1,#252526);color:inherit;font-size:13px}

/* ===== Commits ===== */
.dsh-github-commit-item{margin-bottom:2px}
.dsh-github-commit-summary{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;padding:6px 8px;cursor:pointer;text-align:left;border-radius:4px}
.dsh-github-commit-summary:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-commit-sha{font-family:ui-monospace,SFMono-Regular,monospace;color:var(--dsw-alias-brand-primary,#75beff);font-size:12px}
.dsh-github-commit-subject{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.dsh-github-commit-meta{flex:none;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;white-space:nowrap}
.dsh-github-ref-badge{display:inline-block;margin-left:4px;padding:0 5px;border-radius:8px;background:var(--dsw-alias-interactive-bg,#3c3c3c);color:var(--dsw-alias-label-secondary,#c5c5c5);font-size:10px;vertical-align:middle}
.dsh-github-commit-detail{padding:8px 8px 12px;border-left:2px solid var(--dsw-alias-border-l2,#3c3c3c);margin:2px 0 8px 10px}
.dsh-github-commit-detail-meta{font-size:12px;color:var(--dsw-alias-label-secondary,#c5c5c5);margin:0 0 8px;white-space:pre-wrap}
.dsh-github-commit-detail-actions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.dsh-github-commit-file{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;padding:3px 6px;cursor:pointer;text-align:left;border-radius:3px;font-size:12px;font-family:ui-monospace,SFMono-Regular,monospace}
.dsh-github-commit-file:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-commit-file .kind{color:var(--dsw-alias-label-secondary,#c5c5c5);width:14px;text-align:center}

/* ===== Branches / remotes / tags / stashes rows ===== */
.dsh-github-branch-row,.dsh-github-remote-row,.dsh-github-tag-row,.dsh-github-stash-row{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:4px;font-size:13px;min-height:26px}
.dsh-github-branch-row:hover,.dsh-github-remote-row:hover,.dsh-github-tag-row:hover,.dsh-github-stash-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-github-branch-row.current{background:var(--dsw-alias-interactive-bg-selected,#04395e)}
.dsh-github-branch-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-github-branch-name.current{font-weight:600}
.dsh-github-branch-upstream{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px}
.dsh-github-remote-row,.dsh-github-tag-row,.dsh-github-stash-row{cursor:default}
.dsh-github-remote-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.dsh-github-remote-url{display:block;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;font-family:ui-monospace,SFMono-Regular,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-github-row-actions.static{display:inline-flex}
.dsh-github-tag-row .dsh-github-branch-name,.dsh-github-stash-row .dsh-github-branch-name{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px}
.dsh-github-tag-subject{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.dsh-github-stash-message{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.dsh-github-stash-date{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;white-space:nowrap}
.dsh-github-inline-form{display:flex;flex-direction:column;gap:6px;margin:8px 0}
.dsh-github-inline-form input{width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:4px;background:var(--dsw-alias-bg-layer-1,#252526);color:inherit;font-size:13px}
.dsh-github-inline-form .row{display:flex;gap:6px}
.dsh-github-inline-form .row input{flex:1}
.dsh-github-inline-form label{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary,#c5c5c5);cursor:pointer}

/* ===== Git output ===== */
.dsh-github-output-entry{border:1px solid var(--dsw-alias-border-l2,#2b2b2b);border-radius:4px;margin-bottom:8px;overflow:hidden}
.dsh-github-output-cmd{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-1,#252526);font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px}
.dsh-github-output-cmd .ok{color:var(--dsw-alias-success-text,#7ee2a8)}
.dsh-github-output-cmd .fail{color:var(--dsw-alias-danger-text,#f48771)}
.dsh-github-output-cmd .time{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px}
.dsh-github-output-text{margin:0;padding:8px 10px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;color:var(--dsw-alias-label-secondary,#c5c5c5)}

/* ===== Diff viewer ===== */
.dsh-github-diff-header{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#2b2b2b);position:sticky;top:0;background:var(--dsw-alias-bg-layer-2,#1e1e1e);z-index:2;flex-wrap:wrap}
.dsh-github-diff-header .dsh-github-diff-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.dsh-github-diff-header .dsh-github-diff-path .arrow{color:var(--dsw-alias-label-tertiary,#9a9a9a);margin:0 4px}
.dsh-github-diff-header small{color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px}
.dsh-github-diff-toggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:4px;overflow:hidden}
.dsh-github-diff-toggle button{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#c5c5c5);padding:4px 10px;cursor:pointer;font-size:12px}
.dsh-github-diff-toggle button.active{background:var(--dsw-alias-interactive-bg-selected,#04395e);color:inherit}
.dsh-github-diff-body{padding:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5}
.dsh-github-diff-binary{padding:20px;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-style:italic}
.dsh-github-diff-hunk-header{padding:6px 16px;background:var(--dsw-alias-bg-layer-1,#252526);color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:11px;white-space:pre-wrap;word-break:break-all}
.dsh-github-diff-grid{display:block}
.dsh-github-diff-row{display:grid;grid-template-columns:48px 1fr 48px 1fr;min-width:0}
.dsh-github-diff-row .line{white-space:pre-wrap;word-break:break-all;padding:0 8px;min-width:0}
.dsh-github-diff-line-no{padding:0 6px;text-align:right;color:var(--dsw-alias-label-tertiary,#9a9a9a);user-select:none;background:var(--dsw-alias-bg-layer-1,#1a1a1a);border-right:1px solid var(--dsw-alias-border-l2,#2b2b2b)}
.dsh-github-diff-row .line.left{border-right:1px solid var(--dsw-alias-border-l2,#2b2b2b)}
.dsh-github-diff-row .line.remove{background:var(--dsw-alias-diff-remove-bg,#82071e);color:var(--dsw-alias-diff-remove-fg,#ffa198)}
.dsh-github-diff-row .line.add{background:var(--dsw-alias-diff-add-bg,#1a7f37);color:var(--dsw-alias-diff-add-fg,#a5d6a7)}
.dsh-github-diff-row .line.empty{background:var(--dsw-alias-bg-layer-1,#1a1a1a)}
.dsh-github-diff-row.meta{display:block;padding:2px 16px;color:var(--dsw-alias-label-tertiary,#9a9a9a);background:var(--dsw-alias-bg-layer-1,#252526);font-style:italic}
.dsh-github-diff-inline-line{display:grid;grid-template-columns:48px 20px 1fr;min-width:0}
.dsh-github-diff-inline-line .text{white-space:pre-wrap;word-break:break-all;padding:0 8px;min-width:0}
.dsh-github-diff-inline-line .prefix{padding-left:6px;user-select:none}
.dsh-github-diff-inline-line.remove{background:var(--dsw-alias-diff-remove-bg,#82071e);color:var(--dsw-alias-diff-remove-fg,#ffa198)}
.dsh-github-diff-inline-line.add{background:var(--dsw-alias-diff-add-bg,#1a7f37);color:var(--dsw-alias-diff-add-fg,#a5d6a7)}
.dsh-github-diff-inline-line.meta{display:block;padding:2px 16px;color:var(--dsw-alias-label-tertiary,#9a9a9a);background:var(--dsw-alias-bg-layer-1,#252526);font-style:italic}
.dsh-github-empty{padding:20px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}

/* ===== Confirm modal ===== */
.dsh-github-modal-root{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center}
.dsh-github-modal-mask{position:absolute;inset:0;background:rgba(0,0,0,.5)}
.dsh-github-modal{position:relative;width:min(440px,calc(100vw - 32px));padding:18px 20px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#252526);color:var(--dsw-alias-label-primary,#e8e8e8);box-shadow:0 16px 48px rgba(0,0,0,.5);border:1px solid var(--dsw-alias-border-l2,#3c3c3c)}
.dsh-github-modal-title{margin:0 0 10px;font-size:15px}
.dsh-github-modal-message{margin:0 0 6px;font-size:13px;line-height:1.5;white-space:pre-wrap}
.dsh-github-modal-detail{margin:0 0 12px;font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a);white-space:pre-wrap}
.dsh-github-modal-fields{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.dsh-github-modal-input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2,#3c3c3c);border-radius:4px;background:var(--dsw-alias-bg-layer-1,#1e1e1e);color:inherit;font-size:13px}
.dsh-github-modal-checkbox{display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-secondary,#c5c5c5)}
.dsh-github-modal-checkbox input{margin:0}
.dsh-github-modal-actions{display:flex;justify-content:flex-end;gap:8px}
`

/** Inject the Source Control row and drawer stylesheet once. */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
}
