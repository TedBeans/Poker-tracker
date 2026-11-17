import { useEffect, useMemo, useState } from 'react'
import { uid, today, toCents, fmt, fmtDate, totalIn, summarize, settle, leaderboard } from './lib.js'

const KEY = 'poker-tracker-v1'
const EMPTY = { players: [], sessions: [] }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('tonight')

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* storage full or blocked */ }
  }, [data])

  // Immutable-update helper: mutate a deep copy, then save.
  const update = (fn) =>
    setData((d) => {
      const copy = structuredClone(d)
      fn(copy)
      return copy
    })

  const active = data.sessions.find((s) => s.status === 'active')

  return (
    <div className="app">
      <header>
        <h1>♠ Poker Night</h1>
        <nav>
          {[['tonight', 'Tonight'], ['history', 'History'], ['leaders', 'Leaders']].map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
              {k === 'tonight' && active ? <i className="dot" /> : null}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'tonight' &&
          (active ? (
            <Game data={data} session={active} update={update} onDone={() => setTab('history')} />
          ) : (
            <Setup data={data} update={update} />
          ))}
        {tab === 'history' && <History data={data} update={update} />}
        {tab === 'leaders' && <Leaders data={data} update={update} setData={setData} />}
      </main>
    </div>
  )
}

/* ---------- Start a night ---------- */

function PlayerPicker({ players, selected, onToggle, onAdd }) {
  const [name, setName] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n) return
    onAdd(n)
    setName('')
  }
  return (
    <>
      <div className="chips">
        {players.map((p) => (
          <button key={p.id} className={'chip' + (selected.includes(p.id) ? ' on' : '')} onClick={() => onToggle(p.id)}>
            {selected.includes(p.id) ? '✓ ' : ''}{p.name}
          </button>
        ))}
        {!players.length && <p className="muted">No players yet — add everyone below.</p>}
      </div>
      <div className="row">
        <input placeholder="Add new player" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add}>Add</button>
      </div>
    </>
  )
}

function Setup({ data, update }) {
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [buyIn, setBuyIn] = useState('20')
  const [selected, setSelected] = useState([])
  const [startWithBuyIn, setStartWithBuyIn] = useState(true)

  const addPlayer = (name) => {
    const existing = data.players.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setSelected((s) => (s.includes(existing.id) ? s : [...s, existing.id]))
      return
    }
    const id = uid()
    update((d) => d.players.push({ id, name }))
    setSelected((s) => [...s, id])
  }

  const start = () => {
    const cents = toCents(buyIn)
    if (!selected.length || !cents || cents <= 0) return
    update((d) => {
      const entries = {}
      for (const id of selected) {
        entries[id] = { buyins: startWithBuyIn ? [{ amt: cents, ts: Date.now() }] : [], cashout: null }
      }
      d.sessions.push({
        id: uid(), date, title: title.trim(), status: 'active',
        defaultBuyIn: cents, playerIds: selected, entries,
      })
    })
  }

  return (
    <section className="card">
      <h2>Start tonight's game</h2>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Game name <span className="muted">(optional)</span>
        <input placeholder="e.g. Teddy's place, $1/$2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>Standard buy-in
        <div className="dollar"><span>$</span>
          <input inputMode="decimal" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
        </div>
      </label>
      <label className="check">
        <input type="checkbox" checked={startWithBuyIn} onChange={(e) => setStartWithBuyIn(e.target.checked)} />
        Record a starting buy-in for everyone
      </label>
      <h3>Who's playing? <span className="muted">{selected.length} selected</span></h3>
      <PlayerPicker
        players={data.players}
        selected={selected}
        onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        onAdd={addPlayer}
      />
      <button className="primary" disabled={!selected.length || !(toCents(buyIn) > 0)} onClick={start}>
        Deal me in ({selected.length})
      </button>
    </section>
  )
}

/* ---------- Game in progress ---------- */

