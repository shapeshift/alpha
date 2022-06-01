export function sanitizeUrl(x: string): string {
  try {
    const url = new URL(x)
    if (url.origin !== window.location.origin) {
      url.pathname = url.pathname.replace(/(?<=^|\/)[^/]{20,}(?=\/|$)/g, '***')
      url.hash = ''
    } else {
      url.hash = url.hash.replace(
        /(\/accounts\/[-a-z0-9]{3,8}:[-a-zA-Z0-9]{1,32}):[^/]*(\/.*)?$/i,
        '$1:***$2'
      )
    }
    console.debug('PendoConfig: sanitizeUrl', x, url.toString())
    return url.toString()
  } catch (e) {
    console.error('PendoConfig: sanitizeUrl', x, e)
    return ''
  }
}
