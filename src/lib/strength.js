// Epley formula: e1RM = weight × (1 + reps / 30). Assumes reps >= 1.
export function epley1RM(weight, reps) {
  return weight * (1 + reps / 30)
}

// Returns { e1rm, set } for the best set in the array.
// set is the original set object. Returns { e1rm: 0, set: null } for empty input.
//
// Ranks by e1RM, breaking ties on reps. The tie-break exists because Epley is
// degenerate for bodyweight work: at weight 0 it returns 0 for every rep count,
// so pull-ups and dips previously produced { e1rm: 0, set: null } and could never
// show a best set or a PR. Comparing reps when e1RM is equal makes a 12-rep
// bodyweight set outrank a 5-rep one, and leaves loaded sets unaffected.
//
// Seeding with null rather than { e1rm: 0 } matters too: the old `e > best.e1rm`
// against a 0 seed meant a weight-0 set could never win.
// Sets tied on both e1RM and reps keep the first, which is long-standing
// documented behaviour (see strength.test.js).
export function bestE1RM(sets) {
  let best = null
  let bestE = 0
  for (const s of sets) {
    const e = epley1RM(s.weight, s.reps)
    if (best === null || e > bestE || (e === bestE && s.reps > best.reps)) {
      best = s
      bestE = e
    }
  }
  return { e1rm: best === null ? 0 : bestE, set: best }
}
