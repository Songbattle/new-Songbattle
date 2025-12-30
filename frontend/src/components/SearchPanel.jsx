import { useState } from 'react'
import SearchColumn from './SearchColumn'

function SearchPanel({ onSelectAlbum }) {
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
        <SearchColumn type="album" onSelect={onSelectAlbum} />
        <SearchColumn type="playlist" onSelect={onSelectAlbum} />
      </div>
    </div>
  )
}

export default SearchPanel
