export const toHex = (x: Uint8Array) =>
  Array.from(x)
    .map((y) => Number(y).toString(16).padStart(2, '0'))
    .join('')

export class JSONWithRegex {
  regexCookie: string
  constructor(regexCookie = "") {
    this.regexCookie = regexCookie
  }
  parse(x: string): unknown {
    return JSON.parse(x, (_k, v) => {
      if (typeof v === 'string' && v.startsWith(this.regexCookie)) {
        const vRight = v.slice(this.regexCookie.length)
        const result = /^\/(.*)\/[a-z]*$/.exec(vRight)
        if (!result) {
          if (this.regexCookie.length > 0) {
            throw new Error(`matched regexCookie, but ${vRight} is not a regex`)
          }
          return v
        }
        return new RegExp(result[1], result[2])
      }
      return v
    })
  }
  stringify(x: unknown) {
    return JSON.stringify(x, (_k, v) => {
      if (v instanceof RegExp) {
        return `${this.regexCookie}${v.toString()}`
      }
      return v
    })
  }
}
