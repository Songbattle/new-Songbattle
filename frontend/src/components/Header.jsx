function Header({ user, onRefresh, onLogout }) {
  return (
    <header>
      <h1>Spotify Battle</h1>
      <div className="top-actions">
        {user && user.images && user.images[0] && (
          <a 
            href="https://www.spotify.com/us/account/apps/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ position: 'relative' }} 
            className="user-avatar"
            title={user.display_name}
          >
            <img
              src={user.images[0].url}
              alt="avatar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'block'
              }}
            />
          </a>
        )}
        {!user && (
          <>
            <div style={{ color: 'var(--muted)' }}>Not logged in</div>
            <button onClick={() => (window.location.href = '/api/login')}>
              Login
            </button>
          </>
        )}
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
