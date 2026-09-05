// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { workspaceTitleOf } from '../src/client/sessions.ts'
import { DSH_OPEN_PATH_REMOTE } from '../src/client/remote.ts'

describe('client/sessions', () => {
  // Copied verbatim from dsh-client-ui-workspace@0.1.2-rc.1; keep its shape.
  it('reads the final non-empty path segment for the display title', () => {
    expect(workspaceTitleOf('/srv/repos/dsh-github')).toBe('dsh-github')
    expect(workspaceTitleOf('/srv/repos/dsh-github/')).toBe('dsh-github')
    expect(workspaceTitleOf('C:\\work\\dsh-github')).toBe('dsh-github')
    expect(workspaceTitleOf('')).toBe('')
    expect(workspaceTitleOf('/')).toBe('')
    expect(workspaceTitleOf('/srv/')).toBe('srv')
  })
})

describe('client/remote DSH_OPEN_PATH_REMOTE', () => {
  // The rc.1 native-opener mount must stay byte-compatible with the Host's
  // generated `session` namespace (copied from dsh-api-remotes@0.1.2-rc.1).
  it('contributes exactly the session/openWorkspacePath invocation', () => {
    expect(DSH_OPEN_PATH_REMOTE.package).toBe('@deepseek-ai/dsh-api-session-controller')
    expect(DSH_OPEN_PATH_REMOTE.descriptors).toHaveLength(1)
    const descriptor = DSH_OPEN_PATH_REMOTE.descriptors[0]
    expect(descriptor.id).toBe('@deepseek-ai/dsh-api-session-controller#session/openWorkspacePath')
    expect(descriptor.namespace).toBe('session')
    expect(descriptor.method).toBe('openWorkspacePath')
    expect(descriptor.cancellation).toEqual({ parameter: 'signal' })
    expect(descriptor.parameters).toHaveLength(1)
    expect(descriptor.parameters[0]).toMatchObject({ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict' } })
    expect(descriptor.result).toMatchObject({ mode: 'strict', typeSymbol: '@deepseek-ai/dsh-api-session-controller/types#SessionOpenWorkspacePathValue' })
  })
})
