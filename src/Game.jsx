import { useEffect, useMemo, useRef, useState } from 'react'
import {
  uid, toCents, fmt, fmtShortDate, summarize, feedItems,
  logBuyIn, logCashOut, removeEvent,
} from './lib.js'
import { Sheet, NewName, DollarInput, Feed } from './ui.jsx'

const centsStr = (c) => String(c / 100)

/* ---------- one player tile ---------- */

function Tile({ row, mode, defaultBuyIn, flash, onTap, onMore }) {
  const held = useRef(false)
  const timer = useRef(null)
  const done = row.out != null

  const down = () => {
    held.current = false
    timer.current = setTimeout(() => { held.current = true; onMore() }, 450)
  }
  const clear = () => clearTimeout(timer.current)
  const click = () => {
    if (held.current) { held.current = false; return }
    onTap()
  }
  const cta = done ? 'Edit' : mode === 'buy' ? `+ ${fmt(defaultBuyIn)}` : 'Cash out'

  return (
    <div className={'tile' + (done ? ' done' : '') + (flash ? ' flash' : '')}>
      <button className="tile-main" aria-label={`${row.name}: ${cta}`}
        onPointerDown={down} onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()} onClick={click}>
        <span className="tile-top">
          <b>{row.name}</b>
          <span className="muted small">{done ? 'Cashed out' : `${row.count} buy-in${row.count === 1 ? '' : 's'}`}</span>
        </span>
        <span className="tile-mid">
          <span className={'tile-amt' + (done ? (row.net > 0 ? ' up' : row.net < 0 ? ' down' : '') : '')}>
            {done ? fmt(row.net, true) : fmt(row.in)}
          </span>
          <span className="muted small">{done ? `in ${fmt(row.in)} · out ${fmt(row.out)}` : 'in'}</span>
        </span>
        <span className="cta">{cta}</span>
      </button>
      <button className="tile-more" aria-label={`Other amounts for ${row.name}`} onClick={onMore}>⋯</button>
    </div>
  )
}

/* ---------- "who / what" entry sheet ---------- */

