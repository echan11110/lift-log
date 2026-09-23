import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Regression: ISSUE-001/002 — docs/schema.sql could not be applied to a fresh
// database. distinct_exercise_names and distinct_cardio_names were defined in
// the base block but filter on exercises.exercise_type, which migration v2 adds
// much later. LANGUAGE sql bodies are parsed at CREATE time, so psql aborted
// with "column e.exercise_type does not exist". The same ordering bug is why
// the deployed database kept a distinct_exercise_names with no strength filter
// (cardio leaked into Progress → Strength) and no distinct_cardio_names at all.
// Found by /qa on 2026-08-16
// Report: .gstack/qa-reports/qa-report-lift-log-2026-08-16.md

const schema = readFileSync(
  fileURLToPath(new URL('../../../docs/schema.sql', import.meta.url)),
  'utf8'
)

// Splits the file into `create or replace function <name>` blocks, keeping each
// block's offset so definitions can be ordered against the column that adds
// exercise_type.
function functionBlocks(sql) {
  const re = /create or replace function\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\$\$;/g
  const blocks = []
  let m
  while ((m = re.exec(sql)) !== null) {
    blocks.push({ name: m[1], body: m[3], index: m.index })
  }
  return blocks
}

describe('docs/schema.sql ordering', () => {
  const columnAddIndex = schema.indexOf("add column if not exists exercise_type")

  it('adds the exercise_type column somewhere in the file', () => {
    expect(columnAddIndex).toBeGreaterThan(-1)
  })

  it('defines every exercise_type-dependent function after the column exists', () => {
    const dependent = functionBlocks(schema).filter(b => b.body.includes('exercise_type'))

    // Both name-autocomplete RPCs filter on exercise_type; if neither is found
    // the regex broke and the test would pass vacuously.
    expect(dependent.length).toBeGreaterThanOrEqual(2)

    for (const block of dependent) {
      expect(
        block.index,
        `${block.name} references exercise_type but is defined before the column is added`
      ).toBeGreaterThan(columnAddIndex)
    }
  })

  it('keeps the strength filter on distinct_exercise_names', () => {
    const fn = functionBlocks(schema).find(b => b.name === 'distinct_exercise_names')
    expect(fn).toBeDefined()
    expect(fn.body).toContain("exercise_type = 'strength'")
  })

  it('keeps the cardio filter on distinct_cardio_names', () => {
    const fn = functionBlocks(schema).find(b => b.name === 'distinct_cardio_names')
    expect(fn).toBeDefined()
    expect(fn.body).toContain("exercise_type = 'cardio'")
  })

  it('defines each name RPC exactly once so migration order is unambiguous', () => {
    const names = functionBlocks(schema).map(b => b.name)
    for (const target of ['distinct_exercise_names', 'distinct_cardio_names']) {
      expect(names.filter(n => n === target)).toHaveLength(1)
    }
  })
})
