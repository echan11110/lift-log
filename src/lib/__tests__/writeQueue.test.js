import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Regression suite for the autosave data-loss findings of the 2026-09-28 audit.
// Each test here corresponds to a scenario that was reproduced against the live
// app and silently lost a logged set.

// --- controllable supabase stub -------------------------------------------------

/** Rows as the "database" sees them. */
let db
/** Completed writes, in the order the server applied them. */
let applied
/** When set, update() waits on this before resolving — lets a write be in flight. */
let gate
/** Keys (by row id) that should fail once. */
let failFor

function makeGate() {
  let release
  const promise = new Promise(res => { release = res })
  return { promise, release }
}

vi.mock('../supabase', () => ({
  supabase: {
    from: (table) => ({
      update: (fields) => ({
        eq: async (_col, id) => {
          if (gate) await gate.promise
          if (failFor.has(id)) {
            failFor.delete(id)
            // supabase-js RESOLVES with {error} rather than rejecting. Getting
            // this wrong is why failures used to disappear.
            return { error: { message: 'boom' }, data: null }
          }
          db[`${table}:${id}`] = { ...(db[`${table}:${id}`] ?? {}), ...fields }
          applied.push({ table, id, fields })
          return { error: null, data: null }
        },
      }),
    }),
  },
}))

let q

beforeEach(async () => {
  db = {}
  applied = []
  gate = null
  failFor = new Set()

  const store = new Map()
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  }

  vi.useFakeTimers()
  vi.resetModules()
  q = await import('../writeQueue')
  q.__resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.localStorage
})

const row = id => db[`sets:${id}`]

describe('writeQueue — debounce and merging', () => {
  it('writes once after the debounce, merging fields for the same row', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { weight: 100 })
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 5 })
    expect(applied).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)

    expect(applied).toHaveLength(1)
    expect(row('r1')).toEqual({ weight: 100, reps: 5 })
    expect(q.getState().status).toBe('idle')
  })
})

describe('writeQueue — C-1: an edit during an in-flight write must not be dropped', () => {
  it('persists the newer value and never reports idle while it is unwritten', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 11 })

    // Hold the first write open, exactly like a real 86ms round trip.
    gate = makeGate()
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)

    // Second edit arrives while write #1 is still in flight. The old code
    // deleted this payload when #1 resolved, so it never reached the database.
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 12 })

    gate.release()
    gate = null
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 50)

    expect(row('r1').reps).toBe(12)
    expect(q.getState()).toMatchObject({ status: 'idle', pendingCount: 0 })
  })

  it('reports a non-idle status for as long as anything is unwritten', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 11 })
    expect(q.getState().status).toBe('saving')

    gate = makeGate()
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 12 })

    // Mid-flight with a newer edit queued: must not claim idle.
    expect(q.getState().status).not.toBe('idle')

    gate.release()
    gate = null
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 50)
    expect(q.getState().status).toBe('idle')
  })
})

describe('writeQueue — H-4: responses cannot land out of order', () => {
  it('serializes writes to the same row', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 1 })
    gate = makeGate()
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)

    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 2 })
    // Only one write may be outstanding per row.
    expect(applied).toHaveLength(0)

    gate.release()
    gate = null
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 100)

    expect(applied.map(a => a.fields.reps)).toEqual([1, 2])
    expect(row('r1').reps).toBe(2)
  })
})

describe('writeQueue — C-3: one key\'s success must not hide another key\'s failure', () => {
  it('keeps the failed payload and stays in error after an unrelated success', async () => {
    failFor.add('r1')
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 33 })
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)

    expect(q.getState()).toMatchObject({ status: 'error', failedCount: 1 })
    expect(row('r1')).toBeUndefined()

    // A different row saves fine — this used to reset the shared error state.
    q.scheduleWrite('set-2', 'sets', 'r2', { reps: 9 })
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)

    expect(row('r2').reps).toBe(9)
    expect(q.getState()).toMatchObject({ status: 'error', failedCount: 1 })
  })

  it('retryAll recovers the failed payload', async () => {
    failFor.add('r1')
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 33 })
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)
    expect(q.getState().status).toBe('error')

    await q.retryAll()

    expect(row('r1').reps).toBe(33)
    expect(q.getState()).toMatchObject({ status: 'idle', failedCount: 0 })
  })
})

describe('writeQueue — C-2: a failed flush must not discard the payload', () => {
  it('flushNow keeps failures queued so they can still be retried', async () => {
    failFor.add('r1')
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 21 })

    // Route change / unmount path.
    await q.flushNow()

    expect(row('r1')).toBeUndefined()
    // The old flush cleared the buffer before writing, so retry had nothing left.
    expect(q.getState()).toMatchObject({ status: 'error', pendingCount: 1 })

    await q.retryAll()
    expect(row('r1').reps).toBe(21)
  })
})

describe('writeQueue — C-4: pending writes survive losing the page', () => {
  it('mirrors the queue to localStorage and replays it in a fresh module instance', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 17 })
    // Tab closed before the 600ms debounce elapsed: nothing was sent.
    expect(applied).toHaveLength(0)
    expect(localStorage.getItem('lift-log-pending-writes')).toContain('r1')

    // Simulate the next page load picking the queue back up.
    vi.resetModules()
    const q2 = await import('../writeQueue')
    expect(q2.getState().pendingCount).toBe(1)

    q2.replayPending()
    await vi.advanceTimersByTimeAsync(50)

    expect(row('r1').reps).toBe(17)
    expect(q2.getState().status).toBe('idle')
  })

  it('clearPending drops the queue without writing (sign-out)', async () => {
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 5 })
    q.clearPending()
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 50)

    expect(applied).toHaveLength(0)
    expect(q.getState()).toMatchObject({ status: 'idle', pendingCount: 0 })
    expect(localStorage.getItem('lift-log-pending-writes')).toBeNull()
  })
})

describe('writeQueue — subscribers', () => {
  it('notifies on schedule and on completion', async () => {
    const seen = []
    const unsub = q.subscribe(s => seen.push(s.status))
    q.scheduleWrite('set-1', 'sets', 'r1', { reps: 3 })
    await vi.advanceTimersByTimeAsync(q.DEBOUNCE_MS + 10)
    unsub()

    expect(seen[0]).toBe('saving')
    expect(seen.at(-1)).toBe('idle')
  })
})
