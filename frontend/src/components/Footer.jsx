import { useState, useEffect } from 'react'
import api from '../utils/api'

function Footer() {
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

  const shortCommit = version?.commit?.substring(0, 7) || 'dev'
  const versionText = shortCommit

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <a href="/privacy" className="footer-link">Privacy Policy</a>
        </div>
        <div className="footer-version">
          <span className="version-label">Version:</span>{' '}
          <a 
            href={`https://github.com/T0biii/Spotify-Battle/commit/${version?.commit || 'main'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            title={version?.date || 'Development version'}
          >
            {versionText}
          </a>
        </div>
        <div className="footer-text">
          © {new Date().getFullYear()} Spotify Battle
        </div>
      </div>
    </footer>
  )
}

export default Footer
