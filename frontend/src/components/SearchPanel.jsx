import { useState } from 'react'
import SearchColumn from './SearchColumn'

function SearchPanel({ onSelectAlbum, user, tokenStatus }) {
  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: '20px',
          position: 'relative',
        }}
      >
        <SearchColumn type="album" onSelect={onSelectAlbum} disabled={!tokenStatus} defaultQuery="Taylor Swift" />
      </div>
      {!tokenStatus && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)' }}>
          No function available - No valid Spotify token
        </div>
      )}
    </div>
  )
}

export default SearchPanel
