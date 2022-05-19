import { makePendoDummyEnv } from './pendoDummyEnv'
import { PendoInitializeParams, Window } from './types'

declare const window: Window & typeof globalThis

// Parses Pendo agent source and verifies that its embedded configuration does not conflict with our overrides
/*export async function parsePendoAgent(
  src: string,
  expectedPendoOptions: Record<string, unknown>,
  expectedInnerAgentDigest: string
) {
  if (typeof src !== 'string') throw new PendoAgentValidationError('src is not a string')
  if (typeof expectedPendoOptions !== 'object')
    throw new PendoAgentValidationError('expectedConfig is not an object')
  if (typeof expectedInnerAgentDigest !== 'string')
    throw new PendoAgentValidationError('expectedInnerAgentDigest is not a string')

  const lines = src.split('\n')
  const innerAgentLines = []
  const config: Record<string, unknown> = {}
  const expectLine = (regex: RegExp, last = false) => {
    if (lines.length === 0) throw new PendoAgentValidationError('expected line missing')
    const line = last ? lines.pop() : lines.shift()
    if (line === undefined || !regex.test(line))
      throw new PendoAgentValidationError('line does not match expectations')
    return line
  }
  const expectLastLine = (regex: RegExp) => expectLine(regex, true)
  expectLine(/^\/\/ Pendo Agent Wrapper$/)
  expectLine(/^\/\/ Environment:\s+(production|staging)$/)
  expectLine(/^\/\/ Agent Version:\s+(\d+\.)*\d+$/)
  expectLine(/^\/\/ Installed:\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  expectLine(/^\(function \(PendoConfig\) \{$/)
  while (lines.length > 0 && !/^\}\)\(\{$/.test(lines[0])) {
    innerAgentLines.push(lines.shift())
  }
  expectLine(/^\}\)\(\{$/)
  expectLastLine(/^\}\);$/)

  const regexCookie = toHex(await window.crypto.getRandomValues(new Uint8Array(16)))
  const jsonWithRegex = new JSONWithRegex(regexCookie)
  while (lines.length > 0) {
    const line = lines.shift()!
    const result = /^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.*)\s*,?\s*$/.exec(line)
    if (!result) throw new PendoAgentValidationError('configuration line unparsable')
    const [, name, value] = result
    config[name] = (() => {
      try {
        return JSON.parse(value)
      } catch {
        // swallow error
      }
      value.replace(/\/((?:\\\/|[^/])*)\/([a-z]*)/g, (x) => `${regexCookie}${JSON.stringify(x)}`)
      return jsonWithRegex.parse(value)
    })()
  }

  for (const [k, v] of Object.entries(config)) {
    if (k in expectedPendoOptions) {
      const expected = expectedPendoOptions[k]
      if (jsonWithRegex.stringify(v) !== jsonWithRegex.stringify(expected)) {
        throw new PendoAgentValidationError(
          `configuration parameter ${k} (${v}) does not match expected value (${expected})`
        )
      }
    }
  }

  const innerAgentSrc = innerAgentLines.join('\n')
  const innerAgentDigest = toHex(
    new Uint8Array(
      await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(innerAgentSrc))
    )
  )

  if (innerAgentDigest !== expectedInnerAgentDigest) {
    throw new PendoAgentValidationError(
      `innerAgentDigest (${innerAgentDigest}) does not match expected value (${expectedInnerAgentDigest})`
    )
  }

  return config
}*/

// Prepare Pendo stub. This queues actions to be taken by the agent once it's loaded, and is equivalent
// to the official minified Pendo installation snippet.
/*export function installPendoStub() {
  window.pendo ||= {} as Pendo
  window.pendo._q ||= []
  window.pendo.initialize ||= (...args: any[]) => window.pendo!._q.unshift(['initialize', ...args])
  window.pendo.identify ||= (...args: any[]) => window.pendo!._q.push(['identify', ...args])
  window.pendo.updateOptions ||= (...args: any[]) =>
    window.pendo!._q.push(['updateOptions', ...args])
  window.pendo.pageLoad ||= (...args: any[]) => window.pendo!._q.push(['pageLoad', ...args])
  window.pendo.track ||= (...args: any[]) => window.pendo!._q.push(['track', ...args])
}*/

export function loadPendoAgent(
  agentIntegrity: string,
  pendoOptions: Record<string, unknown>,
  pendoInitializeParams: PendoInitializeParams
) {
  window.pendo_options = pendoOptions
  const pendoDummyEnv = makePendoDummyEnv(fetch)
  ;(window as unknown as { pendoDummyEnv: unknown }).pendoDummyEnv = pendoDummyEnv
  window.pendo = pendoDummyEnv.pendo
  // installPendoStub()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  window.pendo!.initialize(pendoInitializeParams)
  ;(async () => {
    const agentSrc = await (
      await fetch(`https://cdn.pendo.io/agent/static/${pendoOptions.apiKey}/pendo.js`, {
        integrity: agentIntegrity,
        credentials: 'omit'
      })
    ).text()
    const modifiedAgentSrc = `(function(){\nwith(pendoDummyEnv){\n${agentSrc}\n})()\n`
    const modifiedAgentBuf = new TextEncoder().encode(modifiedAgentSrc)
    const modifiedAgentUrl = URL.createObjectURL(
      new Blob([modifiedAgentBuf], { type: 'text/javascript' })
    )
    const integrityBuf = new Uint8Array(await crypto.subtle.digest('SHA-256', modifiedAgentBuf))
    const integrity = `sha256-${window.btoa(
      String.fromCharCode.apply(String.fromCharCode, Array.from(integrityBuf))
    )}`

    console.info(`pendoStub: loading wrapped agent with integrity value of ${integrity}`)

    const agentScriptNode = document.createElement('script')
    agentScriptNode.async = true
    // agentScriptNode.src = 'https://cdn.pendo.io/agent/static/' + pendoOptions.apiKey + '/pendo.js'
    // TODO: add serviceworker-based validation of the agent script using parsePendoAgent?
    agentScriptNode.src = modifiedAgentUrl
    agentScriptNode.integrity = integrity
    agentScriptNode.crossOrigin = 'anonymous'
    document.body.appendChild(agentScriptNode)
  })().catch((e) => console.error(e))
}
