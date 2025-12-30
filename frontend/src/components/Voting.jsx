import { useState, useEffect } from 'react'

function Voting({ tracks, onShowResults }) {
  const [votingIndex, setVotingIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const idx = parseInt(localStorage.getItem('votingIndex') || '0', 10)
    setVotingIndex(idx)
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

  const recordVote = (winnerId) => {
    const state = getNextPair()
    if (!state) {
      onShowResults()
      return
    }

    const lstMember = JSON.parse(localStorage.getItem('lstMember') || '[]')
    const parent = JSON.parse(localStorage.getItem('parent') || '[]')
    const scores = JSON.parse(localStorage.getItem('scores') || '{}')
    
    let { aIdx, bIdx, head1, head2, cmp1, cmp2, rec, nrec, equal, finishSize, totalSize } = state

    if (typeof winnerId === 'string') {
      // One track wins
      scores[winnerId] = (scores[winnerId] || 0) + 1
    } else if (Array.isArray(winnerId)) {
      // Both equal - link them and give both points
      winnerId.forEach((idx) => {
        scores[idx] = (scores[idx] || 0) + 1
      })
      equal[state.bIdx] = state.aIdx
    }
    // null = no opinion, skip scoring

    // Advance through the merge process
    if (winnerId === state.aIdx || winnerId === null) {
      rec[nrec] = aIdx
      head1++
      nrec++
      finishSize++
    } else if (winnerId === state.bIdx) {
      rec[nrec] = bIdx
      head2++
      nrec++
      finishSize++
    } else if (Array.isArray(winnerId)) {
      // Both
      rec[nrec] = aIdx
      head1++
      nrec++
      finishSize++
      equal[bIdx] = aIdx
      rec[nrec] = bIdx
      head2++
      nrec++
      finishSize++
    }

    // Check if merge is complete
    if (head1 >= (lstMember[cmp1]?.length || 0) && head2 >= (lstMember[cmp2]?.length || 0)) {
      // Move up the tree
      if (lstMember[cmp1]?.length + lstMember[cmp2]?.length > 0) {
        for (let i = 0; i < lstMember[cmp1].length + lstMember[cmp2].length; i++) {
          lstMember[parent[cmp1]][i] = rec[i]
        }
      }

      lstMember.pop()
      lstMember.pop()
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

  return (
    <div style={{ marginTop: '14px' }}>
      <div className="voting">
        <div className="vote-card">
          <h3>{a.name}</h3>
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => recordVote(a.id)}>Choose left</button>
          </div>
        </div>

        <div className="center-controls">
          <button className="ghost" onClick={() => recordVote([a.id, b.id])}>
            Both
          </button>
          <button className="ghost" onClick={() => recordVote(null)}>
            No opinion
          </button>
        </div>

        <div className="vote-card">
          <h3>{b.name}</h3>
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => recordVote(b.id)}>Choose right</button>
          </div>
        </div>
      </div>

      <div className="progress">
        Vote #{votingIndex + 1} — {progress}% done
      </div>
    </div>
  )
}

export default Voting
