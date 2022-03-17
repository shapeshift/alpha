import { toHex, JSONWithRegex } from './utils'
import { randomBytes } from 'crypto'

describe('toHex', () => {
  it('works', async () => {
    expect(toHex(Buffer.from('deadbeef', 'hex'))).toBe(`deadbeef`)
    for (let i = 0; i < 1024; i++) {
      const rand = randomBytes(16)
      expect(toHex(rand)).toBe(rand.toString('hex'))
    }
  })
})

describe('JSONWithRegex', () => {
  it('works', async () => {
    const regexCookie = 'deadbeef'
    const jsonWithRegex = new JSONWithRegex(regexCookie)
    const serialized = jsonWithRegex.stringify({
      foo: 'bar',
      bar: /^\\\/b\az$/gi
    })
    expect(serialized).toMatchInlineSnapshot(
      `"{\\"foo\\":\\"bar\\",\\"bar\\":\\"deadbeef/^\\\\\\\\\\\\\\\\\\\\\\\\/b\\\\\\\\az$/gi\\"}"`
    )
    expect(JSON.parse(serialized)).toMatchInlineSnapshot(`
      Object {
        "bar": "deadbeef/^\\\\\\\\\\\\/b\\\\az$/gi",
        "foo": "bar",
      }
    `)
    expect(jsonWithRegex.parse(serialized)).toMatchInlineSnapshot(`
      Object {
        "bar": /\\^\\\\\\\\\\\\/b\\\\az\\$/,
        "foo": "bar",
      }
    `)

    expect(() =>
      new JSONWithRegex('foo').parse('{"bar":"foobar"}')
    ).toThrowErrorMatchingInlineSnapshot(`"matched regexCookie, but bar is not a regex"`)

    expect(new JSONWithRegex().parse('{"bar":"/baz/"}')).toMatchInlineSnapshot(`
      Object {
        "bar": /baz/,
      }
    `)

    expect(new JSONWithRegex().parse('{"bar":"foobar"}')).toMatchInlineSnapshot(`
      Object {
        "bar": "foobar",
      }
    `)
  })
})
