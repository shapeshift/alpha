import { armPendoAgent, PendoConfig, PendoInitializeParams } from './pendo'
import { Window } from './pendo/types'
import { sanitizeUrl } from './sanitizeUrl'
import { PendoLauncher } from './types'
import { deferred } from './utils'
import { getVisitorId, resetVisitorId } from './visitorId'

declare const window: Window & typeof globalThis

/**
 * sanitizeUrl, validateLauncher, and validateGlobalScript are needed here, but
 * the rest are also included for debugging convenience.
 */
const basePendoInitializeParams = {
  sanitizeUrl,
  events: {
    ready: () => {
      console.debug('PendoConfig: ready')
    },
    deliverablesLoaded: () => {
      console.debug('PendoConfig: deliverablesLoaded')
    },
    guidesFailed: () => {
      console.debug('PendoConfig: guidesFailed')
    },
    guidesLoaded: () => {
      console.debug('PendoConfig: guidesLoaded')
    },
    validateGuide: async (signatureString: string) => {
      console.debug('PendoConfig: validateGuide', signatureString)
      // Guide validation is provided by the logic in pendo/filters.ts
      return true
    },
    validateLauncher: async (signatureString: string) => {
      console.debug('PendoConfig: validateLauncher', signatureString)
      return false
    },
    validateGlobalScript: async (data: unknown) => {
      console.debug('PendoConfig: validateGlobalScript', data)
      return false
    }
  }
}

/**
 * Makes the hooks object that should be exposed to the consent plugin.
 */
export function makePendoLauncher(
  pendoConfig: PendoConfig,
  pendoInitializeParams?: PendoInitializeParams
): PendoLauncher {
  const [armAgentPromise, armAgentResolver] = deferred<void>()
  const agentInitializerPromise = armAgentPromise.then(() =>
    armPendoAgent(pendoConfig, {
      ...basePendoInitializeParams,
      ...(pendoInitializeParams ?? {})
    })
  )

  return {
    arm() {
      armAgentResolver()
    },
    launch(idPrefix?: string) {
      armAgentResolver()
      agentInitializerPromise.then((init) =>
        init(getVisitorId().then((id) => `${idPrefix ?? ''}${id}`))
      )
    },
    reset() {
      resetVisitorId()
    },
    get transmissionLog() {
      return window.pendoEnv?.transmissionLog ?? []
    }
  }
}
