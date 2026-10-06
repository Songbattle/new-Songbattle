import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useI18n } from '../i18n'

function Footer() {
  const { t } = useI18n()
  const [version, setVersion] = useState(null)

  useEffect(() => {
    loadVersion()
  }, [])

  const loadVersion = async () => {
    try {
      const data = await api('/api/version')
      if (data && data.commit) {
        setVersion(data)
      }
    } catch (e) {
      // Ignore version load errors
    }
  }

  const shortCommit = version?.commit?.substring(0, 7) || ''
  const versionDisplay = version?.tag ? `${version.tag} (${shortCommit})` : shortCommit

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <a href="/privacy" className="footer-link">{t('footer.privacy')}</a>
        </div>
        <div className="footer-version">
          <span className="version-label">{t('footer.version')}</span>{' '}
          {version ? (
            <a 
              href={`https://github.com/Songbattle/new-Songbattle/commit/${version.commit}`}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              title={version.date}
            >
              {versionDisplay}
            </a>
          ) : (
            <span className="footer-link">—</span>
          )}
        </div>
        <div className="footer-text">
          {new Date().getFullYear()} Songbattle
        </div>
        <div className="footer-disclaimer">
          {t('footer.disclaimer')}
        </div>
      </div>
    </footer>
  )
}

export default Footer
