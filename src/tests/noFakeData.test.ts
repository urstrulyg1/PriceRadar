/**
 * Guard tests — ZERO fake production data.
 *
 * These tests fail the build if fabricated shopping data can reach production:
 *   1. No static product catalog exists in production code.
 *   2. Production sources contain no fabrication vocabulary (test-only
 *      fixtures live under src/tests and are never imported by production).
 *   3. No production module imports test fixtures or test helpers.
 *   4. No bare literal product prices in production constants.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs with the project root as cwd
const ROOT = process.cwd()

/** Production application code — everything that ships to users. */
function productionFiles(): string[] {
  const dirs = [join(ROOT, 'src/domain'), join(ROOT, 'src/services')]
  const files = [
    join(ROOT, 'src/App.tsx'),
    join(ROOT, 'src/main.tsx'),
    ...dirs.flatMap((d) => listFiles(d, ['.ts', '.tsx'])),
  ]
  return files.filter((f) => existsSync(f))
}

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, exts))
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

// Words that indicate fabricated data. `placeholder` is allowed only as the
// standard HTML input attribute / CSS pseudo-element, never as data.
const BANNED = [
  'mockdata', 'mockproduct', 'mockprice', 'mockoffer',
  'dummydata', 'dummyprice', 'fakeprice', 'fakeoffer', 'fakedata',
  'sampledata', 'sampleprice', 'sampleproduct',
  'staticproducts', 'staticprices', 'hardcodedprice',
]

function stripLegitPlaceholder(source: string): string {
  return source
    .replace(/placeholder\s*[:=]/g, '')      // JSX attribute / object key
    .replace(/::placeholder/g, '')            // CSS pseudo-element
    .replace(/['"`]placeholder['"`]/g, '')    // string references to the attribute
}

describe('no fake data can reach production', () => {
  it('the static catalog module is gone', () => {
    expect(existsSync(join(ROOT, 'src/data/catalog.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/data/catalog.tsx'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/data/products.json'))).toBe(false)
  })

  it('production sources contain no fabrication vocabulary', () => {
    const files = productionFiles()
    expect(files.length).toBeGreaterThan(8)
    for (const file of files) {
      const source = stripLegitPlaceholder(readFileSync(file, 'utf8'))
      const lower = source.toLowerCase()
      for (const word of BANNED) {
        expect(lower.includes(word), `${relative(ROOT, file)} contains banned token “${word}”`).toBe(false)
      }
      expect(lower, `${relative(ROOT, file)} mentions demo fixtures`).not.toMatch(/\b(demo|dummy)\b/)
      expect(lower, `${relative(ROOT, file)} mentions mock data`).not.toMatch(/\bmock(s|ed|ery)?\b/)
      expect(lower, `${relative(ROOT, file)} mentions fake data`).not.toMatch(/\bfake(s|d)?\b/)
    }
  })

  it('no production module imports test fixtures or test setup', () => {
    for (const file of productionFiles()) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${relative(ROOT, file)} imports test fixtures`).not.toMatch(/tests\/fixtures|fixtures\/records|tests\/setup/)
    }
  })

  it('production constants contain no literal product prices', () => {
    // A real price always travels with provenance from an adapter response;
    // bare `price: <number>` literals in production modules would signal a
    // hand-written catalog.
    for (const file of productionFiles()) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${relative(ROOT, file)} declares a literal price constant`).not.toMatch(/price\s*:\s*\d{2,}/)
    }
  })
})
