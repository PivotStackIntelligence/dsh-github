const STYLE_ID = 'dsh-github-styles'
const css = `.dsh-github-row{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 10px;border:0;border-radius:10px;background:transparent;cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);text-align:left}.dsh-github-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-github-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}`
/** Inject the Changes row stylesheet once. */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = css; document.head.appendChild(style)
}
