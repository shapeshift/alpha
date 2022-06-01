import { deferred } from '../utils'
import { makePendoEnv } from './env'
import { fixupTables } from './fixups'
import { parseAgent } from './parseAgent'
import { Pendo, PendoConfig, PendoInitializeParams, Window } from './types'

declare const window: Window & typeof globalThis

/**
 * Downloads the Pendo agent, applies fixups to make it safe, and then loads it
 * into the document. This will initiate a (potentially cached) request to Pendo
 * servers for the agent and start to run the returned code, but the agent will
 * not start transmitting telemetry or load guides until initialized.
 * @returns A Promise for an initializer function, which will initialize the
 * agent, start transmitting telemetry, and load guides. The initializer takes a
 * visitor ID string as a parameter. (This is a one-shot thing; repeated calls
 * will not change the visitor ID.)
 */
export function armPendoAgent(
  pendoConfig: PendoConfig,
  pendoInitializeParams: Omit<PendoInitializeParams, 'visitor'>
): (x: string | Promise<string>) => void {
  const pendoEnv = makePendoEnv(pendoConfig)
  const pendo: Pendo = pendoEnv.pendo

  Object.defineProperty(window, 'pendo', {
    enumerable: true,
    get() {
      return pendo
    },
    set(value: unknown) {
      if (value !== pendo) throw new Error('overwriting window.pendo is not allowed')
    }
  })
  Object.defineProperty(window, 'pendoEnv', {
    enumerable: true,
    get() {
      return pendoEnv
    },
    set(value: unknown) {
      if (value !== pendoEnv) throw new Error('overwriting window.pendoEnv is not allowed')
    }
  })

  const [agentReadyPromise, agentReadyResolver, agentReadyRejector] = deferred<void>()
  const [initializePromise, initializeResolver] = deferred<string>()

  Promise.all([initializePromise, agentReadyPromise])
    .then(async ([x]) =>
      pendo.initialize({
        ...(x ? { visitor: { id: x } } : {}),
        ...pendoInitializeParams,
        ...pendoConfig
      })
    )
    .catch((e) => console.error(`PendoStub: error initializing`, e))
  ;(async () => {
    const agentSrc = await (
      await fetch(`https://cdn.pendo.io/agent/static/${pendoConfig.apiKey}/pendo.js`, {
        credentials: 'omit'
      })
    ).text()
    const parsedAgent = await parseAgent(agentSrc, pendoConfig, fixupTables)
    pendoEnv.PendoConfig = parsedAgent.PendoConfig

    const pendoFixupHelpers = parsedAgent.makeFixupHelpers(pendoEnv)
    Object.defineProperty(window, 'pendoFixupHelpers', {
      enumerable: true,
      get() {
        return pendoFixupHelpers
      },
      set(value: unknown) {
        if (value !== pendoFixupHelpers) {
          throw new Error('overwriting window.pendoFixupHelpers is not allowed')
        }
      }
    })

    console.info(`PendoStub: loading parsed agent with integrity value of ${parsedAgent.integrity}`)

    const agentScriptNode = document.createElement('script')
    agentScriptNode.async = true
    agentScriptNode.src = parsedAgent.src
    agentScriptNode.integrity = parsedAgent.integrity
    agentScriptNode.crossOrigin = 'anonymous'
    document.body.appendChild(agentScriptNode)
  })().then(
    () => agentReadyResolver(),
    (e) => {
      console.error(`PendoStub: error loading agent`, e)
      agentReadyRejector(e)
    }
  )

  return initializeResolver
}