function PlayerCard({ player, entry, defaultBuyIn, onBuyIn, onUndo, onCashOut, onRemove }) {
  const [custom, setCustom] = useState('')
  const [out, setOut] = useState('')
  const [editing, setEditing] = useState(false)
  const inn = totalIn(entry)
  const done = entry.cashout != null && !editing
  const net = entry.cashout != null ? entry.cashout - inn : null

  const addCustom = () => {
    const c = toCents(custom)
    if (c > 0) { onBuyIn(c); setCustom('') }
  }
  const saveOut = () => {
    const c = toCents(out)
    if (c == null || c < 0) return
    onCashOut(c)
    setEditing(false)
    setOut('')
  }

  return (
    <div className={'card player' + (done ? ' done' : '')}>
      <div className="row between">
        <h3>{player.name}</h3>
        <div className="in">In <b>{fmt(inn)}</b></div>
      </div>

      <div className="buyins">
        {entry.buyins.length ? entry.buyins.map((b, i) => <span key={i} className="pill">{fmt(b.amt)}</span>) : <span className="muted">No buy-ins yet</span>}
        {entry.buyins.length > 0 && entry.cashout == null && (
          <button className="link" onClick={onUndo}>undo</button>
        )}
      </div>

      {entry.cashout == null || editing ? (
        <>
          <div className="row">
            <button className="rebuy" onClick={() => onBuyIn(defaultBuyIn)}>+ {fmt(defaultBuyIn)}</button>
            <div className="dollar grow"><span>$</span>
              <input inputMode="decimal" placeholder="other" value={custom}
                onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
            </div>
            <button onClick={addCustom}>Add</button>
          </div>
          <div className="row">
            <div className="dollar grow"><span>$</span>
              <input inputMode="decimal" placeholder="cash out amount" value={out}
                onChange={(e) => setOut(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveOut()} />
            </div>
            <button className="cash" onClick={saveOut}>Cash out</button>
          </div>
          <div className="row between">
            {entry.buyins.length === 0 && <button className="link danger" onClick={onRemove}>remove from game</button>}
            {editing && <button className="link" onClick={() => setEditing(false)}>cancel</button>}
          </div>
        </>
      ) : (
        <div className="row between">
          <div>Out <b>{fmt(entry.cashout)}</b></div>
          <div className={'net ' + (net > 0 ? 'up' : net < 0 ? 'down' : '')}>{fmt(net, true)}</div>
          <button className="link" onClick={() => { setOut(String(entry.cashout / 100)); setEditing(true) }}>edit</button>
        </div>
      )}
    </div>
  )
}

function Game({ data, session, update, onDone }) {
  const sum = useMemo(() => summarize(session, data.players), [session, data.players])
  const [adding, setAdding] = useState(false)

  const mod = (fn) => update((d) => fn(d.sessions.find((s) => s.id === session.id)))
  const bench = data.players.filter((p) => !session.playerIds.includes(p.id))

  const joinPlayer = (id) =>
    mod((s) => {
      s.playerIds.push(id)
      s.entries[id] = { buyins: [{ amt: s.defaultBuyIn, ts: Date.now() }], cashout: null }
    })
  const newPlayer = (name) => {
    const existing = data.players.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!session.playerIds.includes(existing.id)) joinPlayer(existing.id)
      return
    }
    const id = uid()
    update((d) => {
      d.players.push({ id, name })
      const s = d.sessions.find((x) => x.id === session.id)
      s.playerIds.push(id)
      s.entries[id] = { buyins: [{ amt: s.defaultBuyIn, ts: Date.now() }], cashout: null }
    })
  }

  const endNight = () => {
    if (sum.pending.length) return
    if (sum.diff !== 0) {
      const msg = sum.diff > 0
        ? `Cash-outs are ${fmt(sum.diff)} LESS than the money bought in. End the night anyway?`
        : `Cash-outs are ${fmt(-sum.diff)} MORE than the money bought in. End the night anyway?`
      if (!window.confirm(msg)) return
    }
    mod((s) => { s.status = 'closed'; s.closedAt = Date.now() })
    onDone()
  }

  const cancelNight = () => {
    if (window.confirm('Discard tonight\'s game and everything entered?')) {
      update((d) => { d.sessions = d.sessions.filter((s) => s.id !== session.id) })
    }
  }

  return (
    <>
      <section className="card head">
        <div className="row between">
          <div>
            <h2>{session.title || 'Tonight'}</h2>
            <div className="muted">{fmtDate(session.date)}</div>
          </div>
          <button className="link danger" onClick={cancelNight}>discard</button>
        </div>
        <div className="stats">
          <div><span>Players</span><b>{session.playerIds.length}</b></div>
          <div><span>Total bought in</span><b>{fmt(sum.pot)}</b></div>
          <div><span>Still on table</span><b>{fmt(sum.diff)}</b></div>
        </div>
      </section>

      {session.playerIds.map((id) => {
        const player = data.players.find((p) => p.id === id)
        const entry = session.entries[id]
        if (!player || !entry) return null
        return (
          <PlayerCard key={id} player={player} entry={entry} defaultBuyIn={session.defaultBuyIn}
            onBuyIn={(amt) => mod((s) => s.entries[id].buyins.push({ amt, ts: Date.now() }))}
            onUndo={() => mod((s) => s.entries[id].buyins.pop())}
            onCashOut={(c) => mod((s) => { s.entries[id].cashout = c })}
            onRemove={() => mod((s) => { s.playerIds = s.playerIds.filter((x) => x !== id); delete s.entries[id] })}
          />
        )
      })}

      <section className="card">
        <button className="link" onClick={() => setAdding((a) => !a)}>{adding ? '− hide' : '+ add a player mid-game'}</button>
        {adding && (
          <>
            <div className="chips">
              {bench.map((p) => <button key={p.id} className="chip" onClick={() => joinPlayer(p.id)}>+ {p.name}</button>)}
            </div>
            <NewName onAdd={newPlayer} />
            <p className="muted">New players start with one standard buy-in ({fmt(session.defaultBuyIn)}).</p>
          </>
        )}
      </section>

      <section className="card end">
        {sum.pending.length > 0 ? (
          <p className="muted">Waiting on cash-out: {sum.pending.map((r) => r.name).join(', ')}</p>
        ) : sum.diff !== 0 ? (
          <p className="warn">Books are off by {fmt(Math.abs(sum.diff))} ({sum.diff > 0 ? 'cash-outs too low' : 'cash-outs too high'}). Double-check amounts.</p>
        ) : (
          <p className="ok">Books balance. ✓</p>
        )}
        <button className="primary" disabled={sum.pending.length > 0} onClick={endNight}>End night &amp; settle up</button>
      </section>
    </>
  )
}

