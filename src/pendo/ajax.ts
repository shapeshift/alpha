import type { PendoEnv } from './env'
import { filterRequest, filterResponse } from './filters'

function makeError(msg: string): Error {
  msg = `PendoAjax: ${msg}`
  console.error(msg)
  return new Error(msg)
}

function getTransmissionData(this: PendoEnv, url: URL, body: BodyInit | undefined) {
  const jzb = url.searchParams.get('jzb')
  if (jzb !== null) {
    if (body) {
      throw makeError(`agent tried to send both jzb and post data at once`)
    }
    const out = this.compressMap.get(jzb)
    if (!out) {
      throw makeError(`agent tried to send jzb data missing from the compressMap`)
    }
    return out
  }
  if (body) {
    if (typeof body !== 'string') {
      throw makeError(`agent sent non-string post data (${body})`)
    }
    return JSON.parse(body)
  }
}

async function filteredFetch(this: PendoEnv, url: string, init?: RequestInit): Promise<Response> {
  const urlObj = new URL(url)
  const dataObj = getTransmissionData.call(this, urlObj, init?.body ?? undefined)

  // Don't report agent errors because we probably caused them ourselves.
  if (dataObj?.error) {
    console.error(`PendoEnv: suppressed error report from agent`, dataObj.error)
    return Promise.resolve(new Response(null, { status: 200 }))
  }

  // Throw if fetch isn't allowed.
  try {
    filterRequest.call(this, urlObj, dataObj, init?.integrity)
  } catch (e) {
    if (this.sealed) throw e
    console.warn(
      `PendoEnv: fetch failed filtering, but proceeding because environment is unsealed`,
      e
    )
  }

  const res = await fetch(url, init)
  try {
    return filterResponse.call(this, urlObj, dataObj, res.clone())
  } catch (e) {
    if (this.sealed) throw e
    console.warn(
      `PendoEnv: fetch response failed filtering, but proceeding because environment is unsealed`,
      e
    )
    return res
  }
}

/** This adapts the pendo.ajax() interface into a standard fetch() call. */
export async function filteredAjax(
  this: PendoEnv,
  params: {
    url: string
    method?: string
    data?: string
    headers?: Record<string, string>
    withCredentials?: boolean
  }
): Promise<{ status: number; data?: string }> {
  try {
    const integrity = new URL(params.url).searchParams.get('sha256')
    const res = await filteredFetch.call(this, params.url, {
      method: params.method || 'GET',
      body: params.data || undefined,
      headers: new Headers(params.headers),
      credentials: params.withCredentials ? 'same-origin' : 'omit',
      integrity: integrity ? `sha256-${integrity}` : undefined
    })
    const rawData = res.body ? await res.text() : undefined
    const data =
      rawData !== undefined
        ? (() => {
            try {
              return JSON.parse(rawData)
            } catch {
              return rawData
            }
          })()
        : undefined
    return {
      status: res.status,
      data
    }
  } catch (e) {
    makeError(`fetch error: ${e}`)
    return Response.error()
  }
}
