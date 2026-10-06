import AccountMenu from './AccountMenu'

function Header({ tokenStatus, user, providers, onLogout, onDeleteAccount, onShowBattles }) {
  return (
    <header>
      <h1>Song Battle</h1>
      <div className="top-actions">
        {!tokenStatus && (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No function available</div>
        )}
        <AccountMenu
          user={user}
          providers={providers}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          onShowBattles={onShowBattles}
        />
      </div>
    </header>
  )
}

export default Header
