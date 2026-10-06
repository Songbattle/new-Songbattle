import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'

function Results({ tracks, albumName, shareUrl, album }) {
  const { t } = useI18n()
  const [imageUrl, setImageUrl] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [rankedItems, setRankedItems] = useState([])

  useEffect(() => {
    generateImage()
  }, [])

  const generateImage = async () => {
    const scores = JSON.parse(localStorage.getItem('scores') || '{}')
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
    const items = ranked.map(([id, sc], i) => {
      const track = tracks.find((tt) => tt.id === id)
      return { rank: i + 1, name: track ? track.name : id, score: sc }
    })
    
    setRankedItems(items)

    // Get cover image URL
    const coverImage = album?.images?.[0]?.url || ''
    
    // Get album ID - prefer album.id, fallback to extracting from first track
    let albumId = album?.id
    if (!albumId && tracks.length > 0) {
      // Try to extract album ID from first track's album property
      albumId = tracks[0]?.album?.id
    }
    if (!albumId) {
      albumId = 'unknown'
    }

    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: albumName,
          albumId: albumId,
          items: items,
          shareUrl: shareUrl || '',
          coverImage: coverImage,
          subtitle: t('results.imageSubtitle')
        })
      })
      
      if (resp.ok) {
        const data = await resp.json()
        if (data.url) {
          setUploadedUrl(data.url)
          setImageUrl(data.url)
        }
      }
    } catch (e) {
      console.error('Failed to generate image:', e)
    }
  }

  const handleOpenImage = () => {
    if (imageUrl) window.open(imageUrl, '_blank')
  }

  const handleCopyLink = async () => {
    let linkToCopy = imageUrl || shareUrl || window.location.href
    // Convert relative URL to absolute for sharing
    if (imageUrl && imageUrl.startsWith('/')) {
      linkToCopy = window.location.origin + imageUrl
    }
    try {
      await navigator.clipboard.writeText(linkToCopy)
      alert(t('results.linkCopied'))
    } catch (e) {
      alert(t('results.copyFailed'))
    }
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      let shareFile = null
      let shareText = t('results.shareText', { album: albumName })
      
      // Try to use the generated image if available
      try {
        if (uploadedUrl && uploadedUrl.startsWith('/')) {
          // Try to fetch and share the image file
          const imgResponse = await fetch(window.location.origin + uploadedUrl)
          if (imgResponse.ok) {
            const blob = await imgResponse.blob()
            shareFile = new File([blob], 'spotify-battle.png', { type: 'image/png' })
          }
        }
      } catch (e) {
        console.log('Could not fetch image for sharing')
      }

      try {
        const shareData = {
          title: t('results.shareTitle'),
          text: shareText,
          url: window.location.href,
        }
        
        // Add image if we managed to fetch it
        if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          shareData.files = [shareFile]
        }
        
        await navigator.share(shareData)
      } catch (e) {
        if (e.name !== 'AbortError') {
          alert(t('results.shareFailed'))
        }
      }
    } else {
      alert(t('results.shareUnsupported'))
    }
  }



  const scores = JSON.parse(localStorage.getItem('scores') || '{}')
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ marginTop: '14px' }}>
      <div className="card results">
        <h3>{t('results.title')}</h3>
        {ranked.map(([id, sc], i) => {
          const track = tracks.find((tt) => tt.id === id)
          return (
            <div key={id}>
              {i + 1}. {track ? track.name : id} — {t('results.points', { count: sc })}
            </div>
          )
        })}

        <div className="share-area">
          <button className="ghost" onClick={handleOpenImage}>
            {t('results.openImage')}
          </button>
          <button className="ghost" onClick={handleCopyLink}>
            {t('results.copyLink')}
          </button>
          <button className="ghost" onClick={handleWebShare}>
            {t('results.shareWithImage')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Results
