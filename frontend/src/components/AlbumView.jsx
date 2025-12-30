import { useState } from 'react'

function AlbumView({ album, tracks, onBack, votingActive }) {
  const [showTracks, setShowTracks] = useState(false)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>{album.name}</h2>
        <div>
          <button className="ghost" onClick={onBack}>
            Back to Search
          </button>
        </div>
      </div>

      <div className="card tracks" style={{ marginTop: '14px' }}>
        <div>{tracks.length} Tracks</div>
        <div style={{ marginTop: '8px' }}>
          <button
            className="ghost"
            onClick={() => setShowTracks(!showTracks)}
          >
            {showTracks ? 'Hide tracks' : 'Show tracks'}
          </button>
        </div>
        {showTracks && (
          <div style={{ marginTop: '8px' }}>
            {tracks.map((t) => (
              <div key={t.id} className="track">
                {t.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {tracks.length < 2 && (
        <div style={{ marginTop: '14px', color: 'var(--muted)' }}>
          Not enough tracks to vote.
        </div>
      )}
    </div>
  )
}

export default AlbumView
