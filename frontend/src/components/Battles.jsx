import { useState, useEffect } from 'react'
import api from '../utils/api'

function Battles({ onDeleted }) {
  const [battles, setBattles] = useState(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    api('/api/battles').then((data) => {
      setBattles(data.battles || [])
      if (data.retentionDays) setDays(data.retentionDays)
    })
  }, [])

  const remove = async (id) => {
    if (!window.confirm('Delete this battle and its screenshot?')) return
    await api(`/api/battles/${id}`, { method: 'DELETE' })
    setBattles((list) => list.filter((b) => b.id !== id))
    if (onDeleted) onDeleted()
  }

  return (
    <div className="card">
      <h3>My battles</h3>
      <p className="account-hint">Battles are kept for the last {days} days.</p>
      {battles === null && <p>Loading…</p>}
      {battles && battles.length === 0 && <p>No saved battles yet.</p>}
      {battles && battles.map((b) => (
        <div key={b.id} className="battle-entry">
          <div className="battle-head">
            <strong>{b.title}</strong>
            <span className="account-hint">{new Date(b.created_at).toLocaleString()}</span>
          </div>
          <details>
            <summary>Ranking</summary>
            <ol>
              {(b.items || []).map((it) => <li key={it.rank}>{it.name}</li>)}
            </ol>
          </details>
          <div className="share-area">
            <a className="ghost" href={`/results/${b.image}`} target="_blank" rel="noopener noreferrer">
              Open screenshot
            </a>
            <button className="ghost danger" onClick={() => remove(b.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Battles
