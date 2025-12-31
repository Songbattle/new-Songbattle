import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function LoginRedirect() {
  const [message, setMessage] = useState('Checking login status...')
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
          setMessage(prev => prev + ` (Expires: ${new Date(data.expiry).toLocaleString()})`)
        }
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          window.location.href = '/?login-info=' + encodeURIComponent(data.message)
        }, 3000)
      }
    } catch (e) {
      setMessage('Error checking login status')
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
        <h2 style={{ marginBottom: '20px', color: '#1db954' }}>Login Status</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#ccc' }}>{message}</p>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#888' }}>Redirecting to home...</p>
      </div>
    </div>
  )
}

export default LoginRedirect
