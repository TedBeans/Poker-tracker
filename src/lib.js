// All money is stored as integer cents to avoid floating point drift.
// A session is an event log: { id, date, title, status, defaultBuyIn, playerIds, events: [{ id, pid, type, amt, ts }] }
// where type is 'buyin' or 'cashout'. Everything else (totals, nets, feed) is derived from the events.
export const uid = () => Math.random().toString(36).slice(2, 10)

export const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const toCents = (s) => {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

export const fmt = (cents, signed = false) => {
  const sign = cents < 0 ? '-' : signed && cents > 0 ? '+' : ''
  const v = Math.abs(cents) / 100
  const str = v.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${sign}$${str}`
}

export const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export const fmtShortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

/* ---------- migration: v1 sessions stored per-player `entries` ---------- */

export function migrate(data) {
  const players = Array.isArray(data?.players) ? data.players : []
  const sessions = (Array.isArray(data?.sessions) ? data.sessions : []).map((s) => {
    if (Array.isArray(s.events)) return s
    const events = []
    for (const pid of s.playerIds || []) {
      const e = s.entries?.[pid]
      if (!e) continue
      for (const b of e.buyins || []) events.push({ id: uid(), pid, type: 'buyin', amt: b.amt, ts: b.ts || 0 })
      if (e.cashout != null) events.push({ id: uid(), pid, type: 'cashout', amt: e.cashout, ts: s.closedAt || 0 })
    }
    const { entries, ...rest } = s // eslint-disable-line no-unused-vars
    return { ...rest, events }
  })
  return { players, sessions }
}

/* ---------- mutating helpers: call on a draft session ---------- */

export function logBuyIn(s, pid, amt, id = uid()) {
  s.events.push({ id, pid, type: 'buyin', amt, ts: Date.now() })
  return id
}

// A player has one cash-out: logging again replaces the previous one.
export function logCashOut(s, pid, amt, id = uid()) {
  s.events = s.events.filter((e) => !(e.pid === pid && e.type === 'cashout'))
  s.events.push({ id, pid, type: 'cashout', amt, ts: Date.now() })
  return id
}

export function removeEvent(s, id) {
  s.events = s.events.filter((e) => e.id !== id)
}

/* ---------- derived values ---------- */

export function entryOf(session, pid) {
  const evs = session.events.filter((e) => e.pid === pid)
  const buyins = evs.filter((e) => e.type === 'buyin')
  const last = evs.filter((e) => e.type === 'cashout').slice(-1)[0]
  return { buyins, cashout: last ? last.amt : null }
}

export const totalIn = (entry) => (entry?.buyins || []).reduce((s, b) => s + b.amt, 0)
export const netOf = (entry) =>
  entry && entry.cashout != null ? entry.cashout - totalIn(entry) : null

// Per-player rows plus pot / cash-out totals for one session.
export function summarize(session, players) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const rows = session.playerIds.map((id) => {
    const e = entryOf(session, id)
    return { id, name: nameOf(id), count: e.buyins.length, in: totalIn(e), out: e.cashout, net: netOf(e) }
  })
  const pot = rows.reduce((s, r) => s + r.in, 0)
  const out = rows.reduce((s, r) => s + (r.out ?? 0), 0)
  const pending = rows.filter((r) => r.out == null)
  return { rows, pot, out, diff: pot - out, pending }
}

// Newest-first activity feed.
export function feedItems(session, players) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  return session.events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.ts - a.e.ts || b.i - a.i)
    .map(({ e }) => {
      if (e.type === 'buyin') {
        return { id: e.id, text: `${nameOf(e.pid)} bought in`, amount: `+${fmt(e.amt)}`, tone: 'in', time: fmtTime(e.ts) }
      }
      const net = e.amt - totalIn(entryOf(session, e.pid))
      return {
        id: e.id,
        text: `${nameOf(e.pid)} cashed out · net ${fmt(net, true)}`,
        amount: fmt(e.amt),
        tone: net > 0 ? 'up' : net < 0 ? 'down' : 'flat',
        time: fmtTime(e.ts),
      }
    })
}

// Fewest-ish payments to settle: greedy match of biggest debtor to biggest creditor.
export function settle(rows) {
  const cr = rows.filter((r) => r.net > 0).map((r) => ({ name: r.name, amt: r.net })).sort((a, b) => b.amt - a.amt)
  const db = rows.filter((r) => r.net < 0).map((r) => ({ name: r.name, amt: -r.net })).sort((a, b) => b.amt - a.amt)
  const out = []
  let i = 0, j = 0
  while (i < db.length && j < cr.length) {
    const x = Math.min(db[i].amt, cr[j].amt)
    out.push({ from: db[i].name, to: cr[j].name, amt: x })
    db[i].amt -= x
    cr[j].amt -= x
    if (db[i].amt === 0) i++
    if (cr[j].amt === 0) j++
  }
  return out
}

// Plain-text recap to paste into a group chat.
export function recapText(session, players) {
  const sum = summarize(session, players)
  const rows = [...sum.rows].sort((a, b) => (b.net ?? 0) - (a.net ?? 0))
  const lines = [`Poker night ${fmtShortDate(session.date)}${session.title ? ` (${session.title})` : ''}`, '']
  for (const r of rows) lines.push(`${r.name}: ${r.net == null ? '—' : fmt(r.net, true)}`)
  const pay = settle(rows)
  if (pay.length) {
    lines.push('', 'Settle up:')
    for (const p of pay) lines.push(`${p.from} pays ${p.to} ${fmt(p.amt)}`)
  }
  return lines.join('\n')
}

// All-time stats across closed sessions.
export function leaderboard(sessions, players) {
  const map = new Map(players.map((p) => [p.id, { id: p.id, name: p.name, nights: 0, net: 0, in: 0, best: null, worst: null, wins: 0 }]))
  for (const s of sessions.filter((x) => x.status === 'closed')) {
    for (const id of s.playerIds) {
      const e = entryOf(s, id)
      const net = netOf(e)
      if (net == null || !map.has(id)) continue
      const r = map.get(id)
      r.nights++
      r.net += net
      r.in += totalIn(e)
      r.best = r.best == null ? net : Math.max(r.best, net)
      r.worst = r.worst == null ? net : Math.min(r.worst, net)
      if (net > 0) r.wins++
    }
  }
  return [...map.values()].filter((r) => r.nights > 0).sort((a, b) => b.net - a.net)
}
