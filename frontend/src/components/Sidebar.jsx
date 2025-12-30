function Sidebar() {
  const handleExport = () => {
    const scores = JSON.parse(localStorage.getItem('scores') || '{}')
    const pairs = JSON.parse(localStorage.getItem('pairs') || '[]')
    const blob = new Blob(
      [JSON.stringify({ pairs, scores }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spotify-battle-results.json'
    a.click()
  }

  return (
    <aside>
      <div className="card">
        <h3>Tips</h3>
        <p style={{ color: 'var(--muted)' }}>
          Select two songs to compare. Results are saved in LocalStorage.
        </p>
        <div style={{ marginTop: '10px' }}>
          <button className="ghost" onClick={handleExport}>
            Export results
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
