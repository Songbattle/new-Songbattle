import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'

const PAGE_LIMIT = 10

function SearchColumn({ type, onSelect, disabled, initialSearchQuery }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [results, setResults] = useState([])
  const [page, setPage] = useState(0)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [nextUrl, setNextUrl] = useState(null)
  const [prevUrl, setPrevUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef(null)

  const isAlbum = type === 'album'
  const label = isAlbum ? 'Albums' : 'Playlists'
  const placeholder = isAlbum ? 'Search album...' : 'Search playlist...'

  // Initial search if initialSearchQuery is provided
  useEffect(() => {
    if (initialSearchQuery && !disabled) {
      fetchSearch(initialSearchQuery, 0)
    }
  }, [initialSearchQuery, disabled])

  const handleInputChange = (e) => {
    if (disabled) return
    
    const val = e.target.value
    setQuery(val)

    clearTimeout(debounceTimer.current)
    if (!val.trim()) {
      setSuggestions([])
      return
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val.trim())
    }, 320)
  }

  const fetchSuggestions = async (q) => {
    const param = isAlbum ? 'album' : 'playlist'
    const res = await api(
      `/api/search?${param}=${encodeURIComponent(q)}&offset=0&limit=5`
    )
    const coll = res.playlists || res.albums || {}
    let items = (coll.items || []).filter(Boolean)
    // Filter out items with less than 2 tracks
    items = items.filter(
      (it) => it && it.total_tracks && parseInt(it.total_tracks) >= 2
    )
    setSuggestions(items.slice(0, 5))
  }

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return alert('Please enter a search term')
    setSuggestions([])
    setPage(0)
    setOffset(0)
    await fetchSearch(q, 0)
  }

  const fetchSearch = async (q, pageOrUrl) => {
    const param = isAlbum ? 'album' : 'playlist'
    let url
    if (typeof pageOrUrl === 'string' && pageOrUrl) {
      if (pageOrUrl.startsWith('http')) {
        url = `/api/search?next=${encodeURIComponent(pageOrUrl)}`
      } else {
        url = pageOrUrl
      }
    } else {
      const pg = pageOrUrl || 0
      const off = pg * PAGE_LIMIT
      url = `/api/search?${param}=${encodeURIComponent(q)}&offset=${off}&limit=${PAGE_LIMIT}`
    }

    setLoading(true)
    try {
      const res = await api(url)
      const coll = res.playlists || res.albums || {}
      let items = (coll.items || []).filter(Boolean)
      // Filter out items with less than 2 tracks
      items = items.filter(
        (it) => it && it.total_tracks && parseInt(it.total_tracks) >= 2
      )
      setResults(items)
      setTotal(coll.total || items.length)
      setOffset(coll.offset || 0)
      setNextUrl(coll.next || null)
      setPrevUrl(coll.previous || null)
      if (typeof pageOrUrl === 'number') setPage(pageOrUrl)
    } finally {
      setLoading(false)
    }
  }

  const handlePrev = () => {
    if (prevUrl) {
      fetchSearch(query, prevUrl)
    } else {
      const newPage = Math.max(0, page - 1)
      setPage(newPage)
      fetchSearch(query, newPage)
    }
  }

  const handleNext = () => {
    if (nextUrl) {
      fetchSearch(query, nextUrl)
    } else {
      const maxPage = Math.max(0, Math.ceil(total / PAGE_LIMIT) - 1)
      const newPage = Math.min(maxPage, page + 1)
      setPage(newPage)
      fetchSearch(query, newPage)
    }
  }

  const handleSuggestionClick = (item, openDirectly) => {
    if (openDirectly) {
      setSuggestions([])
      onSelect({ ...item, type: isAlbum ? 'album' : 'playlist' })
    } else {
      setQuery(item.name)
      setSuggestions([])
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestions.length > 0 && !e.target.closest('.search-input-wrapper')) {
        setSuggestions([])
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [suggestions.length])

  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>
        {label}
      </label>
      <div className="search-input-wrapper" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            disabled={disabled}
            style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          />
          <button onClick={handleSearch} disabled={loading || disabled}>
            Search
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="suggestions" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000 }}>
          {suggestions.filter(Boolean).map((item) => {
            if (!item || !item.id) return null
            const img =
              item.images?.[0]?.url ||
              `https://picsum.photos/seed/${item.id}/56`
            const subtitle = isAlbum
              ? item.artists?.map((a) => a.name).join(', ') || ''
              : item.owner?.display_name || ''
            return (
              <div
                key={item.id}
                className="suggestion"
                onClick={() => handleSuggestionClick(item, false)}
              >
                <img src={img} alt="cover" />
                <div className="meta">
                  <strong>{item.name}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    {subtitle}
                  </div>
                </div>
                <button
                  className="ghost openBtn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSuggestionClick(item, true)
                  }}
                >
                  Open
                </button>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {results.length > 0 && (
        <>
          <div className="album-list" style={{ marginTop: '12px' }}>
            {results.filter(Boolean).map((item) => {
              if (!item || !item.id) return null
              const img =
                item.images?.[0]?.url ||
                `https://picsum.photos/seed/${item.id}/64`
              const subtitle = isAlbum
                ? item.artists?.map((a) => a.name).join(', ') || ''
                : item.owner?.display_name || ''
              return (
                <div key={item.id} className="album">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img className="cover" src={img} alt="cover" />
                    <div className="meta">
                      <strong>{item.name}</strong>
                      <div className="muted">{subtitle}</div>
                    </div>
                  </div>
                  <div>
                    <button
                      className="ghost"
                      onClick={() =>
                        onSelect({ ...item, type: isAlbum ? 'album' : 'playlist' })
                      }
                    >
                      Select
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              className="ghost"
              onClick={handlePrev}
              disabled={offset <= 0}
            >
              Previous
            </button>
            <div style={{ color: 'var(--muted)' }}>
              {total <= 0
                ? '0 of 0'
                : `${Math.min(offset + 1, total)}–${Math.min(offset + PAGE_LIMIT, total)} of ${total}`}
            </div>
            <button
              className="ghost"
              onClick={handleNext}
              disabled={offset + PAGE_LIMIT >= total}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SearchColumn
