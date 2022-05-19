import type { FixupTable } from './fixups'
import type { PendoConfig } from './types'
import { applyFixups, JSONWithRegex, toHex, toIntegrity } from './utils'

export class AgentValidationError extends Error {
  constructor(msg: string) {
    super(`failed to validate pendo agent: ${msg}`)
  }
}

export type AgentParseResult = {
  /** A PendoConfig object containing server-specified configuration values
   * merged with any local overrides. */
  PendoConfig: PendoConfig
  /** The set of fixup helpers which match the fixups applied. */
  makeFixupHelpers: FixupTable['makeFixupHelpers']
  /** A blob URL which resolves to the parsed agent. */
  src: string
  /** The integrity value of the blob URL. */
  integrity: string
}

/**
 * Processes Pendo agent source. Safely parses PendoConfig options and applies
 * overrides as needed. Verifies hash of inner code block, and applies fixups
 * as needed.
 * @param src Unmodified Pendo agent source. Consists of a header which contains
 * comments and opens an IIFE, minified "inner-agent" source inside the IIFE,
 * and a "footer" containing an object literal to call the IIFE with.
 * @param pendoConfig PendoConfig values to enforce
 * @param fixups A map of inner-agent integrity values to matching fixup tables.
 * The inner-agent code does not change with changes in the Pendo configuration,
 * so its integrity value identifies a specific version.
 * @throws {PendoAgentValidationError} if the agent source does not parse as
 * expected, or if the inner-agent's integrity value is not found in the fixup table
 */
export async function parseAgent(
  src: string,
  pendoConfig: PendoConfig,
  fixupTables: Record<string, FixupTable>
): Promise<AgentParseResult> {
  if (typeof src !== 'string') throw new AgentValidationError('src is not a string')
  if (typeof pendoConfig !== 'object') {
    throw new AgentValidationError('pendoConfig is not an object')
  }
  if (typeof fixupTables !== 'object') {
    throw new AgentValidationError('fixupTables is not an object')
  }

  const lines = src.split('\n')
  const agentHeaderLines = []
  const innerAgentLines = []
  const config: Record<string, unknown> = {}
  const expectLine = (regex: RegExp, last = false) => {
    if (lines.length === 0) throw new AgentValidationError('expected line missing')
    const line = last ? lines.pop() : lines.shift()
    if (line === undefined || !regex.test(line))
      throw new AgentValidationError('line does not match expectations')
    return line
  }
  const expectLastLine = (regex: RegExp) => expectLine(regex, true)
  agentHeaderLines.push(expectLine(/^\/\/ Pendo Agent Wrapper$/))
  agentHeaderLines.push(expectLine(/^\/\/ Environment:\s+(production|staging)$/))
  agentHeaderLines.push(expectLine(/^\/\/ Agent Version:\s+(\d+\.)*\d+$/))
  agentHeaderLines.push(expectLine(/^\/\/ Installed:\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/))
  agentHeaderLines.push(expectLine(/^\(function \(PendoConfig\) \{$/))
  while (lines.length > 0 && !/^\}\)\(\{$/.test(lines[0])) {
    innerAgentLines.push(lines.shift())
  }
  expectLine(/^\}\)\(\{$/)
  expectLastLine(/^\}\);$/)

  const regexCookie = toHex(await window.crypto.getRandomValues(new Uint8Array(16)))
  const jsonWithRegex = new JSONWithRegex(regexCookie)
  while (lines.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const line = lines.shift()!
    if (/^\s*$/.test(line)) continue
    const result = /^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.*?)\s*,?\s*$/.exec(line)
    if (!result) throw new AgentValidationError('configuration line unparsable')
    const [, name, value] = result
    config[name] = (() => {
      try {
        return JSON.parse(value)
      } catch {
        // swallow error
      }
      const regexValue = value.replace(/\/((?:\\\/|[^/])*)\/([a-z]*)/g, (x) =>
        JSON.stringify(`${regexCookie}${x}`)
      )
      try {
        return jsonWithRegex.parse(regexValue)
      } catch (e) {
        throw new AgentValidationError(`configuration value unparsable (${value})`)
      }
    })()
  }

  for (const [k, v] of Object.entries(config)) {
    if (k in pendoConfig) {
      const expected = pendoConfig[k]
      if (jsonWithRegex.stringify(v) !== jsonWithRegex.stringify(expected)) {
        console.warn(
          `PendoStub: PendoConfig parameter ${k} (${v}) does not match expected value (${expected}), and will be overridden`
        )
      }
    }
  }
  Object.assign(config, pendoConfig)

  const innerAgentSrc = innerAgentLines.join('\n')
  const innerAgentIntegrity = await toIntegrity(innerAgentSrc)
  const innerAgentFixupTable = fixupTables[innerAgentIntegrity]
  if (!innerAgentFixupTable) {
    throw new AgentValidationError(`innerAgentIntegrity '${innerAgentIntegrity}' not recognized`)
  }

  const agentHeader = agentHeaderLines.join('\n')
  const fixedUpInnerAgent = applyFixups(innerAgentSrc, innerAgentFixupTable.fixups)
  const agentSrc = `${agentHeader}\n${fixedUpInnerAgent}\n})(pendoEnv.PendoConfig);\n`
  return {
    PendoConfig: config as PendoConfig,
    makeFixupHelpers: innerAgentFixupTable.makeFixupHelpers,
    src: URL.createObjectURL(new Blob([agentSrc], { type: 'text/javascript' })),
    integrity: await toIntegrity(agentSrc)
  }
}
