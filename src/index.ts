import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-typert-registry'
import { GithubRuntime } from './runtime.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import type { ResolvedConfig } from './types.ts'

/** Cordis plugin name. */
export const name = 'dsh-github'
/** Services required before Typert registration. */
export const inject = ['typert']

/** Deployment limits for local Git inspection. */
export interface Config {
  /** Maximum changed files returned to the browser. */
  maxFiles: number
  /** Maximum diff bytes returned for one file. */
  maxDiffBytes: number
  /** Maximum bytes read from an untracked file. */
  maxUntrackedBytes: number
}

/** Configuration schema with bounded defaults. */
export const Config = z.object({
  maxFiles: z.number().step(1).min(1).max(1_000).default(200),
  maxDiffBytes: z.number().step(1).min(1_024).max(2_000_000).default(200_000),
  maxUntrackedBytes: z.number().step(1).min(1_024).max(2_000_000).default(100_000),
})

/** Register the host Remote and strict Typert manifest. */
export function apply(ctx: Context, config?: Config): void {
  const resolved = Config(config ?? {}) as ResolvedConfig
  new GithubRuntime(ctx, resolved)
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-github: typert manifest')
}
