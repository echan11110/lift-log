import { describe, it, expect } from 'vitest'
import { renumberItems } from '../orderUtils'

describe('renumberItems', () => {
  it('assigns 1..N to a full list', () => {
    const items = [{ id: 'a', set_number: 1 }, { id: 'b', set_number: 2 }, { id: 'c', set_number: 3 }]
    const result = renumberItems(items, 'set_number')
    expect(result.map(s => s.set_number)).toEqual([1, 2, 3])
  })

  it('renumbers contiguously after deleting a middle item', () => {
    // Simulate: had [1, 2, 3], deleted index 1 (set_number 2), now [1, 3]
    const remaining = [{ id: 'a', set_number: 1 }, { id: 'c', set_number: 3 }]
    const result = renumberItems(remaining, 'set_number')
    expect(result[0].set_number).toBe(1)
    expect(result[1].set_number).toBe(2)
  })

  it('renumbers contiguously after deleting the first item', () => {
    const remaining = [{ id: 'b', set_number: 2 }, { id: 'c', set_number: 3 }]
    const result = renumberItems(remaining, 'set_number')
    expect(result[0].set_number).toBe(1)
    expect(result[1].set_number).toBe(2)
  })

  it('renumbers contiguously after deleting the last item', () => {
    const remaining = [{ id: 'a', set_number: 1 }, { id: 'b', set_number: 2 }]
    const result = renumberItems(remaining, 'set_number')
    expect(result[0].set_number).toBe(1)
    expect(result[1].set_number).toBe(2)
  })

  it('handles empty list', () => {
    expect(renumberItems([], 'exercise_order')).toEqual([])
  })

  it('works with any orderField name', () => {
    const items = [{ id: 'x', drop_order: 5 }, { id: 'y', drop_order: 7 }]
    const result = renumberItems(items, 'drop_order')
    expect(result[0].drop_order).toBe(1)
    expect(result[1].drop_order).toBe(2)
  })

  it('preserves all other fields', () => {
    const items = [{ id: 'a', set_number: 3, weight: 100, reps: 5 }]
    const result = renumberItems(items, 'set_number')
    expect(result[0]).toEqual({ id: 'a', set_number: 1, weight: 100, reps: 5 })
  })
})
