import { describe, it, expect } from 'vitest'
import { toDateStr, displayDate, weekRange, monthDays, sessionVolume } from '../dateUtils'

describe('toDateStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateStr(new Date(2024, 0, 5))).toBe('2024-01-05')
  })
  it('pads month and day', () => {
    expect(toDateStr(new Date(2024, 8, 1))).toBe('2024-09-01')
  })
})

describe('displayDate', () => {
  it('returns a human-readable string', () => {
    const result = displayDate('2024-03-15')
    expect(result).toContain('March')
    expect(result).toContain('15')
  })
})

describe('weekRange', () => {
  it('returns 7 days starting on Monday', () => {
    // 2024-03-13 is a Wednesday
    const days = weekRange('2024-03-13')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2024-03-11') // Monday
    expect(days[6]).toBe('2024-03-17') // Sunday
  })

  it('handles Sunday: week starts on preceding Monday', () => {
    // 2024-03-17 is a Sunday
    const days = weekRange('2024-03-17')
    expect(days[0]).toBe('2024-03-11') // Monday
    expect(days[6]).toBe('2024-03-17') // Sunday (the input day)
  })

  it('handles Monday: is already the first day', () => {
    const days = weekRange('2024-03-11')
    expect(days[0]).toBe('2024-03-11')
    expect(days[6]).toBe('2024-03-17')
  })
})

describe('monthDays', () => {
  it('returns rows with correct thisMonth flags for January 2024', () => {
    // Jan 2024: starts on Monday, no leading days needed
    const days = monthDays(2024, 0)
    expect(days[0]).toEqual({ dateStr: '2024-01-01', thisMonth: true })
    expect(days[30]).toEqual({ dateStr: '2024-01-31', thisMonth: true })
    // total length is a multiple of 7
    expect(days.length % 7).toBe(0)
  })

  it('has leading days when month does not start on Monday', () => {
    // March 2024 starts on Friday
    const days = monthDays(2024, 2)
    expect(days[0].thisMonth).toBe(false)
    expect(days[0].dateStr).toBe('2024-02-26') // preceding Monday
    const first = days.find(d => d.thisMonth)
    expect(first.dateStr).toBe('2024-03-01')
  })

  it('has trailing days to complete the last row', () => {
    // Feb 2024 (leap): starts Thu, 29 days → needs trailing days to fill last row
    const days = monthDays(2024, 1)
    expect(days[days.length - 1].thisMonth).toBe(false)
  })

  it('handles leap year February (2024)', () => {
    const days = monthDays(2024, 1)
    const feb = days.filter(d => d.thisMonth)
    expect(feb).toHaveLength(29)
    expect(feb[28].dateStr).toBe('2024-02-29')
  })

  it('handles non-leap year February (2023)', () => {
    const days = monthDays(2023, 1)
    const feb = days.filter(d => d.thisMonth)
    expect(feb).toHaveLength(28)
  })
})

describe('sessionVolume', () => {
  it('sums weight × reps across sets', () => {
    const exercises = [
      { sets: [{ weight: 100, reps: 5, dropsets: [] }, { weight: 90, reps: 8, dropsets: [] }] },
    ]
    expect(sessionVolume(exercises)).toBe(100 * 5 + 90 * 8)
  })

  it('includes dropset volume', () => {
    const exercises = [
      {
        sets: [{
          weight: 100, reps: 5,
          dropsets: [{ weight: 80, reps: 8 }, { weight: 60, reps: 10 }],
        }],
      },
    ]
    expect(sessionVolume(exercises)).toBe(100 * 5 + 80 * 8 + 60 * 10)
  })

  it('returns 0 for empty exercises', () => {
    expect(sessionVolume([])).toBe(0)
  })

  it('handles missing dropsets gracefully', () => {
    const exercises = [
      { sets: [{ weight: 50, reps: 10 }] },
    ]
    expect(sessionVolume(exercises)).toBe(500)
  })
})