function EntrySheet({ session, sum, initial, onClose, onBuyIn, onCashOut }) {
  const [pid, setPid] = useState(initial.pid)
  const [tab, setTab] = useState(initial.tab)
  const [amt, setAmt] = useState('')
  const row = sum.rows.find((r) => r.id === pid)

  // Sensible default whenever the player or the action changes.
  useEffect(() => {
    setAmt(tab === 'buy' ? centsStr(session.defaultBuyIn) : row?.out != null ? centsStr(row.out) : '')
  }, [pid, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const c = toCents(amt)
  const valid = c != null && (tab === 'buy' ? c > 0 : c >= 0)
  const quick = [...new Set([session.defaultBuyIn, 5000, 10000])].sort((a, b) => a - b)
  // Money not yet claimed by anyone else: the "books balance" amount for this player.
  const balance = sum.pot - (sum.out - (row?.out ?? 0))
  const submit = () => {
    if (!valid) return
    if (tab === 'buy') onBuyIn(pid, c)
    else onCashOut(pid, c)
  }

  return (
    <Sheet label="Log an entry" onClose={onClose}>
      <div className="label">WHO</div>
      <div className="chips tight">
        {sum.rows.map((r) => (
          <button key={r.id} className={'chip' + (r.id === pid ? ' on' : '')} aria-pressed={r.id === pid} onClick={() => setPid(r.id)}>{r.name}</button>
        ))}
      </div>

      <div className="label">WHAT</div>
      <div className="seg">
        <button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>Buy-in</button>
        <button className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>Cash out</button>
      </div>

      {tab === 'buy' ? (
        <>
          <div className="chips tight">
            {quick.map((q) => (
              <button key={q} className={'chip' + (c === q ? ' on' : '')} onClick={() => setAmt(centsStr(q))}>{fmt(q)}</button>
            ))}
          </div>
          <DollarInput value={amt} onChange={setAmt} placeholder="other amount" onEnter={submit} />
        </>
      ) : (
        <>
          <DollarInput value={amt} onChange={setAmt} placeholder="amount cashing out" onEnter={submit} autoFocus />
          <div className="row between">
            <span className="muted small">In {fmt(row.in)} · Net {c != null ? fmt(c - row.in, true) : '—'}</span>
            {balance >= 0 && <button className="chip" onClick={() => setAmt(centsStr(balance))}>Fill {fmt(balance)}</button>}
          </div>
        </>
      )}

      <button className="primary" disabled={!valid} onClick={submit}>
        {tab === 'buy' ? `Log ${row.name}: buy-in ${valid ? fmt(c) : ''}` : `Log ${row.name}: cash out ${valid ? fmt(c) : ''}`}
      </button>
    </Sheet>
  )
}

/* ---------- the night in progress ---------- */

export default function Game({ data, session, update, onDone }) {
  const sum = useMemo(() => summarize(session, data.players), [session, data.players])
  const feed = useMemo(() => feedItems(session, data.players), [session, data.players])
  const [mode, setMode] = useState('buy')
  const [sheet, setSheet] = useState(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const [flash, setFlash] = useState(null)
  const toastTimer = useRef(null)
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const mod = (fn) => update((d) => fn(d.sessions.find((s) => s.id === session.id)))
  const nameOf = (pid) => data.players.find((p) => p.id === pid)?.name ?? ''
  const bench = data.players.filter((p) => !session.playerIds.includes(p.id))

  const notify = (text, undoId) => {
    setToast({ text, undoId })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }
  const flashTile = (pid) => {
    setFlash(pid)
    setTimeout(() => setFlash((f) => (f === pid ? null : f)), 350)
  }

  const buyIn = (pid, amt) => {
    const id = uid()
    mod((s) => logBuyIn(s, pid, amt, id))
    flashTile(pid)
    notify(`${nameOf(pid)} +${fmt(amt)}`, id)
  }
  const cashOut = (pid, amt) => {
    const id = uid()
    mod((s) => logCashOut(s, pid, amt, id))
    flashTile(pid)
    notify(`${nameOf(pid)} cashed out ${fmt(amt)}`, id)
  }
  const undo = (id) => {
    mod((s) => removeEvent(s, id))
    setToast(null)
  }

  const tap = (row) => {
    if (row.out == null && mode === 'buy') buyIn(row.id, session.defaultBuyIn)
    else setSheet({ pid: row.id, tab: 'out' })
  }
  const more = (row) => setSheet({ pid: row.id, tab: row.out != null || mode === 'out' ? 'out' : 'buy' })

  const joinPlayer = (id) => {
    mod((s) => { s.playerIds.push(id); logBuyIn(s, id, s.defaultBuyIn) })
    setAdding(false)
  }
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
      logBuyIn(s, id, s.defaultBuyIn)
    })
    setAdding(false)
  }

  const ready = sum.pending.length === 0 && session.playerIds.length > 0
  const endNight = () => {
    if (!ready) return
    if (sum.diff !== 0) {
      const msg = sum.diff > 0
        ? `Cash-outs are ${fmt(sum.diff)} LESS than the money bought in. End the night anyway?`
        : `Cash-outs are ${fmt(-sum.diff)} MORE than the money bought in. End the night anyway?`
      if (!window.confirm(msg)) return
    }
    mod((s) => { s.status = 'closed'; s.closedAt = Date.now() })
    onDone()
  }
  const discard = () => {
    if (window.confirm("Discard tonight's game and everything entered?")) {
      update((d) => { d.sessions = d.sessions.filter((s) => s.id !== session.id) })
    }
  }

  const status = !ready
    ? { cls: 'muted', text: `Waiting on cash-out: ${sum.pending.map((r) => r.name).join(', ')}` }
    : sum.diff !== 0
      ? { cls: 'warn', text: `Books off by ${fmt(Math.abs(sum.diff))} (${sum.diff > 0 ? 'cash-outs too low' : 'cash-outs too high'})` }
      : { cls: 'ok', text: 'Books balance ✓ Ready to settle up' }

  return (
    <>
      <section className="hero">
        <div className="row between">
          <div className="eyebrow">{fmtShortDate(session.date).toUpperCase()} · {session.playerIds.length} PLAYERS{session.title ? ` · ${session.title.toUpperCase()}` : ''}</div>
          <button className={'btn' + (ready ? ' go' : '')} disabled={!ready} onClick={endNight}>End night</button>
        </div>
        <div className="pot">{fmt(sum.pot)}</div>
        <div className="muted">in the pot · {fmt(sum.diff)} still on the table</div>
      </section>

      <div className="seg big" role="group" aria-label="Tap action">
        <button className={mode === 'buy' ? 'on' : ''} onClick={() => setMode('buy')}>Buy-in</button>
        <button className={mode === 'out' ? 'on' : ''} onClick={() => setMode('out')}>Cash out</button>
      </div>

      <div className="tiles">
        {sum.rows.map((r) => (
          <Tile key={r.id} row={r} mode={mode} defaultBuyIn={session.defaultBuyIn} flash={flash === r.id}
            onTap={() => tap(r)} onMore={() => more(r)} />
        ))}
        <button className="tile add" onClick={() => setAdding(true)}>+ Add player</button>
      </div>
      <p className="hint">
        {mode === 'buy'
          ? <>Tap a tile to add <b>{fmt(session.defaultBuyIn)}</b>. Hold it, or tap ⋯, for other amounts.</>
          : <>Tap a tile to enter that player's cash-out.</>}
      </p>

      <section className="card">
        <h3>Activity</h3>
        <Feed items={feed} onUndo={(id) => mod((s) => removeEvent(s, id))} />
      </section>
      <div className="center"><button className="link danger" onClick={discard}>Discard this game</button></div>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          <button className="link" onClick={() => undo(toast.undoId)}>Undo</button>
        </div>
      )}

      <div className="bar">
        <div className={'bar-status ' + status.cls}>{status.text}</div>
        <button className="link" disabled={!feed.length} onClick={() => undo(feed[0].id)}>Undo last</button>
      </div>

      {sheet && (
        <EntrySheet session={session} sum={sum} initial={sheet} onClose={() => setSheet(null)}
          onBuyIn={(pid, amt) => { buyIn(pid, amt); setSheet(null) }}
          onCashOut={(pid, amt) => { cashOut(pid, amt); setSheet(null) }} />
      )}

      {adding && (
        <Sheet label="Add a player" onClose={() => setAdding(false)}>
          <div className="sheet-title">Add a player</div>
          {bench.length > 0 && (
            <div className="chips tight">
              {bench.map((p) => <button key={p.id} className="chip" onClick={() => joinPlayer(p.id)}>+ {p.name}</button>)}
            </div>
          )}
          <NewName onAdd={newPlayer} />
          <p className="muted small">New players start with one standard buy-in ({fmt(session.defaultBuyIn)}).</p>
        </Sheet>
      )}
    </>
  )
}
