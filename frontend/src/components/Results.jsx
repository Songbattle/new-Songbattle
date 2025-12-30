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

    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: albumName,
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
      let shareLink = uploadedUrl || shareUrl || window.location.href
      // Convert relative URL to absolute
      if (imageUrl && imageUrl.startsWith('/')) {
        shareLink = window.location.origin + imageUrl
      }
      try {
        await navigator.share({
          title: 'Spotify Battle Results',
          text: albumName || 'My results',
          url: shareLink,
        })
      } catch (e) {
        alert('Share failed')
      }
    } else {
      alert('Web Share not supported in this browser')
    }
  }

  const handleTwitter = () => {
    const text = encodeURIComponent(
      `My Spotify Battle results: ${albumName || ''}`
    )
    const url = encodeURIComponent(
      uploadedUrl || shareUrl || window.location.href
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
  }

  const handleBluesky = () => {
    const text = encodeURIComponent(
      `My Spotify Battle results: ${albumName || ''} ${uploadedUrl || shareUrl || ''}`
    )
    window.open(`https://bsky.app/compose?text=${text}`, '_blank')
  }

  const handleMastodon = () => {
    const text = encodeURIComponent(
      `My Spotify Battle results: ${albumName || ''}`
    )
    const url = encodeURIComponent(
      uploadedUrl || shareUrl || window.location.href
    )
    window.open(
      `https://mastodon.social/share?text=${text}%20${url}`,
      '_blank'
    )
  }

  const handleInstagram = async () => {
    try {
      if (navigator.share && imageBlob) {
        await navigator.share({
          files: [
            new File([imageBlob], 'spotify-battle.png', { type: 'image/png' }),
          ],
          title: 'Spotify Battle',
        })
      } else {
        window.open(imageUrl || '', '_blank')
      }
    } catch (e) {
      window.open(imageUrl || '', '_blank')
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
            Share...
          </button>
          <button className="ghost" onClick={handleTwitter}>
            Twitter
          </button>
          <button className="ghost" onClick={handleBluesky}>
            Bluesky
          </button>
          <button className="ghost" onClick={handleMastodon}>
            Mastodon
          </button>
          <button className="ghost" onClick={handleInstagram}>
            Instagram
          </button>
        </div>
      </div>
    </div>
  )
}

export default Results
