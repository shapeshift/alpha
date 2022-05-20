import { loadPendoAgent } from './pendoStub'

loadPendoAgent(
  'sha256-nUoO330kQ1XlmPrDlASmM7FNAHKBncX0LZRbwnYL/V4=',
  {
    // This is -- except for preventCodeInjection -- recapitulation of settings
    // already provided with the agent, but these are the security-critical bits.
    blockAgentMetadata: false, // double-check
    blockLogRemoteAddress: true,
    dataHost: 'data.pendo.io',
    allowedOriginServers: ['https://pendo-static-6047664892149760.storage.googleapis.com'],
    allowCrossOriginFrames: false,
    disableCookies: true,
    disableGlobalCSS: true,
    disablePersistence: false,
    excludeAllText: true,
    guideValidation: true,
    localStorageOnly: true,
    preventCodeInjection: true,
    requireHTTPS: true,
    restrictP1Access: true,
    xhrTimings: false,
    xhrWhitelist: null,
    htmlAttributeBlacklist: null,
    htmlAttributes: /^(tabindex)$/i,
    apiKey: '67c2f326-a6c2-4aa2-4559-08a53b679e93'
  },
  {
    visitor: {
      id: 'test_visitor'
    },
    sanitizeUrl: (x: string) => {
      console.debug('PendoConfig:sanitizeUrl')
      return x
    },
    events: {
      ready: () => {
        console.debug('PendoConfig:ready')
      },
      deliverablesLoaded: () => {
        console.debug('PendoConfig:deliverablesLoaded')
      },
      guidesFailed: () => {
        console.debug('PendoConfig:guidesFailed')
      },
      guidesLoaded: () => {
        console.debug('PendoConfig:guidesLoaded')
      },
      validateGuide: async (signatureString: string) => {
        console.debug('PendoConfig:validateGuide', signatureString)
        return true
      },
      validateLauncher: async (signatureString: string) => {
        console.debug('PendoConfig:validateLauncher', signatureString)
        return true
      },
      validateGlobalScript: async (data: unknown) => {
        console.debug('PendoConfig:validateGlobalScript', data)
        return true
      }
    }
  }
)
