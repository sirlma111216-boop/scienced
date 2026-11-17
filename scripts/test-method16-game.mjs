import assert from 'node:assert/strict'
import { lesson } from '../src/content/courses/method/lesson16.ts'
import { derive, presentersOf } from '../src/lib/game-core.ts'
import { gameRule } from '../src/content/games.ts'

// Use the production engine with the lesson's actual configuration.
assert.equal(lesson.activity.game, 'rps')
assert.equal(lesson.activity.gameOptions.pick, 'firstOut')
assert.match(gameRule(lesson.activity.game, lesson.activity.gameOptions), /진 두 사람/)
for (const size of [4, 14, 31]) {
  const roster = Array.from({ length: size }, (_, i) => `student-${i}`)
  const t0 = 1000000
  const values = {}
  const state = { kind: lesson.activity.game, stepId: 'activity', phase: 'running', round: 1, seed: `method16-${size}`, startedAt: t0, state: { roster }, result: null, updatedAt: t0 }
  const ctx = (now) => ({ state, now, groups: [], options: lesson.activity.gameOptions, inputs: Object.entries(values).map(([uid, value]) => ({ uid, stepId: 'activity', round: 1, value, joinedAt: t0, updatedAt: now })) })
  const initial = derive(ctx(t0))
  for (const m of initial.view.matches) {
    if (!m.b) continue
    values[m.a] = { hands: { [m.key]: 'rock' } }
    values[m.b] = { hands: { [m.key]: 'paper' } }
  }
  const result = derive(ctx(t0 + 100))
  assert.equal(result.finished, true)
  const presenters = presentersOf(ctx(t0 + 100), result, {})
  assert.equal(presenters.length, 2)
  const losers = result.view.matches.filter(m => m.b && m.winner).map(m => m.winner === m.a ? m.b : m.a)
  assert.ok(presenters.every(uid => losers.includes(uid)), 'Only defeated players may present')
  console.log(`${size} students: two defeated players selected`)
}
