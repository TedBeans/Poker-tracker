import { useEffect, useState } from 'react'
import { migrate } from './lib.js'
import Setup from './Setup.jsx'
import Game from './Game.jsx'
import History from './History.jsx'
import Leaders from './Leaders.jsx'

const KEY = 'poker-tracker-v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return migrate(raw ? JSON.parse(raw) : {})
  } catch {
    return migrate({})
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
        <h1><span aria-hidden="true">♠</span> Poker Night</h1>
        <nav>
          {[['tonight', 'Tonight'], ['history', 'History'], ['leaders', 'Leaders']].map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              {label}
              {k === 'tonight' && active ? <i className="dot" aria-label="game in progress" /> : null}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'tonight' &&
          (active
            ? <Game data={data} session={active} update={update} onDone={() => setTab('history')} />
            : <Setup data={data} update={update} />)}
        {tab === 'history' && <History data={data} update={update} />}
        {tab === 'leaders' && <Leaders data={data} update={update} setData={setData} />}
      </main>
    </div>
  )
}
