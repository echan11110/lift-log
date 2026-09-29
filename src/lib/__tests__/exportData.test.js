import { describe, it, expect } from 'vitest'
import { toCSV, summarize } from '../exportData'

const sessions = [
  {
    date: '2026-09-01',
    split_type: 'Push',
    notes: 'felt strong',
    exercises: [
      {
        name: 'Bench Press',
        exercise_type: 'strength',
        exercise_order: 1,
        sets: [
          { set_number: 1, weight: 225, reps: 5, dropsets: [] },
          { set_number: 2, weight: 205, reps: 8, dropsets: [{ drop_order: 1, weight: 135, reps: 10 }] },
        ],
      },
      {
        name: 'Assault Bike',
        exercise_type: 'cardio',
        exercise_order: 2,
        sets: [],
        cardio_entries: [{ duration_sec: 600, distance_m: 2.5, distance_unit: 'mi', calories: 90 }],
      },
      { name: 'Flyes', exercise_type: 'strength', exercise_order: 3, sets: [] },
    ],
  },
]

const header = 'date,split,exercise,type,exercise_order,set_number,weight,reps,dropset_order,dropset_weight,dropset_reps,cardio_duration_sec,cardio_distance,cardio_unit,cardio_pace_sec,cardio_calories,cardio_resistance,session_notes'

describe('toCSV', () => {
  const lines = toCSV(sessions).split('\n')

  it('emits the documented header', () => {
    expect(lines[0]).toBe(header)
  })

  it('writes one row per set, dropset, cardio entry, and empty exercise', () => {
    // 2 sets + 1 dropset + 1 cardio + 1 exercise with nothing logged
    expect(lines).toHaveLength(1 + 5)
  })

  it('keeps every column aligned to the header', () => {
    const width = header.split(',').length
    for (const line of lines) expect(line.split(',')).toHaveLength(width)
  })

  it('carries set values onto the right row', () => {
    expect(lines[1]).toContain('Bench Press')
    expect(lines[1]).toContain('225')
    expect(lines[1]).toContain('2026-09-01')
  })

  it('associates a dropset with its parent set number', () => {
    const drop = lines.find(l => l.includes('135'))
    const cells = drop.split(',')
    expect(cells[5]).toBe('2')   // set_number of the parent
    expect(cells[8]).toBe('1')   // dropset_order
  })

  it('writes cardio fields rather than weight/reps', () => {
    const cardio = lines.find(l => l.includes('Assault Bike'))
    const cells = cardio.split(',')
    expect(cells[3]).toBe('cardio')
    expect(cells[6]).toBe('')    // weight empty
    expect(cells[11]).toBe('600')
    expect(cells[13]).toBe('mi')
  })

  it('still emits a row for an exercise with nothing logged', () => {
    expect(lines.some(l => l.includes('Flyes'))).toBe(true)
  })

  it('quotes and escapes values that would break the row', () => {
    const csv = toCSV([{
      date: '2026-09-02', split_type: 'Pull',
      notes: 'tweaked back, "again"\nsee physio',
      exercises: [],
    }])
    expect(csv.split('\n')[1]).toContain('"tweaked back, ""again""')
  })

  it('handles a completely empty export', () => {
    expect(toCSV([])).toBe(header)
  })
})

describe('summarize', () => {
  it('counts every level', () => {
    expect(summarize(sessions)).toEqual({
      sessions: 1, exercises: 3, sets: 2, dropsets: 1, cardio: 1,
    })
  })

  it('is zero for no data', () => {
    expect(summarize([])).toEqual({
      sessions: 0, exercises: 0, sets: 0, dropsets: 0, cardio: 0,
    })
  })
})
