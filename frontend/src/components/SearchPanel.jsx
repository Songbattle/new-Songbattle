import { useState } from 'react'
import SearchColumn from './SearchColumn'

function SearchPanel({ onSelectAlbum, user, tokenStatus, showIntro, loginInfo }) {
  const getInfoStyle = () => {
    if (!loginInfo) return {}
    
    const baseStyle = {
      marginBottom: '20px',
      padding: '16px',
      borderRadius: '8px',
      textAlign: 'center',
      fontSize: '14px',
      lineHeight: '1.6'
    }
    
    if (loginInfo.type === 'success') {
      return { ...baseStyle, background: 'rgba(29, 185, 84, 0.1)', color: '#1db954' }
    } else if (loginInfo.type === 'info') {
      return { ...baseStyle, background: 'rgba(255, 165, 0, 0.1)', color: '#ffa500' }
    } else if (loginInfo.type === 'warning') {
      return { ...baseStyle, background: 'rgba(255, 69, 58, 0.1)', color: '#ff453a' }
    }
    return baseStyle
  }
  
  return (
    <div className="card">
      {loginInfo && (
        <div style={getInfoStyle()}>
          {loginInfo.message}
        </div>
      )}
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
        <SearchColumn type="album" onSelect={onSelectAlbum} disabled={!tokenStatus} initialSearchQuery="Taylor Swift" initialLimit={5} />
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
