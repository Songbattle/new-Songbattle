import { useState } from 'react'

function AccountMenu({ user, providers, onLogout, onDeleteAccount, onShowBattles }) {
  const [open, setOpen] = useState(false)
  const hasProvider = providers.google || providers.apple

  if (!user && !hasProvider) return null

  if (!user) {
    return (
      <div className="account-menu">
        <button className="ghost" onClick={() => setOpen(!open)}>Sign in</button>
        {open && (
          <div className="account-dropdown">
            <p className="account-hint">Optional – sign in to save your battles for 30 days.</p>
            {providers.google && (
              <a className="account-link" href="/api/auth/google/login">Continue with Google</a>
            )}
            {providers.apple && (
              <a className="account-link" href="/api/auth/apple/login">Continue with Apple</a>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="account-menu">
      <button className="ghost" onClick={() => setOpen(!open)}>Account</button>
      {open && (
        <div className="account-dropdown">
          <button className="ghost" onClick={() => { setOpen(false); onShowBattles() }}>My battles</button>
          <button className="ghost" onClick={() => { setOpen(false); onLogout() }}>Sign out</button>
          <button className="ghost danger" onClick={() => { setOpen(false); onDeleteAccount() }}>
            Delete account
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
