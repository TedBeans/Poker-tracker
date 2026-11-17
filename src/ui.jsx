import { useEffect, useState } from 'react'
import { fmt } from './lib.js'

// Bottom sheet with a dimmed backdrop. Tap outside or press Escape to close.
export function Sheet({ label, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  )
}

export function NewName({ placeholder = 'New player name', onAdd }) {
  const [name, setName] = useState('')
  const go = () => {
    if (name.trim()) { onAdd(name.trim()); setName('') }
  }
  return (
    <div className="row">
      <input placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()} autoCapitalize="words" />
      <button className="btn" onClick={go}>Add</button>
    </div>
  )
}

export function DollarInput({ value, onChange, placeholder, onEnter, autoFocus }) {
  return (
    <div className="dollar">
      <span>$</span>
      <input inputMode="decimal" placeholder={placeholder} value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} />
    </div>
  )
}

// Activity log, newest first. `onUndo` makes each row removable.
export function Feed({ items, onUndo, limit = 8 }) {
  const [all, setAll] = useState(false)
  if (!items.length) return <p className="muted pad">Nothing logged yet.</p>
  const shown = all ? items : items.slice(0, limit)
  return (
    <div className="feed">
      {shown.map((it) => (
        <div className="feed-row" key={it.id}>
          <i className={'dotk ' + it.tone} />
          <div className="feed-main">
            <div className="feed-text">{it.text}</div>
            {it.time && <div className="muted small">{it.time}</div>}
          </div>
          <div className={'feed-amt ' + it.tone}>{it.amount}</div>
          {onUndo && <button className="link" aria-label={`Undo: ${it.text}`} onClick={() => onUndo(it.id)}>undo</button>}
        </div>
      ))}
      {items.length > limit && (
        <button className="link wide" onClick={() => setAll((a) => !a)}>
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )
}

// Table of a finished (or in-progress) night.
export function ResultsTable({ rows }) {
  const sorted = [...rows].sort((a, b) => (b.net ?? 0) - (a.net ?? 0))
  return (
    <table>
      <thead><tr><th>Player</th><th>In</th><th>Out</th><th>Net</th></tr></thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{fmt(r.in)}</td>
            <td>{r.out == null ? '—' : fmt(r.out)}</td>
            <td className={r.net > 0 ? 'up' : r.net < 0 ? 'down' : ''}>{r.net == null ? '—' : fmt(r.net, true)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
