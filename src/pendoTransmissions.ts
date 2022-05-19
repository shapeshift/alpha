const MAX_LOG_LENGTH = 1024

export type Transmissions = MessagePort & { log: Record<string, unknown>[] }

export function createTransmissions(): Transmissions {
  const { port1, port2 } = new MessageChannel()
  const log: Record<string, unknown>[] = []
  port1.addEventListener('messageerror', (e) => {
    console.error(`PendoTransmissions: messageerror`, e)
  })
  port1.addEventListener('message', (e) => {
    if (!e || typeof e !== 'object') {
      console.error(`PendoTransmissions: expected message to be an object`)
      return
    }
    log.push(e.data)
    while (log.length > MAX_LOG_LENGTH) log.shift()
  })
  return Object.assign(Object.create(port1), {
    log,
    postMessage(...args: Parameters<typeof port2['postMessage']>) {
      return port2.postMessage(...args)
    }
  })
}
