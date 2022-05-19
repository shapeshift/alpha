/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */

type UnderscoreLike = {
  each: (...args: any) => unknown
  keys: (...args: any) => (string | symbol)[]
  reduce: (...args: any) => unknown
  mixin: (methods: Record<string, (...args: any) => unknown>) => void
}

function makeError(msg: string): Error {
  msg = `PendoEnv: ${msg}`
  console.error(msg)
  return new Error(msg)
}

function filterGuideTag(tagName: string, attributes: Record<string, string>) {
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

function getTransmissionData(
  url: URL,
  body: BodyInit | undefined,
  compressMap: Map<string, string>
) {
  if (url.searchParams.has('jzb')) {
    if (body) {
      throw makeError(`agent tried to send both jzb and post data at once`)
    }
    const jzbObj = compressMap.get(url.searchParams.get('jzb')!)
    if (!jzbObj) {
      throw makeError(`agent tried to send jzb data missing from the compressMap`)
    }
    console.info('PendoEnv: agent sent jzb data', jzbObj)
    return jzbObj
  }
  if (body) {
    if (typeof body !== 'string') {
      throw makeError(`agent sent non-string post data (${body})`)
    }
    const postObj = JSON.parse(body)
    console.info('PendoEnv: agent sent post data', postObj)
    return postObj
  }
}

function isTransmissionAllowed(
  url: URL,
  data: object | undefined,
  integrity: string | undefined,
  params: {
    apiKey: string
    VERSION: string
    transmissionLog: Array<{ endpoint: string } & Record<string, unknown>>
    pendoOptions: Record<string, unknown>
  }
) {
  // This is excessively paranoid, but it limits the data leakage possible to a 1-byte
  // range of values. (Actual values are 0-1.)
  const ctEpsilon = 128
  const dataHost = params.pendoOptions.dataHost
  const guideHosts = ((params.pendoOptions.allowedOriginServers as string[]) ?? []).map(
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
    if (apiKey !== params.apiKey) {
      throw makeError(`expected api key in url to match config (${apiKey})`)
    }
    // Verify no unexpected data in the URL parameters
    for (const [k, v] of url.searchParams.entries()) {
      switch (k) {
        case 'jzb':
          break
        case 'v':
          if (v !== params.VERSION) {
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
          console.debug(`PendoEnv: ct diff`, Math.abs(ct - Date.now()))
          break
        }
        default:
          throw makeError(`attempted fetch with unexpected url parameter '${k}' = '${v}'`)
      }
    }
    // Log the transmission
    params.transmissionLog.push(
      ...(Array.isArray(data) ? data : [data]).map((x) => ({
        endpoint,
        ...x
      }))
    )
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

async function filterResponse(
  url: URL,
  data: object | undefined,
  response: Response
): Promise<Response> {
  if (response.status < 200 || response.status >= 300) return Response.error()
  if (!response.body) return new Response(null, { status: 200 })
  const resObj = await response.json()
  if (Array.isArray(resObj)) {
    makeError(`fetch response is an array, not an object: ${JSON.stringify(resObj, undefined, 2)}`)
    return Response.error()
  }
  const unexpectedKeys = Object.keys(resObj).filter(
    (x) =>
      ![
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
        'throttling'
      ].includes(x)
  )
  if (unexpectedKeys.length > 0) {
    makeError(`fetch response has unexpected keys: ${JSON.stringify(unexpectedKeys, undefined, 2)}`)
    return Response.error()
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

export function makePendoEnv(pendoOptions: Record<string, unknown>) {
  // While the state object has a variety of values that start out as undefined,
  // they are usually set during parsing of the agent script and guaranteed to
  // be defined by the point they are needed. We represent this by using the
  // correct types here, but also using non-null assertions liberally.
  const state = {
    sawFirstCreateElementScript: false,
    sawFirstWindowLocation: false,
    _: undefined as UnderscoreLike | undefined,
    _each: undefined as ((...args: any) => unknown) | undefined,
    _eachRecursionLevel: 0,
    _reduce: undefined as ((...args: any) => unknown) | undefined,
    _keys: undefined as ((...args: any) => (string | symbol)[]) | undefined,
    _keysResults: new WeakMap(),
    lastAttributes: undefined as Record<string, string> | undefined,
    dom: undefined as ((...args: any) => unknown) | undefined,
    compress: undefined as ((obj: object) => string) | undefined,
    compressMap: new Map(),
    apiKey: undefined as string | undefined,
    VERSION: undefined as string | undefined
  }

  const transmissionLog: Array<{ endpoint: string } & Record<string, unknown>> = []

  function fetchAndLog(url: string, init?: RequestInit): Promise<Response> {
    const urlObj = new URL(url)
    const dataObj = getTransmissionData(urlObj, init?.body ?? undefined, state.compressMap)

    // Don't report agent errors because we probably caused them ourselves.
    if (dataObj?.error) {
      console.error(`PendoEnv: suppressed error report from agent`, dataObj.error)
      return Promise.resolve(new Response(null, { status: 200 }))
    }

    // Throw if fetch isn't allowed.
    isTransmissionAllowed(urlObj, dataObj, init?.integrity, {
      apiKey: state.apiKey!,
      VERSION: state.VERSION!,
      transmissionLog: transmissionLog,
      pendoOptions
    })

    return fetch(url, init)
      .then((res) => filterResponse(urlObj, dataObj, res))
      .catch((e) => {
        throw makeError(`fetch error: ${e}`)
      })
  }

  const underscoreMixins = {
    // The Pendo agent's string escaping function catches recursions deeper than
    // 200 and ignores escaping anything after that. It relies on _.each, which is
    // not used recursively elsewhere in the agent, so hard-failing after 150-deep
    // recursion will prevent the string escaping function from being bypassed.
    each(...args: any) {
      if (state._eachRecursionLevel >= 150) {
        throw makeError(`_.each() recursion too deep`)
      }
      state._eachRecursionLevel++
      const out = state._each!(...args)
      state._eachRecursionLevel--
      return out
    },
    // We need to remember the return values here so we can trigger a special case
    // in _.reduce(). Use of a WeakSet means we don't have to bother with cleanup.
    keys(obj: unknown) {
      const out = state._keys!(obj)
      state._keysResults.set(out, obj)
      return out
    },
    // The only case where the Pendo agent calls _.reduce() directly over the
    // return value of _.keys() is in its getAllowedAttributes() function, which
    // is in charge of sanitizing the guide elements that are allowed to be
    // rendered. The logic for filtering elements is not written with the
    // preventCodeInjection flag in mind, and allows all sorts of stuff that can
    // take over the page. We need to add checks, so we detect the _.reduce(_.keys())
    // pattern and apply custom logic to it.
    reduce(obj: object, iteratee: unknown, memo: unknown, context: unknown) {
      // This will only have a value while running getAllowedAttributes(). Unfortunately,
      // at this point we don't have the most crucial bit of info needed to do the
      // filtering -- the name of the tag name itself. Luckily, pendo.dom() will
      // always be called immediately afterwards unless the reducer throws, and it
      // gets the tag name.
      state.lastAttributes = state._keysResults.get(obj)
      try {
        return state._reduce!(obj, iteratee, memo, context)
      } catch (e) {
        // pendo.dom() won't be called if reduce() throws, so clean up the state now.
        state.lastAttributes = undefined
        throw e
      }
    },
    // _.template() runs arbitrary code embedded in the template in the global
    // environment using new Function(), which could do almost anything.
    template(...args: unknown[]) {
      console.warn(`'PendoEnv: tried to use pendo._.template()`, ...args)
      throw makeError('PendoEnv: pendo._.template() is forbidden')
    }
  }

  const pendo: any = {
    // This is the standard agent stub usually set up by the snippet.
    _q: [],
    initialize(...args: any[]) {
      pendo._q.unshift(['initialize', ...args])
    },
    identify(...args: any[]) {
      pendo._q.push(['identify', ...args])
    },
    updateOptions(...args: any[]) {
      pendo._q.push(['updateOptions', ...args])
    },
    pageLoad(...args: any[]) {
      pendo._q.push(['pageLoad', ...args])
    },
    track(...args: any[]) {
      pendo._q.push(['track', ...args])
    },
    // We need to apply mixins to the agent's underscore.js library before the agent
    // can start using it, so we use a hook in the setter.
    get _() {
      return state._!
    },
    set _(value: UnderscoreLike) {
      state._ = value
      state._each = value.each
      state._keys = value.keys
      state._reduce = value.reduce
      value.mixin(underscoreMixins)
    },
    // pendo.dom() is called with the tag name immediately after the _.each(_.keys())
    // pattern we're using to capture guide tag attributes.
    get dom() {
      return function (...args: any) {
        if (state.lastAttributes) {
          const attributes = state.lastAttributes
          state.lastAttributes = undefined
          const execResult = /^<(.*)><\/\1>$/.exec(args[0] as string)
          if (!execResult) {
            throw makeError(
              `PendoEnv: unable to extract tag name from pendo.dom() call. (This should not be possible.)`
            )
          }
          const tagName = execResult[1]
          filterGuideTag(tagName, attributes)
        }
        return Function.prototype.apply.call(state.dom!, pendo, args)
      }
    },
    set dom(value) {
      state.dom = value
    },
    // The compress() function will sometimes be called repeatedly to try to get
    // a payload that's below a certain length. That means not every return value
    // will actually be sent to the server, so we can't log transmissions here.
    // However, any fetch using compressed data as a payload will be kicked off
    // synchronously, so we can memoize the result and clear it on the next run
    // of the event loop.
    get compress() {
      return (obj: object) => {
        const out = state.compress!(obj)
        state.compressMap.set(out, obj)
        setTimeout(() => state.compressMap.delete(out), 0)
        return out
      }
    },
    set compress(value) {
      state.compress = value
    },
    // We could probably get away without storing VERSION and apiKey in state,
    // but then there's an order-of-declaration issue with them being used in
    // fetchAndLog, and this is just easier.
    get VERSION() {
      return state.VERSION
    },
    set VERSION(value) {
      if (state.VERSION && state.VERSION !== value) {
        throw makeError(`only expected VERSION to be set once`)
      }
      state.VERSION = value
    },
    get apiKey() {
      return state.apiKey
    },
    set apiKey(value) {
      if (state.apiKey && state.apiKey !== value) {
        throw makeError(`only expected apiKey to be set once`)
      }
      state.apiKey = value
    }
  }

  return {
    // Pendo will funnel most requests through here, which is named wrong for reasons.
    // This class implements only the bare minimum of what the agent actually uses.
    ActiveXObject: class XMLHttpRequest {
      _headers = new Headers()
      _url = ''
      _method = ''
      withCredentials = false
      status = 0
      readyState = 0
      responseText = ''
      onreadystatechange: (() => void) | undefined
      open(method: string, url: string) {
        this._method = method
        this._url = url
      }
      setRequestHeader(name: string, value: string) {
        this._headers.append(name, value)
      }
      send(data?: BodyInit) {
        const url = this._url
        fetchAndLog(url, {
          method: this._method,
          headers: this._headers,
          credentials: this.withCredentials ? 'include' : 'same-origin',
          body: data
        })
          .then(async (res: Response) => {
            this.status = res.status
            this.responseText = await res.text()
            this.readyState = 4
          })
          .catch((e) => {
            console.warn(`PendoEnv: fetch of ${url} failed`, e)
            this.status = 0
            this.responseText = String(e)
            this.readyState = 4
          })
          .finally(() => this.onreadystatechange?.())
      }
    },
    // Short requests or errors will come through here.
    Image: class Image {
      onload: (() => void) | undefined
      onerror: (() => void) | undefined
      set src(value: string) {
        fetchAndLog(value, { mode: 'no-cors' }).then(
          () => this.onload?.(),
          () => this.onerror?.()
        )
      }
    },
    document: new Proxy(document, {
      get(target, p) {
        if (p === 'createElement') {
          return (tagName: string) => {
            // The first document.createElement("script") call is used to sense if SRI is supported. Throw if it's not,
            // because otherwise Pendo swallows the error and disables SRI.
            if (tagName === 'script' && !state.sawFirstCreateElementScript) {
              state.sawFirstCreateElementScript = true
              if (!('integrity' in document.createElement('script')))
                throw makeError(`expected SRI support`)
              return { integrity: true }
            }
            // The Pendo agent should not be creating script tags or iframes. Any attempt to do so is a misconfiguration
            // or an attack. (It's possible we could relax the iframe criterion in the future by applying the sandbox
            // attribute automatically.)
            if (['script', 'iframe'].includes(tagName)) {
              throw makeError(`document.createElement('${tagName}') denied`)
            }
            return target.createElement(tagName)
          }
        }
        const out = Reflect.get(target, p, target)
        // All function calls the agent throw 'TypeError: invalid invocation' if
        // called with the wrong `this` value.
        return typeof out === 'function' ? out.bind(target) : out
      }
    }),
    // The only thing the agent actually uses here is navigator.userAgent. We
    // to explicitly remove navigator.sendBeacon(), but this is simpler.
    navigator: {
      userAgent: navigator.userAgent
    },
    pendo,
    // The agent doesn't use this, but it makes the log relatively easy to find
    // as window.pendoEnv.transmissionLog.
    transmissionLog,
    window: new Proxy(window, {
      get(target, p) {
        // We undefine window.fetch and window.XMLHttpRequest to force the agent
        // into using the ActiveXObject implementation above.
        if (typeof p === 'string' && ['fetch', 'XMLHttpRequest'].includes(p)) return undefined
        // We need to return the same object for pendo and window.pendo.
        if (p === 'pendo') return pendo
        // The first window.location call is used to determine if this is a staging
        // server. We force this check to fail because the agent will otherwise try
        // to load a staging version of itself, which is identical except for a
        // couple configuration options that don't matter. If we let it try, it
        // will fail because we don't let the agent inject script tags.
        if (p === 'location' && !state.sawFirstWindowLocation) {
          state.sawFirstWindowLocation = true
          return { host: '' }
        }
        // Because this is the global variable, we have to be very careful about what
        // we bind -- constructors, for example, will make broken objects if done in
        // this naive manner. We should only bind functions the agent uses and which
        // throw 'TypeError: illegal invocation' if called with the wrong `this` value.
        const out = Reflect.get(target, p, target)
        return typeof out === 'function' &&
          typeof p === 'string' &&
          [
            'addEventListener',
            'removeEventListener',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval'
          ].includes(p)
          ? out.bind(target)
          : out
      }
    })
  }
}
