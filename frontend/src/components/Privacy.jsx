function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <h1>Privacy Policy</h1>
        <p className="privacy-date">Last updated: December 30, 2025</p>
        
        <section className="privacy-section">
          <h2>Data Collection</h2>
          <p>
            Spotify Battle does not store or collect any personal user data. 
            We do not save your Spotify account information, listening history, 
            or any other personal information.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Spotify Authentication</h2>
          <p>
            When you log in with Spotify, we use OAuth authentication to access 
            your public profile, playlists, and saved albums. This access is 
            temporary and only used during your active session. We do not store 
            your Spotify access tokens or credentials.
          </p>
          <p>
            You can revoke this app's access to your Spotify account at any time by visiting{' '}
            <a 
              href="https://www.spotify.com/us/account/apps/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="privacy-link"
            >
              Spotify Account Apps Settings
            </a>.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Generated Images</h2>
          <p>
            When you complete a battle and generate a results image, this image 
            is stored on our server for up to 30 days. This allows you to share 
            and access your results. After 30 days, these images are automatically 
            deleted from our servers.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Cookies</h2>
          <p>
            We use session cookies to maintain your login state during your visit. 
            These cookies are temporary and do not track you across different websites.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Third-Party Services</h2>
          <p>
            Spotify Battle integrates with Spotify's API. All music data, including 
            album information, track details, and cover images, are provided directly 
            by Spotify. Your use of Spotify's services is governed by{' '}
            <a 
              href="https://www.spotify.com/legal/privacy-policy/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="privacy-link"
            >
              Spotify's Privacy Policy
            </a>.
          </p>
          <p>
            Album artwork and other visual content displayed in this application 
            are sourced from Spotify's API and remain the property of their 
            respective copyright holders.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Cloudflare</h2>
          <p>
            This application may use Cloudflare's services for security, performance, 
            and DDoS protection. Cloudflare may process your IP address and other 
            technical data. Please refer to{' '}
            <a 
              href="https://www.cloudflare.com/privacypolicy/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="privacy-link"
            >
              Cloudflare's Privacy Policy
            </a>{' '}
            for more information about their data handling practices.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Contact</h2>
          <p>
            If you have any questions about this Privacy Policy, please visit our{' '}
            <a 
              href="https://github.com/T0biii/Spotify-Battle" 
              target="_blank" 
              rel="noopener noreferrer"
              className="privacy-link"
            >
              GitHub repository
            </a>.
          </p>
        </section>

        <div className="privacy-back">
          <a href="/" className="ghost">Back to Home</a>
        </div>
      </div>
    </div>
  )
}

export default Privacy
