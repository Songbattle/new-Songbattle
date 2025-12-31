import { useState } from 'react'
import SearchColumn from './SearchColumn'

function SearchPanel({ onSelectAlbum, user, tokenStatus, showIntro }) {
  return (
    <div className="card">
      {showIntro && tokenStatus && (
        <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(29, 185, 84, 0.1)', borderRadius: '8px', textAlign: 'center', color: '#1db954', fontSize: '14px', lineHeight: '1.6' }}>
          <strong>Welcome to Spotify Battle!</strong><br />
          Search and select an album below to start comparing tracks and find your favorites.
        </div>
      )}
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
        <SearchColumn type="album" onSelect={onSelectAlbum} disabled={!tokenStatus} initialSearchQuery="Taylor Swift" />
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
