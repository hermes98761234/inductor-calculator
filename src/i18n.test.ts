import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UK, tr } from './i18n'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts') && e.name !== 'i18n.ts' && e.name !== 'cores.ts' && e.name !== 'awg.ts' ? [join(dir, e.name)] : [],
  )
}

describe('i18n', () => {
  const text = sources(__dirname.replace(/\\/g, '/')).map((f) => readFileSync(f, 'utf8')).join('\n')
  const used = new Set<string>()
  for (const m of text.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) used.add(m[1].replace(/\\'/g, "'"))
  for (const m of text.matchAll(/\b(?:label|name|msg): '((?:[^'\\]|\\.)*)'/g)) used.add(m[1].replace(/\\'/g, "'"))

  it('finds the strings it should', () => {
    expect(used.size).toBeGreaterThan(50)
  })
  it('translates every UI string', () => {
    const missing = [...used].filter((s) => !(s in UK) && /[A-Za-z]{3}/.test(s))
    expect(missing).toEqual([])
  })
  it('keeps placeholders identical', () => {
    for (const [en, uk] of Object.entries(UK)) {
      const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join()
      expect(ph(uk), en).toBe(ph(en))
    }
  })
  it('interpolates', () => {
    expect(tr('en', 'a {0} b {1}', 1, 'x')).toBe('a 1 b x')
    expect(tr('uk', '{0} turns per layer', 3)).toBe('3 витків у шарі')
    expect(tr('uk', 'unknown string')).toBe('unknown string')
  })
})
