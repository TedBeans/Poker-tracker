import test from 'node:test'
import assert from 'node:assert/strict'
import { toCents, fmt, settle, summarize, leaderboard } from './lib.js'

test('toCents / fmt', () => {
  assert.equal(toCents('$20'), 2000)
  assert.equal(toCents('12.5'), 1250)
  assert.equal(toCents('abc'), null)
  assert.equal(fmt(2000), '$20')
  assert.equal(fmt(-1250, true), '-$12.50')
  assert.equal(fmt(500, true), '+$5')
})

test('settle zeroes everyone out', () => {
  const rows = [
    { name: 'A', net: 5000 }, { name: 'B', net: -2000 },
    { name: 'C', net: -3500 }, { name: 'D', net: 500 },
  ]
  const pay = settle(rows)
  const bal = {}
  for (const p of pay) { bal[p.from] = (bal[p.from] || 0) - p.amt; bal[p.to] = (bal[p.to] || 0) + p.amt }
  for (const r of rows) assert.equal(bal[r.name] || 0, r.net)
})

test('summarize + leaderboard', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
  const s = {
    status: 'closed', playerIds: ['a', 'b'],
    entries: {
      a: { buyins: [{ amt: 2000 }, { amt: 2000 }], cashout: 1000 },
      b: { buyins: [{ amt: 2000 }], cashout: 5000 },
    },
  }
  const sum = summarize(s, players)
  assert.equal(sum.pot, 6000)
  assert.equal(sum.diff, 0)
  const lb = leaderboard([s], players)
  assert.equal(lb[0].name, 'B')
  assert.equal(lb[0].net, 3000)
  assert.equal(lb[1].net, -3000)
})
