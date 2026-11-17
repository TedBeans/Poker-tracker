// All money is stored as integer cents to avoid floating point drift.
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

export const totalIn = (entry) => (entry?.buyins || []).reduce((s, b) => s + b.amt, 0)
export const netOf = (entry) =>
  entry && entry.cashout != null ? entry.cashout - totalIn(entry) : null

// Summarize a session: per-player rows plus pot / cash-out totals.
export function summarize(session, players) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const rows = session.playerIds.map((id) => {
    const e = session.entries[id] || { buyins: [], cashout: null }
    return { id, name: nameOf(id), in: totalIn(e), out: e.cashout, net: netOf(e) }
  })
  const pot = rows.reduce((s, r) => s + r.in, 0)
  const out = rows.reduce((s, r) => s + (r.out ?? 0), 0)
  const pending = rows.filter((r) => r.out == null)
  return { rows, pot, out, diff: pot - out, pending }
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

// All-time stats across closed sessions.
export function leaderboard(sessions, players) {
  const map = new Map(players.map((p) => [p.id, { id: p.id, name: p.name, nights: 0, net: 0, in: 0, best: null, worst: null, wins: 0 }]))
  for (const s of sessions.filter((x) => x.status === 'closed')) {
    for (const id of s.playerIds) {
      const e = s.entries[id]
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
