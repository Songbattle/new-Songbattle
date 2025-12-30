import { useState, useEffect } from 'react'
import SearchColumn from './SearchColumn'
import api from '../utils/api'

function SearchPanel({ onSelectAlbum, user }) {
  const [myPlaylists, setMyPlaylists] = useState([])
  const [myAlbums, setMyAlbums] = useState([])

  useEffect(() => {
    if (user) {
      loadMyPlaylists()
      loadMyAlbums()
    } else {
      setMyPlaylists([])
      setMyAlbums([])
    }
  }, [user])

  const loadMyPlaylists = async () => {
    try {
      const res = await api('/api/me/playlists')
      setMyPlaylists(res.items || [])
    } catch (e) {
      console.error('Failed to load playlists:', e)
    }
  }

  const loadMyAlbums = async () => {
    try {
      const res = await api('/api/me/albums')
      // Spotify returns {items: [{album: {...}}]} for saved albums
      const albums = (res.items || []).map(item => item.album || item)
      setMyAlbums(albums)
    } catch (e) {
      console.error('Failed to load albums:', e)
    }
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          position: 'relative',
        }}
      >
        <SearchColumn type="album" onSelect={onSelectAlbum} disabled={!user} myItems={myAlbums} />
        <SearchColumn type="playlist" onSelect={onSelectAlbum} disabled={!user} myItems={myPlaylists} />
      </div>
      {!user && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)' }}>
          Please login to search for albums and playlists
        </div>
      )}
    </div>
  )
}

export default SearchPanel
