/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */

type UnderscoreLike = {
  each: (...args: any) => unknown
  keys: (...args: any) => (string | symbol)[]
  reduce: (...args: any) => unknown
  mixin: (methods: Record<string, (...args: any) => unknown>) => void
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
      throw new Error(`PendoDummyEnv: guides may not contain '${tagName}'`)
    case 'a':
      if (attributes.href && /^\s*javascript:/i.test(attributes.href)) {
        throw new Error(`PendoDummyEnv: guides may not contain 'javascript:' links`)
      }
      break
    default:
      return
  }
}

export function makePendoDummyEnv(filteredFetch: typeof fetch) {
  const state = {
    sawFirstCreateElementScript: false,
    _: undefined as UnderscoreLike | undefined,
    _each: undefined as ((...args: any) => unknown) | undefined,
    _eachRecursionLevel: 0,
    _reduce: undefined as ((...args: any) => unknown) | undefined,
    _keys: undefined as ((...args: any) => (string | symbol)[]) | undefined,
    _keysResults: new WeakMap(),
    lastAttributes: undefined as Record<string, string> | undefined,
    dom: undefined as ((...args: any) => unknown) | undefined
  }

  const underscoreMixins = {
    // The Pendo agent's string escaping function catches recursions deeper than
    // 200 and ignores escaping anything after that. It relies on _.each, which is
    // not used recursively elsewhere in the agent, so hard-failing after 150-deep
    // recursion will prevent the string escaping function from being bypassed.
    each(...args: any) {
      if (state._eachRecursionLevel >= 150) {
        throw new Error(`PendoDummyEnv: _.each() recursion too deep`)
      }
      state._eachRecursionLevel++
      const out = state._each!(...args)
      state._eachRecursionLevel--
      return out
    },
    // We need to "mark" the return values here so we can trigger a special case
    // in reduce().
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
    template(...args: unknown[]) {
      console.warn(`'PendoDummyEnv: tried to use pendo._.template()`, ...args)
      throw new Error('PendoDummyEnv: pendo._.template() is forbidden')
    }
  }

  const pendo: any = {
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
    get dom() {
      return function (...args: any) {
        if (state.lastAttributes) {
          const attributes = state.lastAttributes
          state.lastAttributes = undefined
          const execResult = /^<(.*)><\/\1>$/.exec(args[0] as string)
          if (!execResult) {
            throw new Error(
              `PendoDummyEnv: unable to extract tag name from pendo.dom() call. (This should not be possible.)`
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
    }
  }

  return {
    // Pendo will funnel most requests through here, which is named wrong for reasons.
    // This class implements only what the Pendo agent actually uses.
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
        filteredFetch(url, {
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
            console.warn(`PendoDummyEnv: fetch of ${url} failed`, e)
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
        filteredFetch(value, { mode: 'no-cors' }).then(
          () => this.onload?.(),
          () => this.onerror?.()
        )
      }
    },
    document: new Proxy(document, {
      set(target, p, value) {
        // Swallow writes to document.cookie to fix a Pendo bug where it tries to clear cookies even when they're disabled.
        if (p === 'cookie') return true
        return Reflect.set(target, p, value, target)
      },
      get(target, p) {
        if (p === 'createElement') {
          return (tagName: string) => {
            // The first document.createElement("script") call is used to sense if SRI is supported. Throw if it's not,
            // because otherwise Pendo swallows the error.
            if (tagName === 'script' && !state.sawFirstCreateElementScript) {
              state.sawFirstCreateElementScript = true
              if (!('integrity' in document.createElement('script')))
                throw new Error(`PendoDummyEnv: expected SRI support`)
              return { integrity: true }
            }
            // The Pendo agent should not be creating script tags or iframes. Any attempt to do so is a misconfiguration
            // or an attack. (It's possible we could relax the iframe criterion in the future by applying the sandbox
            // attribute automatically.)
            if (['script', 'iframe'].includes(tagName)) {
              throw new Error(`PendoDummyEnv: document.createElement('${tagName}') denied`)
            }
            return target.createElement(tagName)
          }
        }
        return Reflect.get(target, p, target)
      }
    }),
    navigator: new Proxy(navigator, {
      get(target, p) {
        if (typeof p === 'string' && ['sendBeacon'].includes(p)) return undefined
        return Reflect.get(target, p, target)
      }
    }),
    pendo,
    window: new Proxy(window, {
      get(target, p) {
        if (typeof p === 'string' && ['fetch', 'XMLHttpRequest'].includes(p)) return undefined
        if (p === 'pendo') return pendo
        return Reflect.get(target, p, target)
      }
    })
  }
}