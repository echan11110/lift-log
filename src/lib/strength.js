// Epley formula: e1RM = weight × (1 + reps / 30). Assumes reps >= 1.
export function epley1RM(weight, reps) {
  return weight * (1 + reps / 30)
}

// Returns { e1rm, set } for the set with the highest e1RM in the array.
// set is the original set object. Returns { e1rm: 0, set: null } for empty input.
export function bestE1RM(sets) {
  let best = { e1rm: 0, set: null }
  for (const s of sets) {
    const e = epley1RM(s.weight, s.reps)
    if (e > best.e1rm) best = { e1rm: e, set: s }
  }
  return best
}
