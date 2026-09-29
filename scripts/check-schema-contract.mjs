#!/usr/bin/env node
/**
 * Asserts that the LIVE database matches what the client code expects.
 *
 * Why this exists: docs/schema.sql is a description, not a migration log, and
 * migrations are applied by hand. In June 2026 the v2 block was run before the
 * name RPCs were corrected, so the file said one thing and production did
 * another for three months — distinct_cardio_names did not exist at all, and
 * distinct_exercise_names returned cardio activities into Progress → Strength.
 *
 * src/lib/__tests__/schema.regression-1.test.js cannot catch that: it reads
 * schema.sql as text and never talks to a database. This does the opposite —
 * it ignores the file entirely and interrogates the deployed database using
 * only the public anon key and a dedicated fixture account.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY   same values the app is built with
 *   SCHEMA_CHECK_PASSPHRASE           a passphrase used ONLY by this check
 *
 * Exit code 1 on any failed assertion.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_ANON_KEY
const PASSPHRASE = process.env.SCHEMA_CHECK_PASSPHRASE

if (!URL_ || !KEY || !PASSPHRASE) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SCHEMA_CHECK_PASSPHRASE.')
  process.exit(1)
}

// Sentinel fixture. Far-past date so it can never collide with real logging,
// and it lives under its own account, so RLS keeps it away from real data.
const FIXTURE_DATE = '1970-01-02'
const STRENGTH_NAME = '__contract_strength__'
const CARDIO_NAME = '__contract_cardio__'

// Columns the client actually selects or inserts. A missing one returns 42703.
const REQUIRED_COLUMNS = {
  workout_sessions: ['id', 'user_id', 'date', 'split_type', 'notes'],
  exercises: ['id', 'session_id', 'name', 'exercise_order', 'exercise_type'],
  sets: ['id', 'exercise_id', 'set_number', 'weight', 'reps'],
  dropsets: ['id', 'set_id', 'drop_order', 'weight', 'reps'],
  cardio_entries: ['id', 'exercise_id', 'duration_sec', 'distance_m', 'distance_unit',
                   'avg_pace_sec', 'calories', 'resistance_level'],
  split_templates: ['id', 'user_id', 'name'],
  split_days: ['id', 'template_id', 'day_index', 'label', 'muscle_groups'],
  cardio_exercise_defs: ['id', 'user_id', 'name', 'unit'],
}

const results = []
const ok = (name, detail = '') => results.push({ pass: true, name, detail })
const fail = (name, detail) => results.push({ pass: false, name, detail })

// Explicit floor. The source scan below only sees literal .rpc('name') calls,
// and useExerciseNames dispatches through a variable — which is exactly how
// distinct_cardio_names escaped the existence check on the first run of this
// script. Union the two: this list guarantees coverage, the scan catches new
// literal call sites for free.
const REQUIRED_RPCS = ['distinct_exercise_names', 'distinct_cardio_names']

/** RPCs called literally in source, so new ones are covered automatically. */
function rpcsUsedInSource(dir = 'src') {
  const found = new Set()
  const walk = d => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(js|jsx)$/.test(p)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/\.rpc\(\s*['"`]([a-z0-9_]+)['"`]/gi)) {
          found.add(m[1])
        }
      }
    }
  }
  walk(dir)
  return [...found].sort()
}

