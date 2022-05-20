const MAX_LOG_LENGTH = 1024

export type Transmissions = {
  log: Record<string, unknown>[]
} & Pick<MessagePort, 'addEventListener' | 'removeEventListener' | 'postMessage'>

export function createTransmissions(): Transmissions {
  const { port1, port2 } = new MessageChannel()
  port1.start()

  const out: Transmissions = {
    log: [],
    addEventListener(...args: Parameters<typeof port1['addEventListener']>) {
      return port1.addEventListener(...args)
    },
    removeEventListener(...args: Parameters<typeof port1['removeEventListener']>) {
      return port1.removeEventListener(...args)
    },
    postMessage(message: Record<string, unknown>) {
      return port2.postMessage(message)
    }
  }

  out.addEventListener('messageerror', (e) => {
    console.error(`PendoTransmissions: messageerror`, e)
  })
  out.addEventListener('message', (e) => {
    if (!e || typeof e !== 'object') {
      console.error(`PendoTransmissions: expected message to be an object`)
      return
    }
    out.log.push(e.data)
    while (out.log.length > MAX_LOG_LENGTH) out.log.shift()
  })

  return out
}
