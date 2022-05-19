import { loadPendoAgent } from './pendo'
import { getVisitorId } from './visitorId'

loadPendoAgent(
  // This is mostly recapitulation of settings already provided with the agent,
  // but these are the security-critical bits and will be enforced.
  {
    blockAgentMetadata: false, // TODO: double-check
    blockLogRemoteAddress: true, // This doesn't do anything in the current agent version, but the server sets it anyway
    dataHost: 'data.pendo.io',
    allowedOriginServers: ['https://pendo-static-6047664892149760.storage.googleapis.com'],
    allowCrossOriginFrames: false,
    disableCookies: false, // Safe b/c we're remapping to pendoEnv.cookieStorage
    disableGlobalCSS: true,
    disablePersistence: false, // Safe b/c we're remapping all storage accesses
    excludeAllText: true,
    guideValidation: true,
    localStorageOnly: false, // Safe b/c we're remapping to pendoEnv.localStorage
    preventCodeInjection: true,
    requireHTTPS: true,
    restrictP1Access: true,
    xhrTimings: false,
    xhrWhitelist: null,
    htmlAttributeBlacklist: null,
    htmlAttributes: /^(tabindex)$/,
    apiKey: '67c2f326-a6c2-4aa2-4559-08a53b679e93'
  },
  {
    sanitizeUrl: (x: string) => {
      const url = new URL(x)
      if (url.origin !== window.location.origin) {
        url.pathname = url.pathname.replace(/(?<=^|\/)[^/]{20,}(?=\/|$)/g, '***')
        url.hash = ''
      } else {
        url.hash = url.hash.replace(
          /(\/accounts\/[-a-z0-9]{3,8}:[-a-zA-Z0-9]{1,32}):.*$/i,
          '$1:***'
        )
      }
      console.debug('PendoConfig: sanitizeUrl', x, url.toString())
      return url.toString()
    },
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
)
  .then(async (x) => {
    x(`test_visitor_${await getVisitorId()}`)
  })
  .catch((e) => {
    console.error(`Pendo initialization error`, e)
  })
