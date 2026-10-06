import { useState } from 'react'
import { useI18n } from '../i18n'

function AlbumView({ album, tracks, onBack, votingActive }) {
  const { t } = useI18n()
  const [showTracks, setShowTracks] = useState(false)

  const coverImage = album.images?.[0]?.url || `https://picsum.photos/seed/${album.id}/64`

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <img 
            src={coverImage} 
            alt={album.name}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '4px',
              objectFit: 'cover',
              flexShrink: 0
            }}
          />
          <h2 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.name}</h2>
        </div>
        <div>
          <button className="ghost" onClick={onBack}>
            {t('album.back')}
          </button>
        </div>
      </div>

      <div className="card tracks" style={{ marginTop: '14px' }}>
        <div>{t('album.trackCount', { count: tracks.length })}</div>
        <div style={{ marginTop: '8px' }}>
          <button
            className="ghost"
            onClick={() => setShowTracks(!showTracks)}
          >
            {showTracks ? t('album.hideTracks') : t('album.showTracks')}
          </button>
        </div>
        {showTracks && (
          <div style={{ marginTop: '8px' }}>
            {tracks.map((track) => (
              <div key={track.id} className="track">
                {track.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {tracks.length < 2 && (
        <div style={{ marginTop: '14px', color: 'var(--muted)' }}>
          {t('album.notEnough')}
        </div>
      )}
    </div>
  )
}

export default AlbumView
