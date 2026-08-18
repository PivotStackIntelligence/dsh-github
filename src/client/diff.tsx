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

/** One aligned side-by-side row: a removed and an added line paired as a modification, or one-sided. */
interface AlignedRow {
  left: DiffLine | null
  right: DiffLine | null
  meta: DiffLine | null
}

/**
 * Align a hunk's lines into side-by-side rows. A run of removed lines
 * followed by a run of added lines pairs position-wise into modified rows
 * (old text left, new text right), mirroring VS Code's diff alignment.
 */
function alignRows(lines: DiffLine[]): AlignedRow[] {
  const rows: AlignedRow[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (line.type === 'meta') { rows.push({ left: null, right: null, meta: line }); index++; continue }
    if (line.type === 'remove') {
      const removes: DiffLine[] = []
      while (index < lines.length && lines[index]!.type === 'remove') { removes.push(lines[index]!); index++ }
      const adds: DiffLine[] = []
      while (index < lines.length && lines[index]!.type === 'add') { adds.push(lines[index]!); index++ }
      const count = Math.max(removes.length, adds.length)
      for (let pair = 0; pair < count; pair++) rows.push({ left: removes[pair] ?? null, right: adds[pair] ?? null, meta: null })
      continue
    }
    if (line.type === 'add') {
      while (index < lines.length && lines[index]!.type === 'add') { rows.push({ left: null, right: lines[index]!, meta: null }); index++ }
      continue
    }
    rows.push({ left: line, right: line, meta: null })
    index++
  }
  return rows
}

/**
 * Side-by-side two-pane diff: old file on the left, new on the right, with
 * line numbers on the outer edges, removal/addition pairing, and +/− markers.
 */
export function SideBySideDiff({ parsed, noNewlineLabel }: { parsed: ParsedDiff; noNewlineLabel: string }) {
  return <div className="dsh-github-diff-grid">
    {parsed.hunks.map((hunk, hunkIndex) => <div className="dsh-github-diff-hunk" key={hunkIndex}>
      <div className="dsh-github-diff-hunk-header">{hunk.header}</div>
      {alignRows(hunk.lines).map((row, rowIndex) => {
        if (row.meta !== null) return <div className="dsh-github-diff-row meta" key={rowIndex}>{noNewlineLabel}</div>
        const left = row.left
        const right = row.right
        const leftClass = left === null ? 'empty' : left.type === 'remove' ? 'remove' : 'context'
        const rightClass = right === null ? 'empty' : right.type === 'add' ? 'add' : 'context'
        const rowClass = left?.type === 'remove' && right?.type === 'add' ? 'pair' : left?.type === 'remove' ? 'remove' : right?.type === 'add' ? 'add' : 'context'
        return <div className={`dsh-github-diff-row ${rowClass}`} key={rowIndex}>
          <span className="dsh-github-diff-line-no">{left?.oldLine ?? ''}</span>
          <span className={`dsh-github-diff-line left ${leftClass}`}>{left === null ? '' : left.text}</span>
          <span className="dsh-github-diff-line-no">{right?.newLine ?? ''}</span>
          <span className={`dsh-github-diff-line right ${rightClass}`}>{right === null ? '' : right.text}</span>
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
