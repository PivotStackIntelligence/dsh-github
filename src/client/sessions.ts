/**
 * dsh-github — local session-kit faces and the workspace-title helper.
 *
 * dsh 0.1.2-rc.1 removed the `@deepseek-ai/dsh-client-runtime` package (it
 * ended at 0.1.1-rc.2; the rc.1 harness only resolves platform seed words and
 * installed plugin rows in its browser module table, so this package's
 * browser bundle cannot be required any more). The only parts of it this
 * plugin consumed were the session-list standard-kit types — which rc.1
 * re-homes into `@deepseek-ai/dsh-api-session-controller/client` (see
 * `@deepseek-ai/dsh-client-ui-session`'s Global/Session standard-props
 * merges) — and the two-line `workspaceTitleOf` display helper, which
 * rc.1 moved into `@deepseek-ai/dsh-client-ui-workspace`. Neither is
 * directly requirable from a plugin bundle on rc.1, so they are carried here:
 * the types re-exported erasure-safely from the published controller types,
 * the helper copied verbatim from
 * `dsh-client-ui-workspace/lib/client.js:257-262` on 0.1.2-rc.1.
 * Author: Ev3nt1ne · port notes 2026-09
 */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export type { SessionId, SessionListState, SessionSummary }

/**
 * Read the final non-empty segment of a Workspace path for display.
 * Workspace-label surfaces use this helper instead of deriving another basename.
 * @param path - Workspace directory path using POSIX or Windows separators.
 * @returns the final segment, or an empty string for a separator-only path.
 */
export function workspaceTitleOf(path: string): string {
  return path.replace(/[/\\]+$/, '').split(/[\\/]/).filter(part => part !== '').pop() ?? ''
}
