import { useMemo, useState } from 'react'
import { uid, today, fmt, leaderboard, migrate } from './lib.js'

export default function Leaders({ data, update, setData }) {
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
        if (!Array.isArray(j.players) || !Array.isArray(j.sessions)) throw new Error('bad shape')
        if (window.confirm('Replace all current data with this backup?')) setData(migrate(j))
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
          <div className="scroll">
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
          </div>
        ) : <p className="muted">Finish a game to see standings.</p>}
      </section>

      <section className="card">
        <h2>Roster</h2>
        <div className="chips">
          {data.players.map((p) => (
            <span key={p.id} className="chip static">
              {p.name}
              {!used(p.id) && (
                <button className="x" aria-label={`Remove ${p.name}`}
                  onClick={() => update((d) => { d.players = d.players.filter((x) => x.id !== p.id) })}>×</button>
              )}
            </span>
          ))}
          {!data.players.length && <p className="muted">No players yet.</p>}
        </div>
        <div className="row">
          <input placeholder="Add player" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()} autoCapitalize="words" />
          <button className="btn" onClick={addPlayer}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">Data lives in this browser. Export a backup now and then, or to move to another device.</p>
        <div className="row">
          <button className="btn" onClick={exportJson}>Export JSON</button>
          <label className="btn filebtn">Import JSON<input type="file" accept="application/json" onChange={importJson} /></label>
        </div>
      </section>
    </>
  )
}
