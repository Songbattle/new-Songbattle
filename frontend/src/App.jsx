import { useState, useEffect } from 'react'
import api from './utils/api'
import Header from './components/Header'
import SearchPanel from './components/SearchPanel'
import AlbumView from './components/AlbumView'
import Voting from './components/Voting'
import Results from './components/Results'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import Privacy from './components/Privacy'

// Efficient merge-sort based voting - only necessary comparisons
function generateVotingPairs(tracks) {
  if (tracks.length < 2) return []

  const n = tracks.length
  // For merge sort: O(n log n) comparisons
  // Empirically: around 1.5 * n * log2(n) comparisons
  const estimatedBattles = Math.ceil(n * Math.log2(n) * 1.5)
  
  const pairs = []
  const used = new Set()

  // Generate random unique pairs until we reach estimated battles
  while (pairs.length < estimatedBattles && pairs.length < n * n) {
    const i = Math.floor(Math.random() * n)
    const j = Math.floor(Math.random() * n)
    
    if (i !== j) {
      const key = i < j ? `${i},${j}` : `${j},${i}`
      if (!used.has(key)) {
        used.add(key)
        pairs.push([tracks[i], tracks[j]])
      }
    }
  }

  // Shuffle for better UX
  for (let i = pairs.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[k]] = [pairs[k], pairs[i]]
  }

  return pairs
}

