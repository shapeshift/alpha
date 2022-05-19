import { PendoEnv } from './env'

export const expectedResponseKeys = [
  'autoOrdering',
  'designerEnabled',
  'features',
  'globalJsUrl',
  'guideCssUrl',
  'guideWidget',
  'guides',
  'lastGuideStepSeen',
  'normalizedUrl',
  'preventCodeInjection',
  'segmentFlags',
  'throttling',
  'props',
  'type',
  'children',
  'latestDismissedAutoAt'
]

function makeError(msg: string): Error {
  msg = `PendoFilters: ${msg}`
  console.error(msg)
  return new Error(msg)
}

export function filterGuideTag(
  this: PendoEnv,
  tagName: string,
  attributes: Record<string, string>
) {
  tagName = tagName.toLowerCase().trim()
  attributes = Object.fromEntries(
    Object.entries(attributes).map(([k, v]) => [k.toLowerCase().trim(), v])
  )
  switch (tagName) {
    case 'embed':
    case 'iframe':
    case 'script':
      throw makeError(`guides may not contain '${tagName}'`)
    case 'a':
      if (attributes.href && /^\s*javascript:/i.test(attributes.href)) {
        throw makeError(`guides may not contain 'javascript:' links`)
      }
      break
    default:
      return
  }
}

export function filterRequest(
  this: PendoEnv,
  url: URL,
  data: object | undefined,
  integrity: string | undefined
) {
  // This is excessively paranoid, but it limits the data leakage possible to a 1-byte
  // range of values. (Actual values are in the single digits.)
  const ctEpsilon = 128
  const dataHost = this.PendoConfig.dataHost
  const guideHosts = ((this.PendoConfig.allowedOriginServers as string[]) ?? []).map(
    (x) => new URL(x).host
  )

  if (url.protocol !== 'https:') {
    throw makeError(`fetch to non-https url not allowed`)
  }
  // This is all a bit overly restrictive, but it should ensure we fail fast if
  // any of the assumptions made are incorrect.
  if (dataHost && url.host === dataHost) {
    const [match, endpoint, apiKey] = /^\/data\/([^/]*)\/(.*)$/.exec(url.pathname) ?? []
    if (!match) throw makeError(`fetch from data.pendo.io does not match expected regex`)
    if (apiKey !== this.PendoConfig.apiKey) {
      throw makeError(`expected api key in url to match config (${apiKey})`)
    }
    // Verify no unexpected data in the URL parameters
    for (const [k, v] of url.searchParams.entries()) {
      switch (k) {
        case 'jzb':
          break
        case 'v':
          if (v !== this.pendo.VERSION) {
            throw makeError(
              `PendoEnv: attempted fetch with url parameter 'v' which does not match agent version`
            )
          }
          break
        case 'ct': {
          const ct = Number.parseInt(v)
          if (
            !Number.isSafeInteger(ct) ||
            ct.toString() !== v ||
            Math.abs(ct - Date.now()) > ctEpsilon
          ) {
            throw makeError(
              `PendoEnv: attempted fetch with url parameter 'ct' out of expected range: ${v}`
            )
          }
          break
        }
        default:
          throw makeError(`attempted fetch with unexpected url parameter '${k}' = '${v}'`)
      }
    }
    // Log the transmission
    const transmissions = (Array.isArray(data) ? data : [data]).map((x) => ({
      endpoint,
      ...x
    }))
    for (const transmission of transmissions) {
      this.transmissionLog.push(transmission)
    }
  } else if (guideHosts.includes(url.host)) {
    if (!/^\/guide-content\/.*\.dom\.json$/.test(url.pathname)) {
      throw makeError(
        `fetch from pendo-static-6047664892149760.storage.googleapis.com does not match expected regex`
      )
    }
    // Verify no unexpected data in the URL parameters
    let sawIntegrity = false
    for (const [k, v] of url.searchParams.entries()) {
      switch (k) {
        case 'sha256': {
          if (`sha256-${v}` !== integrity) {
            throw makeError(`expected integrity url parameter to match request's integrity value`)
          }
          sawIntegrity = true
          break
        }
        default:
          throw makeError(`attempted fetch with unexpected url parameter '${k}' = '${v}'`)
      }
    }
    if (!sawIntegrity) {
      throw makeError(`expected integrity url parameter on request`)
    }
  } else {
    throw makeError(`agent tried to fetch an unrecognized url (${url})`)
  }
}

export async function filterResponse(
  this: PendoEnv,
  url: URL,
  data: object | undefined,
  response: Response
): Promise<Response> {
  if (response.status < 200 || response.status >= 300) return Response.error()
  if (!response.body || response.headers.get('Content-Type') === 'image/gif') {
    return new Response(null, { status: 200 })
  }
  const resBuf = await response.arrayBuffer()
  const resObj = (() => {
    try {
      return JSON.parse(new TextDecoder().decode(resBuf))
    } catch {
      return undefined
    }
  })()
  if (resObj === undefined) {
    makeError(`expected fetch response to be JSON, but it wasn't: ${resBuf}`)
    return Response.error()
  }
  if (Array.isArray(resObj)) {
    makeError(`fetch response is an array, not an object: ${JSON.stringify(resObj, undefined, 2)}`)
    return Response.error()
  }
  // The pendo agent just assigns any returned object's keys to the global window.pendo
  // object, so we need to make sure a malicious server can't bust anything that way.
  // This method is super janky, but good enough, and will fail fast.
  const unexpectedKeys = Object.keys(resObj).filter((x) => !expectedResponseKeys.includes(x))
  if (unexpectedKeys.length > 0) {
    console.warn(
      `PendoFilters: fetch response has unexpected keys: ${JSON.stringify(
        unexpectedKeys,
        undefined,
        2
      )}`
    )
    if (!unexpectedKeys.every((x) => !(x in this.pendo))) {
      throw makeError(`unexpected key in fetch response would clobber an existing value`)
    }
  }
  // Override preventCodeInjection to true in case the server feels like trying
  // to unset it
  if ('guides' in resObj || 'preventCodeInjection' in resObj) {
    if (resObj.preventCodeInjection !== true) {
      console.warn(
        `PendoEnv: Expected preventCodeInjection to be set on a guide, but it wasn't. It's been set anyway.`
      )
    }
    resObj.preventCodeInjection = true
  }
  // The agent doesn't use headers or statusText, so we can ignore them
  return new Response(JSON.stringify(resObj), {
    status: response.status
  })
}
