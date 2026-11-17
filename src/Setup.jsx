import { useState } from 'react'
import { uid, today, toCents, fmt } from './lib.js'
import { NewName, DollarInput } from './ui.jsx'

export default function Setup({ data, update }) {
  // Start from the last finished night: same crew, same buy-in.
  const last = [...data.sessions].filter((s) => s.status === 'closed').sort((a, b) => b.date.localeCompare(a.date) || (b.closedAt || 0) - (a.closedAt || 0))[0]
  const known = (ids) => ids.filter((id) => data.players.some((p) => p.id === id))

  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [buyIn, setBuyIn] = useState(last ? String(last.defaultBuyIn / 100) : '20')
  const [selected, setSelected] = useState(last ? known(last.playerIds) : [])
  const [startWithBuyIn, setStartWithBuyIn] = useState(true)

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

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

  const cents = toCents(buyIn)
  const ready = selected.length > 0 && cents > 0

  const start = () => {
    if (!ready) return
    update((d) => {
      const ts = Date.now()
      d.sessions.push({
        id: uid(), date, title: title.trim(), status: 'active', defaultBuyIn: cents,
        playerIds: selected,
        events: startWithBuyIn ? selected.map((pid, i) => ({ id: uid(), pid, type: 'buyin', amt: cents, ts: ts + i })) : [],
      })
    })
  }

  return (
    <section className="card">
      <h2>Start tonight's game</h2>

      <h3>Who's playing? <span className="muted">{selected.length} selected</span></h3>
      <div className="chips">
        {data.players.map((p) => (
          <button key={p.id} className={'chip' + (selected.includes(p.id) ? ' on' : '')} onClick={() => toggle(p.id)}
            aria-pressed={selected.includes(p.id)}>
            {selected.includes(p.id) ? '✓ ' : ''}{p.name}
          </button>
        ))}
        {!data.players.length && <p className="muted">No players yet. Add everyone below.</p>}
      </div>
      <NewName placeholder="Add a player" onAdd={addPlayer} />

      <div className="grid2">
        <label>Standard buy-in
          <DollarInput value={buyIn} onChange={setBuyIn} />
        </label>
        <label>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label>Game name <span className="muted">(optional)</span>
        <input placeholder="e.g. Dan's place, $1/$2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={startWithBuyIn} onChange={(e) => setStartWithBuyIn(e.target.checked)} />
        Record a starting {cents > 0 ? fmt(cents) : ''} buy-in for everyone
      </label>

      <button className="primary" disabled={!ready} onClick={start}>Deal me in ({selected.length})</button>
    </section>
  )
}
