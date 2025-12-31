function Header({ user, onRefresh, onLogout, tokenStatus }) {
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
        {!tokenStatus && (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No function available</div>
        )}
      </div>
    </header>
  )
}

export default Header
