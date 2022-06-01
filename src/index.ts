import { makePendoLauncher } from './launcher'
import { Window } from './types'

declare const window: Window & typeof globalThis

/**
 * This is mostly recapitulation of settings already provided with the agent,
 * but these are the security-critical bits that need to be enforced.
 */
window.pendoLauncher = makePendoLauncher({
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
})

setTimeout(() => {
  //TODO: replace this with arm() once launch is handled by the consent plugin
  window.pendoLauncher?.launch('test_visitor_')
}, 0)
