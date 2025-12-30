function Header({ user, onRefresh, onLogout }) {
  return (
    <header>
      <h1>Spotify Battle</h1>
      <div className="top-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user && user.images && user.images[0] && (
            <img
              src={user.images[0].url}
              alt="avatar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
              }}
            />
          )}
          <div style={{ color: 'var(--muted)' }}>
            {user ? user.display_name : 'Not logged in'}
          </div>
        </div>
        {!user && (
          <button onClick={() => (window.location.href = '/api/login')}>
            Login
          </button>
        )}
        <button className="ghost" onClick={onRefresh}>
          Refresh
        </button>
        {user && (
          <button className="ghost" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  )
}

export default Header
