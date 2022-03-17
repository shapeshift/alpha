/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & typeof globalThis

export {}

const fetchFilterFactories = new WeakMap<
  Client,
  Array<{
    urlRegex: RegExp
    fetchFilterFactory: (req: Request) => Promise<{
      req: Request
      fetchFilter: (res: Response) => Promise<Response>
    }>
  }>
>()

self.addEventListener('install', (event) => {
  console.info('install', event)
  event.waitUntil(
    (async () => {
      console.info('skipWaiting')
      await self.skipWaiting()
      console.info('claim')
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  console.info('message', event)
})

self.addEventListener('fetch', (event) => {
  console.info('fetch', event)
  event.respondWith(
    (async () => {
      const client = (await self.clients.get(event.clientId))!
      const req = event.request
      for (const { urlRegex, fetchFilterFactory } of fetchFilterFactories.get(client) ?? []) {
        if (urlRegex.test(req.url)) {
          const { req: filteredReq, fetchFilter } = await fetchFilterFactory(req)
          const res = await fetch(filteredReq.url, filteredReq)
          return await fetchFilter(res)
        }
      }
      return await fetch(req.url, req)
      // const res = await fetch(req.url, {
      //   method: req.method,
      //   headers: req.headers,
      //   body: req.body,
      //   mode: req.mode,
      //   credentials: req.credentials,
      //   integrity: req.integrity,
      //   keepalive: req.keepalive,
      //   signal: req.signal
      // })
      // const res = await fetch(req.url, req)
      // const body = new Uint8Array(await res.arrayBuffer())
      // const out = new Response(body, {
      //   status: res.status,
      //   statusText: res.statusText,
      //   headers: res.headers
      // })
      // console.info(out)
      // return out
    })()
  )
})
