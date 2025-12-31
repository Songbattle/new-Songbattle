import { useState, useEffect } from 'react'

function Results({ tracks, albumName, shareUrl, album }) {
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
      const t = tracks.find((tt) => tt.id === id)
      return { rank: i + 1, name: t ? t.name : id, score: sc }
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
          coverImage: coverImage
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
      alert('Link copied to clipboard')
    } catch (e) {
      alert('Copy failed')
    }
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      let shareFile = null
      let shareText = `I ranked the songs in "${albumName}" by their awesomeness! 🎵`
      
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
          title: 'Spotify Battle Results',
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
          alert('Share failed')
        }
      }
    } else {
      alert('Web Share not supported in this browser')
    }
  }



  const scores = JSON.parse(localStorage.getItem('scores') || '{}')
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ marginTop: '14px' }}>
      <div className="card results">
        <h3>Results</h3>
        {ranked.map(([id, sc], i) => {
          const t = tracks.find((tt) => tt.id === id)
          return (
            <div key={id}>
              {i + 1}. {t ? t.name : id} — {sc} points
            </div>
          )
        })}

        <div className="share-area">
          <button className="ghost" onClick={handleOpenImage}>
            Open image
          </button>
          <button className="ghost" onClick={handleCopyLink}>
            Copy link
          </button>
          <button className="ghost" onClick={handleWebShare}>
            Share with image
          </button>
        </div>
      </div>
    </div>
  )
}

export default Results
