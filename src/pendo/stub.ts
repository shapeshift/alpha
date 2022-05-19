import { makePendoEnv } from './env'
import { fixupTables } from './fixups'
import { parseAgent } from './parseAgent'
import { Pendo, PendoConfig, PendoInitializeParams, Window } from './types'

declare const window: Window & typeof globalThis

export function loadPendoAgent(
  pendoConfig: PendoConfig,
  pendoInitializeParams: Omit<PendoInitializeParams, 'visitor'>
): Promise<(x: string) => void> {
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

  let initializeResolver: (x: string) => void
  new Promise<string>((resolve) => {
    initializeResolver = resolve
  })
    .then(async (x) =>
      pendo.initialize({
        visitor: { id: x },
        ...pendoInitializeParams,
        ...pendoConfig
      })
    )
    .catch((e) => console.error(`PendoStub: error initializing`, e))

  let visitorIdSetterResolver: (x: (y: string) => void) => void
  let visitorIdSetterRejector: (e: unknown) => void
  const visitorIdSetterPromise = new Promise<(x: string) => void>((resolve, reject) => {
    visitorIdSetterResolver = resolve
    visitorIdSetterRejector = reject
  })

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
    () => visitorIdSetterResolver(initializeResolver),
    (e) => {
      console.error(`PendoStub: error loading agent`, e)
      visitorIdSetterRejector(e)
    }
  )

  return visitorIdSetterPromise
}
