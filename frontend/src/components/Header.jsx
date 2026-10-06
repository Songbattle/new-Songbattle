import { useI18n } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'

function Header({ tokenStatus }) {
  const { t } = useI18n()
  return (
    <header>
      <h1>{t('app.title')}</h1>
      <div className="top-actions">
        {!tokenStatus && (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('header.noFunction')}</div>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  )
}

export default Header
