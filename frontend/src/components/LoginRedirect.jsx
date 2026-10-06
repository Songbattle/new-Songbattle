import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useI18n } from '../i18n'

function LoginRedirect() {
  const { t } = useI18n()
  const [message, setMessage] = useState(t('loginRedirect.checking'))
  const navigate = useNavigate()

  useEffect(() => {
    checkLogin()
  }, [])

  const checkLogin = async () => {
    try {
      const response = await fetch('/login')
      const data = await response.json()
      
      if (data.message) {
        // Token already exists or mock mode
        setMessage(data.message)
        if (data.expiry) {
          setMessage(prev => prev + ` (${t('loginRedirect.expires', { date: new Date(data.expiry).toLocaleString() })})`)
        }
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          window.location.href = '/?login-info=' + encodeURIComponent(data.message)
        }, 3000)
      }
    } catch (e) {
      setMessage(t('loginRedirect.error'))
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        padding: '40px', 
        background: 'rgba(255,255,255,0.05)', 
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#1db954' }}>{t('loginRedirect.title')}</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#ccc' }}>{message}</p>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#888' }}>{t('loginRedirect.redirecting')}</p>
      </div>
    </div>
  )
}

export default LoginRedirect
