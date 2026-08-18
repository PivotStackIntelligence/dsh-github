/**
 * Unified-diff parsing and rendering for the Source Control drawer. The
 * parser splits a bounded unified diff into per-hunk lines aligned for a
 * side-by-side (old | new) view, and also powers the inline view.
 * Author: bugmaker2 · PivotStack Intelligence
 */

/** One parsed line of a unified diff hunk. */
export interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'meta'
  /** 1-based old-file line number, or null when absent. */
  oldLine: number | null
  /** 1-based new-file line number, or null when absent. */
  newLine: number | null
  text: string
}

/** One `@@ -a,b +c,d @@` hunk. */
export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

/** Structured projection of one bounded unified diff. */
export interface ParsedDiff {
  /** Old path from `---`, or null for `/dev/null`. */
  oldPath: string | null
  /** New path from `+++`, or null for `/dev/null`. */
  newPath: string | null
  /** True when the diff represents a binary change. */
  isBinary: boolean
  /** Human-readable binary message when `isBinary`. */
  binaryMessage: string | null
  hunks: DiffHunk[]
  /** True when nothing renderable was parsed. */
  empty: boolean
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Normalize a `--- a/foo` / `+++ b/foo` path, mapping `/dev/null` to null. */
function cleanPath(raw: string): string | null {
  let path = raw.trim()
  if (path === '/dev/null') return null
  if (path.startsWith('a/') || path.startsWith('b/')) path = path.slice(2)
  if (path.startsWith('"a/') || path.startsWith('"b/')) path = path.slice(3).replace(/"$/, '')
  return path
}

/** Parse a bounded unified diff into hunks and paths. */
export function parseUnifiedDiff(diff: string): ParsedDiff {
  const lines = diff.split('\n')
  let oldPath: string | null = null
  let newPath: string | null = null
  let binaryMessage: string | null = null
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (/^(Binary files|Binary file|GIT binary patch)/.test(line)) {
      binaryMessage = line.trim() || 'Binary file'
      continue
    }
    if (line.startsWith('--- ')) { oldPath = cleanPath(line.slice(4)); continue }
    if (line.startsWith('+++ ')) { newPath = cleanPath(line.slice(4)); continue }
    const hunkMatch = HUNK_RE.exec(line)
    if (hunkMatch !== null) {
      oldLine = Number.parseInt(hunkMatch[1] ?? '0', 10)
      newLine = Number.parseInt(hunkMatch[3] ?? '0', 10)
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (current === null) continue
    if (line.startsWith('\\')) {
      current.lines.push({ type: 'meta', oldLine: null, newLine: null, text: line })
      continue
    }
    if (line.startsWith('-')) {
      current.lines.push({ type: 'remove', oldLine: oldLine++, newLine: null, text: line.slice(1) })
      continue
    }
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', oldLine: null, newLine: newLine++, text: line.slice(1) })
      continue
    }
    if (line.startsWith(' ')) {
      current.lines.push({ type: 'context', oldLine: oldLine++, newLine: newLine++, text: line.slice(1) })
    }
  }

  const isBinary = binaryMessage !== null
  const empty = hunks.length === 0 && !isBinary
  return { oldPath, newPath, isBinary, binaryMessage, hunks, empty }
}

/**
 * Side-by-side two-pane diff: old file on the left, new on the right, with
 * line numbers on the outer edges.
 */
export function SideBySideDiff({ parsed, noNewlineLabel }: { parsed: ParsedDiff; noNewlineLabel: string }) {
  return <div className="dsh-github-diff-grid">
    {parsed.hunks.map((hunk, hunkIndex) => <div className="dsh-github-diff-hunk" key={hunkIndex}>
      <div className="dsh-github-diff-hunk-header">{hunk.header}</div>
      {hunk.lines.map((line, lineIndex) => {
        if (line.type === 'meta') return <div className="dsh-github-diff-row meta" key={lineIndex}>{noNewlineLabel}</div>
        const leftText = line.type === 'add' ? '' : line.text
        const rightText = line.type === 'remove' ? '' : line.text
        const leftClass = line.type === 'remove' ? 'remove' : line.type === 'add' ? 'empty' : 'context'
        const rightClass = line.type === 'add' ? 'add' : line.type === 'remove' ? 'empty' : 'context'
        return <div className={`dsh-github-diff-row ${line.type}`} key={lineIndex}>
          <span className="dsh-github-diff-line-no">{line.oldLine ?? ''}</span>
          <span className={`dsh-github-diff-line left ${leftClass}`}>{leftText}</span>
          <span className="dsh-github-diff-line-no">{line.newLine ?? ''}</span>
          <span className={`dsh-github-diff-line right ${rightClass}`}>{rightText}</span>
        </div>
      })}
    </div>)}
  </div>
}

/** Inline unified view: one column with +/- prefixes. */
export function InlineDiff({ parsed, noNewlineLabel }: { parsed: ParsedDiff; noNewlineLabel: string }) {
  return <div className="dsh-github-diff-inline">
    {parsed.hunks.map((hunk, hunkIndex) => <div className="dsh-github-diff-hunk" key={hunkIndex}>
      <div className="dsh-github-diff-hunk-header">{hunk.header}</div>
      {hunk.lines.map((line, lineIndex) => {
        if (line.type === 'meta') return <div className="dsh-github-diff-inline-line meta" key={lineIndex}>{noNewlineLabel}</div>
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
        return <div className={`dsh-github-diff-inline-line ${line.type}`} key={lineIndex}>
          <span className="dsh-github-diff-line-no">{line.oldLine ?? line.newLine ?? ''}</span>
          <span className="prefix">{prefix}</span>
          <span className="text">{line.text}</span>
        </div>
      })}
    </div>)}
  </div>
}
