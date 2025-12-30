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

  return null
}

export default Sidebar
