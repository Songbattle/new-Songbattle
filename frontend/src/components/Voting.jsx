import { useState, useEffect } from 'react'

function Voting({ tracks, onShowResults }) {
  const [votingIndex, setVotingIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPlaylistBattle, setIsPlaylistBattle] = useState(false)

  useEffect(() => {
    const idx = parseInt(localStorage.getItem('votingIndex') || '0', 10)
    setVotingIndex(idx)
    const isPlaylist = localStorage.getItem('isPlaylistBattle') === 'true'
    setIsPlaylistBattle(isPlaylist)
  }, [])

  const getNextPair = () => {
    const lstMember = JSON.parse(localStorage.getItem('lstMember') || '[]')
    const equal = JSON.parse(localStorage.getItem('equal') || '{}')
    let cmp1 = parseInt(localStorage.getItem('cmp1') || '-1', 10)
    let cmp2 = parseInt(localStorage.getItem('cmp2') || '-1', 10)
    let head1 = parseInt(localStorage.getItem('head1') || '0', 10)
    let head2 = parseInt(localStorage.getItem('head2') || '0', 10)
    let rec = JSON.parse(localStorage.getItem('rec') || '[]')
    let nrec = parseInt(localStorage.getItem('nrec') || '0', 10)
    let finishSize = parseInt(localStorage.getItem('finishSize') || '0', 10)
    const totalSize = parseInt(localStorage.getItem('totalSize') || '0', 10)

    if (cmp1 < 0 || cmp2 < 0) {
      return null // Voting finished
    }

    const aIdx = lstMember[cmp1]?.[head1]
    const bIdx = lstMember[cmp2]?.[head2]

    if (aIdx === undefined || bIdx === undefined) {
      return null
    }

    return { aIdx, bIdx, head1, head2, cmp1, cmp2, rec, nrec, equal, finishSize, totalSize }
  }

  const recordVote = (winnerIdx) => {
    const lstMember = JSON.parse(localStorage.getItem('lstMember') || '[]')
    const parent = JSON.parse(localStorage.getItem('parent') || '[]')
    const scores = JSON.parse(localStorage.getItem('scores') || '{}')
    
    let cmp1 = parseInt(localStorage.getItem('cmp1') || '-1', 10)
    let cmp2 = parseInt(localStorage.getItem('cmp2') || '-1', 10)
    let head1 = parseInt(localStorage.getItem('head1') || '0', 10)
    let head2 = parseInt(localStorage.getItem('head2') || '0', 10)
    let rec = JSON.parse(localStorage.getItem('rec') || '[]')
    let nrec = parseInt(localStorage.getItem('nrec') || '0', 10)
    let equal = JSON.parse(localStorage.getItem('equal') || '{}')
    let finishSize = parseInt(localStorage.getItem('finishSize') || '0', 10)

    // Get current pair
    if (cmp1 < 0 || cmp2 < 0) {
      onShowResults()
      return
    }

    const aIdx = lstMember[cmp1]?.[head1]
    const bIdx = lstMember[cmp2]?.[head2]

    if (aIdx === undefined || bIdx === undefined) {
      onShowResults()
      return
    }

    // Record score - winnerIdx can be: aIdx, bIdx, [aIdx, bIdx] (both), or null (no opinion)
    if (typeof winnerIdx === 'number') {
      // One track wins
      const trackId = tracks[winnerIdx].id
      scores[trackId] = (scores[trackId] || 0) + 1
    } else if (Array.isArray(winnerIdx)) {
      // Both equal - link them and give both points
      winnerIdx.forEach((idx) => {
        const trackId = tracks[idx].id
        scores[trackId] = (scores[trackId] || 0) + 1
      })
      equal[bIdx] = aIdx
    }
    // null = no opinion, skip scoring

    // Advance through the merge process
    if (Array.isArray(winnerIdx)) {
      // Both - add both tracks
      rec[nrec++] = aIdx
      rec[nrec++] = bIdx
      head1++
      head2++
      finishSize++ // One comparison made
    } else if (winnerIdx === aIdx) {
      // Left wins
      rec[nrec++] = aIdx
      head1++
      finishSize++ // One comparison made
    } else if (winnerIdx === bIdx) {
      // Right wins
      rec[nrec++] = bIdx
      head2++
      finishSize++ // One comparison made
    } else if (winnerIdx === null) {
      // No opinion - choose left by default but don't score
      rec[nrec++] = aIdx
      head1++
      finishSize++ // One comparison made
    }

    // Check if one list is exhausted
    const len1 = lstMember[cmp1]?.length || 0
    const len2 = lstMember[cmp2]?.length || 0

    if (head1 >= len1) {
      // List 1 exhausted, copy remaining from list 2 (no comparisons needed)
      while (head2 < len2) {
        rec[nrec++] = lstMember[cmp2][head2++]
      }
    } else if (head2 >= len2) {
      // List 2 exhausted, copy remaining from list 1 (no comparisons needed)
      while (head1 < len1) {
        rec[nrec++] = lstMember[cmp1][head1++]
      }
    }

    // Check if merge is complete (both lists exhausted)
    if (head1 >= len1 && head2 >= len2) {
      // Copy merged result back to parent
      const parentIdx = parent[cmp1]
      if (parentIdx >= 0) {
        lstMember[parentIdx] = [...rec]
      }

      // Remove the two merged lists
      lstMember.pop()
      lstMember.pop()
      
      // Move to next merge
      cmp1 -= 2
      cmp2 -= 2
      head1 = 0
      head2 = 0
      rec = []
      nrec = 0
    }

    localStorage.setItem('cmp1', String(cmp1))
    localStorage.setItem('cmp2', String(cmp2))
    localStorage.setItem('head1', String(head1))
    localStorage.setItem('head2', String(head2))
    localStorage.setItem('rec', JSON.stringify(rec))
    localStorage.setItem('nrec', String(nrec))
    localStorage.setItem('equal', JSON.stringify(equal))
    localStorage.setItem('scores', JSON.stringify(scores))
    localStorage.setItem('finishSize', String(finishSize))
    localStorage.setItem('lstMember', JSON.stringify(lstMember))
    
    const newIdx = votingIndex + 1
    localStorage.setItem('votingIndex', String(newIdx))
    setVotingIndex(newIdx)
    
    // Calculate progress
    const totalComparisons = Math.ceil(tracks.length * Math.log2(tracks.length))
    const currentProgress = Math.floor((finishSize * 100) / totalComparisons)
    setProgress(currentProgress)
    
    if (cmp1 < 0) {
      onShowResults()
    }
  }

  const state = getNextPair()
  if (!state) {
    return null
  }

  const a = tracks[state.aIdx]
  const b = tracks[state.bIdx]

  if (!a || !b) {
    return null
  }

  const getCoverImage = (track) => {
    if (track.album?.images && track.album.images.length > 0) {
      return track.album.images[0].url
    }
    return null
  }

  const aCover = isPlaylistBattle ? getCoverImage(a) : null
  const bCover = isPlaylistBattle ? getCoverImage(b) : null

  return (
    <div style={{ marginTop: '14px' }}>
      <div className="voting">
        <div className="vote-card">
          {aCover && (
            <img
              src={aCover}
              alt={a.name}
              style={{
                width: '56px',
                height: '56px',
                objectFit: 'cover',
                borderRadius: '4px',
                marginBottom: '12px'
              }}
            />
          )}
          <h3>{a.name}</h3>
          {a.artists && a.artists.length > 0 && (
            <p style={{ margin: '4px 0', opacity: 0.7, fontSize: '0.9em' }}>
              {a.artists.map(artist => artist.name).join(', ')}
            </p>
          )}
          {a.id && (
            <iframe
              src={`https://open.spotify.com/embed/track/${a.id}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ marginTop: '8px', borderRadius: '8px', border: 0 }}
            ></iframe>
          )}
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => recordVote(state.aIdx)}>Choose left</button>
          </div>
        </div>

        <div className="center-controls">
          <button className="ghost" onClick={() => recordVote([state.aIdx, state.bIdx])}>
            Both
          </button>
          <button className="ghost" onClick={() => recordVote(null)}>
            No opinion
          </button>
        </div>

        <div className="vote-card">
          {bCover && (
            <img
              src={bCover}
              alt={b.name}
              style={{
                width: '56px',
                height: '56px',
                objectFit: 'cover',
                borderRadius: '4px',
                marginBottom: '12px'
              }}
            />
          )}
          <h3>{b.name}</h3>
          {b.artists && b.artists.length > 0 && (
            <p style={{ margin: '4px 0', opacity: 0.7, fontSize: '0.9em' }}>
              {b.artists.map(artist => artist.name).join(', ')}
            </p>
          )}
          {b.id && (
            <iframe
              src={`https://open.spotify.com/embed/track/${b.id}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ marginTop: '8px', borderRadius: '8px', border: 0 }}
            ></iframe>
          )}
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => recordVote(state.bIdx)}>Choose right</button>
          </div>
        </div>
      </div>

      <div className="progress">
        Vote #{votingIndex + 1} — {votingIndex + 1}/{Math.ceil(tracks.length * Math.log2(tracks.length))}
      </div>
    </div>
  )
}

export default Voting
