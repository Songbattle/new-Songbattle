function Header({ tokenStatus }) {
  return (
    <header>
      <h1 className="brand">
        <span className="brand-mark" aria-hidden="true">♪</span>
        Songbattle
      </h1>
      <div className="top-actions">
        {!tokenStatus && (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No function available</div>
        )}
      </div>
    </header>
  )
}

export default Header
