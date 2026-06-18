import { describe, it, expect } from 'vitest'
import { epley1RM, bestE1RM } from '../strength'

describe('epley1RM', () => {
  it('applies Epley formula', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(100 * (1 + 10 / 30))
  })

  it('1 rep returns weight exactly', () => {
    expect(epley1RM(185, 1)).toBeCloseTo(185 * (1 + 1 / 30))
  })

  it('135×15 outranks 185×1 (lighter weight, many reps)', () => {
    // 135×15 = 202.5, 185×1 = 191.2 — lighter weight with enough reps wins
    expect(epley1RM(135, 15)).toBeGreaterThan(epley1RM(185, 1))
  })

  it('same weight, more reps is a PR (rep PR case)', () => {
    expect(epley1RM(100, 8)).toBeGreaterThan(epley1RM(100, 5))
  })

  it('higher weight at same reps ranks higher', () => {
    expect(epley1RM(200, 5)).toBeGreaterThan(epley1RM(185, 5))
  })
})

describe('bestE1RM', () => {
  it('picks the set with the highest e1RM', () => {
    // 135×15 = 202.5 beats 185×1 = 191.2
    const sets = [
      { weight: 185, reps: 1 },
      { weight: 135, reps: 15 },
    ]
    const { e1rm, set } = bestE1RM(sets)
    expect(set.weight).toBe(135)
    expect(set.reps).toBe(15)
    expect(e1rm).toBeCloseTo(epley1RM(135, 15))
  })

  it('returns e1rm: 0, set: null for empty array', () => {
    const { e1rm, set } = bestE1RM([])
    expect(e1rm).toBe(0)
    expect(set).toBeNull()
  })

  it('single set returns that set', () => {
    const sets = [{ weight: 225, reps: 5 }]
    const { set } = bestE1RM(sets)
    expect(set.weight).toBe(225)
  })

  it('tie — returns first winner encountered', () => {
    const sets = [
      { weight: 100, reps: 10 },
      { weight: 100, reps: 10 },
    ]
    const { e1rm, set } = bestE1RM(sets)
    expect(e1rm).toBeCloseTo(epley1RM(100, 10))
    expect(set).toBe(sets[0])
  })

  it('preserves all fields on the returned set object', () => {
    const sets = [{ id: 'abc', weight: 150, reps: 8, set_number: 2 }]
    const { set } = bestE1RM(sets)
    expect(set.id).toBe('abc')
    expect(set.set_number).toBe(2)
  })
})
