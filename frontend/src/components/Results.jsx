import { useState, useEffect } from 'react'

function Results({ tracks, albumName, shareUrl }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageBlob, setImageBlob] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)

  useEffect(() => {
    generateAndUploadImage()
  }, [])

  const generateAndUploadImage = async () => {
    const scores = JSON.parse(localStorage.getItem('scores') || '{}')
    const res = await generateResultsImage(tracks, scores, albumName, shareUrl)
    if (res && res.blob && res.url) {
      setImageBlob(res.blob)
      setImageUrl(res.url)

      try {
        const upload = await uploadImage(res.blob)
        if (upload && upload.url) {
          setUploadedUrl(upload.url)
        }
      } catch (e) {
        console.warn('Upload failed', e)
      }
    }
  }

  const generateResultsImage = (tracksArr, scoresObj, title, shareLink) => {
    return new Promise((resolve) => {
      const ranked = Object.entries(scoresObj).sort((a, b) => b[1] - a[1])
      const items = ranked.map(([id, sc], i) => {
        const t = tracksArr.find((tt) => tt.id === id)
        return { rank: i + 1, name: t ? t.name : id, score: sc }
      })

      const padding = 40
      const width = 1000
      const lineHeight = 48
      const headerHeight = 100
      const height =
        padding * 2 + headerHeight + Math.max(items.length, 1) * lineHeight

      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const ctx = c.getContext('2d')

      ctx.fillStyle = '#0f1724'
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = '#ffffff'
      ctx.font = '32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Spotify Battle Results', width / 2, padding + 34)

      if (title) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '20px sans-serif'
        ctx.fillText(title, width / 2, padding + 66)
      }

      let y = padding + headerHeight - 20
      ctx.font = '20px sans-serif'
      ctx.fillStyle = '#e6eef8'
      ctx.textAlign = 'left'

      items.forEach((it) => {
        const text = `${it.rank}. ${it.name}`
        let drawText = text
        while (
          ctx.measureText(drawText).width >
          width - padding * 3 - 100
        ) {
          drawText = drawText.slice(0, -1)
          if (drawText.length < 4) break
        }
        if (drawText !== text) drawText = drawText.slice(0, -3) + '...'
        ctx.fillText(drawText, padding, y)

        ctx.textAlign = 'right'
        ctx.fillStyle = '#93c5fd'
        ctx.fillText(String(it.score), width - padding, y)

        ctx.textAlign = 'left'
        ctx.fillStyle = '#e6eef8'
        y += lineHeight
      })

      if (shareLink) {
        const bottomY = height - padding / 2
        ctx.font = '14px sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'center'
        ctx.fillText(shareLink, width / 2, bottomY)
      }

      if (c.toBlob) {
        c.toBlob((blob) => {
          const url = URL.createObjectURL(blob)
          resolve({ blob, url })
        })
      } else {
        const dataUrl = c.toDataURL('image/png')
        fetch(dataUrl)
          .then((r) => r.blob())
          .then((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) })
          })
      }
    })
  }

  const uploadImage = async (blob) => {
    try {
      const fd = new FormData()
      fd.append('file', blob, 'spotify-battle.png')
      const resp = await fetch('/api/upload-image', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      if (!resp.ok) return null
      return await resp.json()
    } catch (e) {
      return null
    }
  }

  const handleOpenImage = () => {
    if (imageUrl) window.open(imageUrl, '_blank')
  }

  const handleCopyImage = async () => {
    if (!imageBlob) {
      alert('No image available')
      return
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': imageBlob }),
      ])
      alert('Image copied to clipboard')
    } catch (e) {
      try {
        await navigator.clipboard.writeText(shareUrl || window.location.href)
        alert('Copied share link instead')
      } catch (_) {
        alert('Copy failed')
      }
    }
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        const files = imageBlob
          ? [new File([imageBlob], 'spotify-battle.png', { type: 'image/png' })]
          : []
        await navigator.share({
          title: 'Spotify Battle Results',
          text: albumName || 'My results',
          url: shareUrl || undefined,
          files,
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
          <button className="ghost" onClick={handleCopyImage}>
            Copy image
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
