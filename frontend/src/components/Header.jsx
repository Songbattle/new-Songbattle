function Header({ user, onRefresh, onLogout, tokenStatus }) {
  return (
    <header>
      <h1>Spotify Battle</h1>
      <div className="top-actions">
        {!tokenStatus && (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No function available</div>
        )}
      </div>
    </header>
  )
}

export default Header
