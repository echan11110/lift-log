import { supabase } from './supabase'

// Durable, sequenced write queue for debounced row updates.
//
// Replaces the previous in-component debounce, which lost data four ways:
//   1. A completing write deleted whatever was in savePending[key] — including a
//      NEWER payload written while it was in flight. The follow-up timer then
//      found undefined and never wrote. (Reproduced at 86ms real latency.)
//   2. Pending payloads lived only in a ref, so closing the tab dropped them.
//   3. flushPending() cleared the buffer BEFORE issuing writes and ignored every
//      result — supabase-js resolves with {error} rather than rejecting, so
//      failures vanished and retry had nothing left to retry.
//   4. A later successful write reset the shared 'error' state, hiding the
//      earlier failure forever.
//
// Design:
//   * Every payload carries a monotonic seq. A completed write clears the entry
//     ONLY if the stored seq still matches what was sent.
//   * One in-flight write per key, so responses cannot land out of order.
//   * The queue is mirrored to localStorage on every mutation, so an unmount,
//     navigation or tab close cannot lose it; it replays on the next boot and
//     whenever the connection returns.
//   * Errors are tracked per key. One key's success never clears another's
//     failure, and a failed payload is retained for retry.

const STORAGE_KEY = 'lift-log-pending-writes'
export const DEBOUNCE_MS = 600

/** key -> { table, id, fields, seq, error } */
let pending = {}
let timers = {}
const inFlight = new Set()
let seqCounter = 0
const listeners = new Set()

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function persist() {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // Private mode / blocked storage: the queue still works in memory.
  }
}

export function getState() {
  const keys = Object.keys(pending)
  const failed = keys.filter(k => pending[k].error)
  return {
    pendingCount: keys.length,
    failedCount: failed.length,
    firstError: failed.length ? pending[failed[0]].error : null,
    status: failed.length ? 'error' : keys.length ? 'saving' : 'idle',
  }
}

function notify() {
  const snapshot = getState()
  for (const fn of listeners) {
    try { fn(snapshot) } catch { /* a bad subscriber must not stall the queue */ }
  }
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function arm(key, ms) {
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => { void runKey(key) }, ms)
}

async function runKey(key) {
  delete timers[key]
  const payload = pending[key]
  if (!payload) return

  // Serialize per key: never overlap two writes to the same row, so a slow
  // earlier response cannot overwrite a newer value.
  if (inFlight.has(key)) {
    arm(key, 50)
    return
  }

  inFlight.add(key)
  const sentSeq = payload.seq
  let ok = false
  try {
    const { error } = await supabase
      .from(payload.table)
      .update(payload.fields)
      .eq('id', payload.id)
    if (error) throw error
    ok = true
  } catch (err) {
    // Keep the payload so it can be retried or replayed after a reload.
    if (pending[key]) pending[key].error = err?.message ?? 'Save failed'
  }
  inFlight.delete(key)

  if (ok) {
    if (pending[key]?.seq === sentSeq) {
      delete pending[key]
    } else if (!timers[key]) {
      // A newer edit arrived mid-flight — write that too rather than dropping it.
      arm(key, 0)
    }
  }

  persist()
  notify()
}

export function scheduleWrite(key, table, id, fields) {
  const prev = pending[key]
  pending[key] = {
    table,
    id,
    // Merge so rapid edits to different columns of one row don't clobber.
    fields: { ...(prev?.fields ?? {}), ...fields },
    seq: ++seqCounter,
    error: null,
  }
  persist()
  notify()
  arm(key, DEBOUNCE_MS)
}

/** Write everything now, awaiting results. Failures stay queued. */
export async function flushNow() {
  const keys = Object.keys(pending)
  for (const k of keys) {
    clearTimeout(timers[k])
    delete timers[k]
  }
  await Promise.all(keys.map(k => runKey(k)))
}

/** Clear error flags and try every queued write again. */
export async function retryAll() {
  for (const p of Object.values(pending)) p.error = null
  notify()
  await flushNow()
}

/** Re-arm everything still queued — used on boot and when connectivity returns. */
export function replayPending() {
  for (const key of Object.keys(pending)) {
    if (!inFlight.has(key)) arm(key, 0)
  }
}

/** Drop the queue without writing. Used on sign-out so writes can't cross accounts. */
export function clearPending() {
  for (const k of Object.keys(timers)) clearTimeout(timers[k])
  timers = {}
  pending = {}
  persist()
  notify()
}

/** Test seam. */
export function __resetForTests() {
  for (const k of Object.keys(timers)) clearTimeout(timers[k])
  timers = {}
  pending = {}
  inFlight.clear()
  seqCounter = 0
  listeners.clear()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// Restore anything a previous session left unwritten. It is only re-armed once
// the app knows who is signed in (see useAuth), because a write without a
// session would just fail and be marked as an error.
pending = readStorage()

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => replayPending())
  // Data is already mirrored to localStorage, so this is a best-effort speed-up;
  // anything that doesn't make it replays on the next load.
  window.addEventListener('pagehide', () => { void flushNow() })
}