async function main() {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } })

  const hash = [...new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(PASSPHRASE.toLowerCase().trim())
  ))].map(b => b.toString(16).padStart(2, '0')).join('')
  const creds = { email: `${hash.slice(0, 24)}@lift-log.app`, password: `ll__${hash}` }

  let { data: auth, error: signInErr } = await sb.auth.signInWithPassword(creds)
  if (signInErr) {
    // First run: provision the dedicated fixture account.
    const up = await sb.auth.signUp(creds)
    if (up.error) {
      console.error('Could not sign in or create the fixture account:', up.error.message)
      process.exit(1)
    }
    auth = up.data
  }
  const userId = auth?.user?.id
  if (!userId) {
    console.error('Signed in but no user id was returned.')
    process.exit(1)
  }

  // ---- fixture, created idempotently -------------------------------------
  const { data: session, error: sErr } = await sb
    .from('workout_sessions')
    .upsert({ user_id: userId, date: FIXTURE_DATE, split_type: 'Push' },
            { onConflict: 'user_id,date' })
    .select().single()
  if (sErr) {
    console.error('Could not create the fixture session:', sErr.message)
    process.exit(1)
  }

  const { data: existing } = await sb
    .from('exercises').select('id, name, exercise_type').eq('session_id', session.id)
  const byName = Object.fromEntries((existing ?? []).map(e => [e.name, e]))

  async function ensureExercise(name, type, order) {
    if (byName[name]) return byName[name]
    const { data, error } = await sb.from('exercises')
      .insert({ session_id: session.id, name, exercise_type: type, exercise_order: order })
      .select().single()
    if (error) throw new Error(`could not create fixture exercise ${name}: ${error.message}`)
    return data
  }

  const strengthEx = await ensureExercise(STRENGTH_NAME, 'strength', 1)
  await ensureExercise(CARDIO_NAME, 'cardio', 2)

  // ---- 1. every RPC the client calls exists ------------------------------
  const rpcs = [...new Set([...REQUIRED_RPCS, ...rpcsUsedInSource()])].sort()
  for (const fn of rpcs) {
    const { error } = await sb.rpc(fn, { p_user_id: userId })
    if (error?.code === 'PGRST202') {
      fail(`rpc ${fn} exists`, `PGRST202 — not deployed. Run the migration in docs/schema.sql.`)
    } else if (error) {
      fail(`rpc ${fn} exists`, `${error.code}: ${error.message}`)
    } else {
      ok(`rpc ${fn} exists`)
    }
  }

  // ---- 2 & 3. the RPCs filter by exercise_type ---------------------------
  // This is the assertion that was false in production for three months.
  const strengthRpc = await sb.rpc('distinct_exercise_names', { p_user_id: userId })
  if (strengthRpc.error) {
    fail('distinct_exercise_names filters to strength', strengthRpc.error.message)
  } else {
    const names = strengthRpc.data ?? []
    if (!names.includes(STRENGTH_NAME)) {
      fail('distinct_exercise_names filters to strength', 'fixture strength name missing')
    } else if (names.includes(CARDIO_NAME)) {
      fail('distinct_exercise_names filters to strength',
           'returned a cardio activity — the exercise_type filter is missing, so cardio leaks into Progress → Strength')
    } else ok('distinct_exercise_names filters to strength')
  }

  const cardioRpc = await sb.rpc('distinct_cardio_names', { p_user_id: userId })
  if (cardioRpc.error) {
    fail('distinct_cardio_names filters to cardio', cardioRpc.error.message)
  } else {
    const names = cardioRpc.data ?? []
    if (!names.includes(CARDIO_NAME)) {
      fail('distinct_cardio_names filters to cardio', 'fixture cardio name missing')
    } else if (names.includes(STRENGTH_NAME)) {
      fail('distinct_cardio_names filters to cardio', 'returned a strength exercise')
    } else ok('distinct_cardio_names filters to cardio')
  }

  // ---- 4. required columns exist -----------------------------------------
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    const { error } = await sb.from(table).select(cols.join(',')).limit(1)
    if (error) fail(`${table} has required columns`, `${error.code}: ${error.message}`)
    else ok(`${table} has required columns`)
  }

  // ---- 5. duplicate ordering values are rejected -------------------------
  // Guards the bug where a dropped renumber left a gap and the next insert
  // collided, persisting two rows with the same set_number.
  // Reuse the fixture set rather than inserting one per run, which would grow
  // the fixture account without bound.
  let { data: firstSet } = await sb.from('sets')
    .select('id').eq('exercise_id', strengthEx.id).eq('set_number', 1).maybeSingle()
  if (!firstSet) {
    const created = await sb.from('sets')
      .insert({ exercise_id: strengthEx.id, set_number: 1, weight: 100, reps: 1 })
      .select().maybeSingle()
    firstSet = created.data
  }
  if (firstSet) {
    const dup = await sb.from('sets')
      .insert({ exercise_id: strengthEx.id, set_number: 1, weight: 101, reps: 1 })
      .select().maybeSingle()
    if (dup.error?.code === '23505') {
      ok('sets rejects a duplicate set_number')
    } else if (dup.error) {
      fail('sets rejects a duplicate set_number', `unexpected ${dup.error.code}: ${dup.error.message}`)
    } else {
      // Do not leave the duplicate behind.
      if (dup.data?.id) await sb.from('sets').delete().eq('id', dup.data.id)
      fail('sets rejects a duplicate set_number',
           'the insert succeeded — no unique index on (exercise_id, set_number), so a renumber bug can silently corrupt ordering')
    }
  }

  // ---- report -------------------------------------------------------------
  const failed = results.filter(r => !r.pass)
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)

  if (failed.length) {
    console.error(
      `\nThe deployed database does not match what the client expects.\n` +
      `Apply the outstanding migration in docs/schema.sql via the Supabase SQL editor.`
    )
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Schema contract check errored:', err?.message ?? err)
  process.exit(1)
})
