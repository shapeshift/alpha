import { filteredAjax } from './ajax'
import { PendoEnv } from './env'
import { filterGuideTag } from './filters'

function makeError(msg: string): Error {
  msg = `PendoFixups: ${msg}`
  console.error(msg)
  return new Error(msg)
}

export type FixupTable = {
  fixups: Record<number, string>
  makeFixupHelpers(env: PendoEnv): Record<string, unknown>
}

export const fixupTables: Record<string, FixupTable> = {
  // Integrity value for the contents of the IIFE in v2.117.0_prod, no trailing newline
  'sha256-CIe1ebNh5QUBxPYMVZwwj7mnJnalruqUj6Wt7JSg3oM=': {
    fixups: {
      // Fixes a "SameSite" error where the agent attempts to write to document.cookie in order to clear cookies, even when cookies are disabled
      21400: '{document:{}}.',
      // Throws in a string escaping function which would otherwise stop escaping after recursion depth >= 200
      170827: 'pendoFixupHelpers.recursionDepth(),',
      // Throws if _.template() is used
      133301: 'pendoFixupHelpers.template();',
      // Throws when the agent tries to inject a script or iframe tag
      218098: 'pendoFixupHelpers.attemptedCodeInjection();',
      79894: 'pendoFixupHelpers.attemptedCodeInjection();',
      429345: 'pendoFixupHelpers.attemptedCodeInjection();',
      19494: 'pendoFixupHelpers.attemptedCodeInjection();',
      1397: 'pendoFixupHelpers.attemptedCodeInjection();',
      // Don't disable SRI validation if the sniffer says the browser doesn't support it
      211752: 'true||',
      // Force use of pendo.ajax() for all fetches
      25119: 'false&&',
      25635: 'return pendo.ajax.get(e).then(function(){},function(){});',
      31143: 'false&&',
      31852: 'false&&',
      31999: 'true||',
      32206: 'false&&',
      32441: 'false&&',
      32562: 'true||',
      219353: 'return;',
      // Use filteredFetch for pendo.ajax().
      188619: `return n(pendoFixupHelpers.filteredAjax(t));`,
      // Use custom localStorage / sessionStorage implementations
      162288: 'return pendoFixupHelpers.localStorage;',
      162366: 'return pendoFixupHelpers.sessionStorage;',
      73870: 'pendoFixupHelpers.',
      188179: '.pendoFixupHelpers',
      425057: 'pendoFixupHelpers.',
      425114: 'pendoFixupHelpers.',
      187269: 'const localStorage=pendoFixupHelpers.localStorage;',
      // 187446: 'pendoFixupHelpers.',
      // 187765: 'pendoFixupHelpers.',
      // 188086: 'pendoFixupHelpers.',
      // Filter allowed guide elements and attributes to prevent code injection
      385198: 'if(!pendoFixupHelpers.filterGuideTag(e,t,n,i)){return false;}',
      // Remember compressed objects so the fetch filters can decode them
      171217: 'pendoFixupHelpers.compress(e,r);',
      // Force logging
      // 207591: 'return true;',
      // Never try to load staging agent (it's identical)
      1114: 'return false;',
      // Unconditionally disable openXhrIntercept, which spies on all outgoing fetches.
      // This feature is also disabled by setting xhrTimings to false, but it's scary
      // so kill it with fire.
      225821: 'pendoFixupHelpers.openXhrIntercept();',
      // Export a couple of extra things for easier debugging.
      432605: 'pendo.ConfigReader=ConfigReader;pendo.GuideLoader=GuideLoader;',
      // Use cookieStorage instead of actual cookies
      186406: 'return pendoFixupHelpers.cookieStorage.getItem(e);',
      186634: 'return pendoFixupHelpers.cookieStorage.setItem(e,t);',
      21349: 'return pendoFixupHelpers.cookieStorage.removeItem(e);'
    },
    makeFixupHelpers: (env: PendoEnv) =>
      Object.freeze({
        stringEscapeRecursionDepth() {
          if (env.sealed) throw makeError('string escape recursion depth exceeded')
        },
        template() {
          if (env.sealed) throw makeError('_.template() is forbidden')
        },
        attemptedCodeInjection() {
          if (env.sealed) throw makeError('attempted code injection blocked')
        },
        openXhrIntercept() {
          if (env.sealed) throw makeError('openXHRIntercept blocked')
        },
        compress(obj: object, compressed: string) {
          env.compressMap.set(compressed, obj)
          setTimeout(() => env.compressMap.delete(compressed), 0)
        },
        cookieStorage: env.cookieStorageWrapper,
        localStorage: env.localStorageWrapper,
        sessionStorage: env.sessionStorageWrapper,
        filterGuideTag(attributes: Record<string, string>, tagName: string): boolean {
          if (env.sealed) filterGuideTag.call(env, tagName, attributes)
          return true
        },
        filteredAjax: filteredAjax.bind(env)
      })
  }
}
