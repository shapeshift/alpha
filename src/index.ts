import { loadPendoAgent } from './pendoStub'

loadPendoAgent(
  'sha256-nUoO330kQ1XlmPrDlASmM7FNAHKBncX0LZRbwnYL/V4=',
  {
    environmentName: 'production',
    blockAgentMetadata: false, // double-check
    blockLogRemoteAddress: true,
    dataHost: 'data.pendo.io',
    // stagingServers: [/^.*\.web-29e\.pages\.dev$/, 'localhost:3000'],
    stagingAgentUrl:
      'https://pendo-io-static.storage.googleapis.com/agent/static/67c2f326-a6c2-4aa2-4559-08a53b679e93/pendo-staging.js',
    allowedOriginServers: ['https://pendo-static-6047664892149760.storage.googleapis.com'],
    allowCrossOriginFrames: false,
    disableCookies: true,
    disableFeedbackAutoInit: false, // double-check
    disableGlobalCSS: true,
    disablePersistence: true,
    excludeAllText: true,
    guideValidation: true,
    localStorageOnly: true,
    preferBroadcastChannel: true,
    preferMutationObserver: true,
    preventCodeInjection: true,
    requireHTTPS: true,
    restrictP1Access: true,
    xhrTimings: false,
    xhrWhitelist: null,
    htmlAttributeBlacklist: null,
    htmlAttributes: /^(tabindex)$/i,
    apiKey: '67c2f326-a6c2-4aa2-4559-08a53b679e93',
    // hack to stop SameSite cookie warnings while disableCookies is set
    cookieDomain: window.location.hostname,
    sanitizeUrl: (x: string) => {
      console.debug('PendoConfig:sanitizeUrl', x)
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
  },
  {
    visitor: {
      id: 'test_visitor'
    }
  }
)
