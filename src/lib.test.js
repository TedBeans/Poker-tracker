import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toCents, fmt, settle, summarize, leaderboard, migrate,
  logBuyIn, logCashOut, removeEvent, feedItems, recapText,
} from './lib.js'

const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
const mkSession = () => ({
  id: 's', date: '2026-11-17', status: 'closed', defaultBuyIn: 2000, playerIds: ['a', 'b'], events: [],
})

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

test('event log: buy-ins, replace cash-out, undo', () => {
  const s = mkSession()
  logBuyIn(s, 'a', 2000)
  const second = logBuyIn(s, 'a', 2000)
  logBuyIn(s, 'b', 2000)
  logCashOut(s, 'a', 1000)
  logCashOut(s, 'a', 1500) // replaces the first cash-out
  assert.equal(s.events.filter((e) => e.type === 'cashout').length, 1)
  removeEvent(s, second)
  const sum = summarize(s, players)
  assert.equal(sum.pot, 4000)
  assert.equal(sum.rows[0].net, 1500 - 2000)
  assert.equal(sum.pending.length, 1)
})

test('summarize + leaderboard + feed + recap', () => {
  const s = mkSession()
  logBuyIn(s, 'a', 2000); logBuyIn(s, 'a', 2000); logBuyIn(s, 'b', 2000)
  logCashOut(s, 'a', 1000); logCashOut(s, 'b', 5000)
  const sum = summarize(s, players)
  assert.equal(sum.pot, 6000)
  assert.equal(sum.diff, 0)
  const lb = leaderboard([s], players)
  assert.equal(lb[0].name, 'B')
  assert.equal(lb[0].net, 3000)
  assert.equal(lb[1].net, -3000)
  assert.equal(feedItems(s, players).length, 5)
  const txt = recapText(s, players)
  assert.match(txt, /A pays B \$30/)
})

test('migrate converts v1 entries to events', () => {
  const old = {
    players,
    sessions: [{
      id: 's', date: '2026-11-17', status: 'closed', defaultBuyIn: 2000, playerIds: ['a', 'b'], closedAt: 5,
      entries: {
        a: { buyins: [{ amt: 2000, ts: 1 }], cashout: 500 },
        b: { buyins: [{ amt: 2000, ts: 2 }], cashout: 3500 },
      },
    }],
  }
  const m = migrate(old)
  assert.equal(m.sessions[0].entries, undefined)
  const sum = summarize(m.sessions[0], players)
  assert.equal(sum.pot, 4000)
  assert.equal(sum.diff, 0)
  assert.deepEqual(migrate(m), m) // idempotent
})
