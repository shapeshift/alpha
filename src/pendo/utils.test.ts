import { randomBytes } from 'crypto'

import { applyFixups, JSONWithRegex, toHex, toIntegrity } from './utils'

describe('toHex', () => {
  it('works', async () => {
    expect(toHex(Buffer.from('deadbeef', 'hex'))).toBe(`deadbeef`)
    for (let i = 0; i < 1024; i++) {
      const rand = randomBytes(16)
      expect(toHex(rand)).toBe(rand.toString('hex'))
    }
  })
})

describe('toIntegrity', () => {
  it('works with a string', async () => {
    expect(await toIntegrity('deadbeef')).toMatchInlineSnapshot(
      `"sha256-K68fQBBdlQH+MZqOxGP99DJaKl30Ra3z9XL2JiU2eMk="`
    )
  })
  it('works with an ArrayBuffer', async () => {
    expect(
      await toIntegrity(new Uint8Array([0x64, 0x65, 0x61, 0x64, 0x62, 0x65, 0x65, 0x66]).buffer)
    ).toMatchInlineSnapshot(`"sha256-K68fQBBdlQH+MZqOxGP99DJaKl30Ra3z9XL2JiU2eMk="`)
  })
  it('works with an Uint8Array', async () => {
    expect(
      await toIntegrity(new Uint8Array([0x64, 0x65, 0x61, 0x64, 0x62, 0x65, 0x65, 0x66]))
    ).toMatchInlineSnapshot(`"sha256-K68fQBBdlQH+MZqOxGP99DJaKl30Ra3z9XL2JiU2eMk="`)
  })
  it('works with a Buffer', async () => {
    expect(await toIntegrity(Buffer.from('6465616462656566', 'hex'))).toMatchInlineSnapshot(
      `"sha256-K68fQBBdlQH+MZqOxGP99DJaKl30Ra3z9XL2JiU2eMk="`
    )
  })
})

describe('JSONWithRegex', () => {
  it('works', async () => {
    const regexCookie = 'deadbeef'
    const jsonWithRegex = new JSONWithRegex(regexCookie)
    const serialized = jsonWithRegex.stringify({
      foo: 'bar',
      // eslint-disable-next-line no-useless-escape
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

describe('applyFixups', () => {
  it('works with a fixup in the middle', async () => {
    const src = 'foobaz'
    const fixups = { 3: 'bar' }
    expect(applyFixups(src, fixups)).toMatchInlineSnapshot(`"foobarbaz"`)
  })
  it('works with a fixup at the beginning', async () => {
    const src = 'barbaz'
    const fixups = { 0: 'foo' }
    expect(applyFixups(src, fixups)).toMatchInlineSnapshot(`"foobarbaz"`)
  })
  it('works with a fixup at the end', async () => {
    const src = 'foobar'
    const fixups = { 6: 'baz' }
    expect(applyFixups(src, fixups)).toMatchInlineSnapshot(`"foobarbaz"`)
  })
  it('works with multiple fixups', async () => {
    const src = 'bar'
    const fixups = { 0: 'foo', 3: 'baz' }
    expect(applyFixups(src, fixups)).toMatchInlineSnapshot(`"foobarbaz"`)
  })
  it('fails with out-of-range fixups', async () => {
    const src = 'bar'
    const fixups = { 0: 'foo', 4: 'baz' }
    expect(() => applyFixups(src, fixups)).toThrowErrorMatchingInlineSnapshot(
      `"applyFixups: fixup index 4 exceeds length of source string (3)"`
    )
  })
})
