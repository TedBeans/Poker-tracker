import { useEffect, useState } from 'react'
import { fmt, fmtDate, summarize, settle, feedItems, recapText } from './lib.js'
import { Feed, ResultsTable } from './ui.jsx'

function SessionDetail({ session, players }) {
  const [copied, setCopied] = useState(false)
  const sum = summarize(session, players)
  const pay = settle(sum.rows)

  const copy = async () => {
    const text = recapText(session, players)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this recap:', text)
    }
  }

  return (
    <div className="detail">
      <ResultsTable rows={sum.rows} />
      {sum.diff !== 0 && sum.pending.length === 0 && <p className="warn">Books were off by {fmt(Math.abs(sum.diff))} when closed.</p>}

      <h4>Settle up</h4>
      {pay.length ? (
        <ul className="pay">
          {pay.map((p, i) => <li key={i}><b>{p.from}</b> pays <b>{p.to}</b> <span>{fmt(p.amt)}</span></li>)}
        </ul>
      ) : <p className="muted">Nobody owes anything.</p>}
      <button className="btn wide" onClick={copy}>{copied ? 'Copied ✓' : 'Copy recap for the group chat'}</button>

      <h4>Activity</h4>
      <Feed items={feedItems(session, players)} limit={5} />
    </div>
  )
}

export default function History({ data, update }) {
  const [open, setOpen] = useState(null)
  const closed = data.sessions
    .filter((s) => s.status === 'closed')
    .sort((a, b) => b.date.localeCompare(a.date) || (b.closedAt || 0) - (a.closedAt || 0))

  // Open the latest night so the settle-up is right there after ending.
  useEffect(() => { if (closed.length && open === null) setOpen(closed[0].id) }, []) // eslint-disable-line

  if (!closed.length) return <section className="card"><p className="muted">No finished games yet.</p></section>

  const activeExists = data.sessions.some((x) => x.status === 'active')
  return closed.map((s) => {
    const sum = summarize(s, data.players)
    const top = [...sum.rows].sort((a, b) => (b.net ?? 0) - (a.net ?? 0))[0]
    const isOpen = open === s.id
    return (
      <section className="card" key={s.id}>
        <button className="session" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : s.id)}>
          <div>
            <b>{fmtDate(s.date)}</b>{s.title ? <span className="muted"> · {s.title}</span> : null}
            <div className="muted small">{s.playerIds.length} players · pot {fmt(sum.pot)}{top && top.net > 0 ? ` · ${top.name} ${fmt(top.net, true)}` : ''}</div>
          </div>
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
        </button>
        {isOpen && (
          <>
            <SessionDetail session={s} players={data.players} />
            <div className="row between">
              <button className="link" disabled={activeExists} title={activeExists ? 'Finish or discard tonight’s game first' : ''}
                onClick={() => update((d) => { d.sessions.find((x) => x.id === s.id).status = 'active' })}>reopen</button>
              <button className="link danger"
                onClick={() => window.confirm('Delete this night permanently?') && update((d) => { d.sessions = d.sessions.filter((x) => x.id !== s.id) })}>delete</button>
            </div>
          </>
        )}
      </section>
    )
  })
}