function App() {
  const [currentAlbum, setCurrentAlbum] = useState(null)
  const [tracks, setTracks] = useState([])
  const [votingActive, setVotingActive] = useState(false)
  const [resultsActive, setResultsActive] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [tokenStatus, setTokenStatus] = useState(false)
  const [loginInfo, setLoginInfo] = useState(null)

  useEffect(() => {
    loadTokenStatus()
    checkLoginResponse()
    
    // Listen for rate limit events
    const handleRateLimit = (event) => {
      setLoginInfo({ type: 'warning', message: event.detail.message })
      setTimeout(() => setLoginInfo(null), 10000)
    }
    window.addEventListener('spotify-rate-limit', handleRateLimit)
    
    // Check URL for privacy page
    if (window.location.pathname === '/privacy') {
      setShowPrivacy(true)
    }

    // Handle browser navigation
    const handlePopState = () => {
      setShowPrivacy(window.location.pathname === '/privacy')
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('spotify-rate-limit', handleRateLimit)
    }
  }, [])

  // Update URL when privacy state changes
  useEffect(() => {
    if (showPrivacy && window.location.pathname !== '/privacy') {
      window.history.pushState({}, '', '/privacy')
    } else if (!showPrivacy && window.location.pathname === '/privacy') {
      window.history.pushState({}, '', '/')
    }
  }, [showPrivacy])

  const loadTokenStatus = async () => {
    try {
      const status = await api('/api/token-status')
      setTokenStatus(status && status.hasToken)
    } catch (e) {
      setTokenStatus(false)
    }
  }

  const checkLoginResponse = () => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('admin') === 'success') {
      setLoginInfo({ type: 'success', message: 'Login successful! Token has been acquired.' })
      // Clear URL parameter
      window.history.replaceState({}, '', window.location.pathname)
      // Clear message after 5 seconds
      setTimeout(() => setLoginInfo(null), 5000)
      // Reload token status
      loadTokenStatus()
    } else if (params.get('login-info')) {
      setLoginInfo({ type: 'info', message: params.get('login-info') })
      // Clear URL parameter
      window.history.replaceState({}, '', window.location.pathname)
      // Clear message after 8 seconds
      setTimeout(() => setLoginInfo(null), 8000)
      // Reload token status
      loadTokenStatus()
    }
  }

  const handleSelectAlbum = async (album) => {
    setCurrentAlbum(album)
    const endpoint =
      album.type === 'playlist'
        ? `/api/playlists/${album.id}/tracks`
        : `/api/albums/${album.id}/tracks`
    const res = await api(endpoint)
    let trackList = res.items || []
    
    // Normalize tracks: Spotify playlists have {track: {...}}, albums have {id, name, ...}
    trackList = trackList.map(item => {
      if (item.track) {
        return item.track // Unwrap playlist track
      }
      return item // Already unwrapped (album)
    }).filter(t => t && t.id && t.name)
    
    setTracks(trackList)
    setVotingActive(false)
    setResultsActive(false)
    
    // Auto-start voting if enough tracks
    if (trackList.length >= 2) {
      setTimeout(() => {
        startVotingWithTracks(trackList, album)
      }, 100)
    }
  }

  const startVotingWithTracks = (trackList, albumData) => {
    if (trackList.length < 2) return
    
    // Use the old efficient merge-sort algorithm with equal-linking
    const lstMember = []
    const parent = []
    let n = 0

    // Initialize with all track indices
    lstMember[n] = trackList.map((_, i) => i)
    parent[n] = -1
    n++

    // Recursively divide into pairs (like merge sort)
    for (let i = 0; i < lstMember.length; i++) {
      if (lstMember[i].length >= 2) {
        const mid = Math.ceil(lstMember[i].length / 2)
        lstMember[n] = lstMember[i].slice(0, mid)
        parent[n] = i
        n++
        lstMember[n] = lstMember[i].slice(mid, lstMember[i].length)
        parent[n] = i
        n++
      }
    }

    // Store the sorting structure for voting
    localStorage.setItem('lstMember', JSON.stringify(lstMember))
    localStorage.setItem('parent', JSON.stringify(parent))
    localStorage.setItem('cmp1', String(lstMember.length - 2))
    localStorage.setItem('cmp2', String(lstMember.length - 1))
    localStorage.setItem('head1', '0')
    localStorage.setItem('head2', '0')
    
    // Initialize equal array (for linking equal items)
    const equal = {}
    for (let i = 0; i < trackList.length; i++) {
      equal[i] = -1
    }
    localStorage.setItem('equal', JSON.stringify(equal))
    localStorage.setItem('rec', JSON.stringify([]))
    localStorage.setItem('nrec', '0')
    localStorage.setItem('votingIndex', '0')
    localStorage.setItem('scores', JSON.stringify({}))
    
    // Store whether this is a playlist battle (to show covers)
    localStorage.setItem('isPlaylistBattle', albumData?.type === 'playlist' ? 'true' : 'false')
    
    setVotingActive(true)
    setResultsActive(false)
  }

  const handleStartVoting = () => {
    startVotingWithTracks(tracks)
  }

  const handleShowResults = () => {
    setVotingActive(false)
    setResultsActive(true)
  }

  const handleBackToSearch = () => {
    setCurrentAlbum(null)
    setTracks([])
    setVotingActive(false)
    setResultsActive(false)
  }

  // Show privacy page
  if (showPrivacy) {
    return (
      <>
        <Privacy />
        <Footer />
      </>
    )
  }

  return (
    <div className={currentAlbum ? 'album-mode' : ''}>
      <div className="container">
        <Header tokenStatus={tokenStatus} />

        <div className="centered-content">
          <div>
            {!currentAlbum && <SearchPanel onSelectAlbum={handleSelectAlbum} tokenStatus={tokenStatus} showIntro={!currentAlbum} loginInfo={loginInfo} />}

            {currentAlbum && (
              <AlbumView
                album={currentAlbum}
                tracks={tracks}
                onBack={handleBackToSearch}
                votingActive={votingActive}
              />
            )}

            {votingActive && (
              <Voting tracks={tracks} onShowResults={handleShowResults} />
            )}

            {resultsActive && (
              <Results
                tracks={tracks}
                albumName={currentAlbum?.name || 'Results'}
                album={currentAlbum}
              />
            )}
          </div>

          {!currentAlbum && <Sidebar />}
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

export default App