function NewName({ onAdd }) {
  const [name, setName] = useState('')
  const go = () => { if (name.trim()) { onAdd(name.trim()); setName('') } }
  return (
    <div className="row">
      <input placeholder="New player name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      <button onClick={go}>Add</button>
    </div>
  )
}

/* ---------- History ---------- */

function SessionDetail({ session, players }) {
  const sum = summarize(session, players)
  const rows = [...sum.rows].sort((a, b) => (b.net ?? 0) - (a.net ?? 0))
  const pay = settle(rows)
  return (
    <div className="detail">
      <table>
        <thead><tr><th>Player</th><th>In</th><th>Out</th><th>Net</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{fmt(r.in)}</td><td>{r.out == null ? '—' : fmt(r.out)}</td>
              <td className={r.net > 0 ? 'up' : r.net < 0 ? 'down' : ''}>{r.net == null ? '—' : fmt(r.net, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sum.diff !== 0 && sum.pending.length === 0 && <p className="warn">Books were off by {fmt(Math.abs(sum.diff))} when closed.</p>}
      <h4>Settle up</h4>
      {pay.length ? (
        <ul className="pay">
          {pay.map((p, i) => <li key={i}><b>{p.from}</b> pays <b>{p.to}</b> <span>{fmt(p.amt)}</span></li>)}
        </ul>
      ) : <p className="muted">Nobody owes anything.</p>}
    </div>
  )
}

function History({ data, update }) {
  const [open, setOpen] = useState(null)
  const closed = data.sessions.filter((s) => s.status === 'closed').sort((a, b) => b.date.localeCompare(a.date) || b.closedAt - a.closedAt)

  // Open the latest night by default so the settle-up is right there after ending.
  useEffect(() => { if (closed.length && open === null) setOpen(closed[0].id) }, []) // eslint-disable-line

  if (!closed.length) return <section className="card"><p className="muted">No finished games yet.</p></section>
  return closed.map((s) => {
    const sum = summarize(s, data.players)
    const top = [...sum.rows].sort((a, b) => (b.net ?? 0) - (a.net ?? 0))[0]
    const isOpen = open === s.id
    return (
      <section className="card" key={s.id}>
        <button className="session" onClick={() => setOpen(isOpen ? '' : s.id)}>
          <div>
            <b>{fmtDate(s.date)}</b>{s.title ? <span className="muted"> · {s.title}</span> : null}
            <div className="muted">{s.playerIds.length} players · pot {fmt(sum.pot)}{top && top.net > 0 ? ` · ${top.name} ${fmt(top.net, true)}` : ''}</div>
          </div>
          <span>{isOpen ? '▾' : '▸'}</span>
        </button>
        {isOpen && (
          <>
            <SessionDetail session={s} players={data.players} />
            <div className="row between">
              <button className="link" onClick={() => update((d) => { d.sessions.find((x) => x.id === s.id).status = 'active' })}
                disabled={data.sessions.some((x) => x.status === 'active')}>reopen</button>
              <button className="link danger" onClick={() => window.confirm('Delete this night permanently?') && update((d) => { d.sessions = d.sessions.filter((x) => x.id !== s.id) })}>delete</button>
            </div>
          </>
        )}
      </section>
    )
  })
}

/* ---------- Leaders + roster + backup ---------- */

function Leaders({ data, update, setData }) {
  const lb = useMemo(() => leaderboard(data.sessions, data.players), [data])
  const [name, setName] = useState('')

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `poker-tracker-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importJson = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    f.text().then((t) => {
      try {
        const j = JSON.parse(t)
        if (!Array.isArray(j.players) || !Array.isArray(j.sessions)) throw new Error()
        if (window.confirm('Replace all current data with this backup?')) setData({ players: j.players, sessions: j.sessions })
      } catch { window.alert('That file is not a valid backup.') }
    })
    e.target.value = ''
  }

  const addPlayer = () => {
    const n = name.trim()
    if (!n || data.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    update((d) => d.players.push({ id: uid(), name: n }))
    setName('')
  }
  const used = (id) => data.sessions.some((s) => s.playerIds.includes(id))

  return (
    <>
      <section className="card">
        <h2>All-time</h2>
        {lb.length ? (
          <table>
            <thead><tr><th>Player</th><th>Nights</th><th>Net</th><th>Avg</th><th>Best</th><th>Worst</th></tr></thead>
            <tbody>
              {lb.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td><td>{r.nights}</td>
                  <td className={r.net > 0 ? 'up' : r.net < 0 ? 'down' : ''}><b>{fmt(r.net, true)}</b></td>
                  <td>{fmt(Math.round(r.net / r.nights), true)}</td>
                  <td>{fmt(r.best, true)}</td><td>{fmt(r.worst, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">Finish a game to see standings.</p>}
      </section>

      <section className="card">
        <h2>Roster</h2>
        <div className="chips">
          {data.players.map((p) => (
            <span key={p.id} className="chip static">
              {p.name}
              {!used(p.id) && <button className="x" aria-label={`remove ${p.name}`} onClick={() => update((d) => { d.players = d.players.filter((x) => x.id !== p.id) })}>×</button>}
            </span>
          ))}
        </div>
        <div className="row">
          <input placeholder="Add player" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
          <button onClick={addPlayer}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">Data lives in this browser. Export a backup now and then, or to move to another device.</p>
        <div className="row">
          <button onClick={exportJson}>Export JSON</button>
          <label className="filebtn">Import JSON<input type="file" accept="application/json" onChange={importJson} /></label>
        </div>
      </section>
    </>
  )
}
