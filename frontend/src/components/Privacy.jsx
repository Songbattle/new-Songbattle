function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <h1>Privacy Policy</h1>
        <p className="privacy-date">Last updated: October 7, 2026</p>
        
        <section className="privacy-section">
          <h2>Data Collection</h2>
          <p>
            Songbattle does not require an account and does not collect personal
            user data such as names, email addresses, or listening history. You do not
            need to log in.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Music Data</h2>
          <p>
            All music data is retrieved through a single server-side connection
            operated by the site owner. Your own accounts are never accessed. Search
            terms and album or playlist links you enter are sent through our server
            to fetch the matching music data.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Local Storage in Your Browser</h2>
          <p>
            Your battle progress (e.g. votes, current position, and scores) is saved
            in your browser's local storage so you can continue where you left off.
            This data stays on your device and is not sent to our server. You can
            delete it at any time by clearing your browser's site data.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Generated Images</h2>
          <p>
            When you generate a results image, the image (including the title and
            the ranked items) is stored on our server for up to 30 days so you can
            share and access it. After that, it is automatically deleted. The image
            link is hard to guess but publicly accessible to anyone who has it.
          </p>
          <p>
            When an image is generated, a notification containing its title, number
            of items, and link is sent to a private Discord channel used by the site
            operator for monitoring. Please do not enter personal information as a
            title.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Cookies</h2>
          <p>
            Songbattle does not set its own tracking or login cookies, and we do
            not use analytics or advertising. Third-party services such as Cloudflare
            may set technical cookies (see below).
          </p>
        </section>

        <section className="privacy-section">
          <h2>Server Logs</h2>
          <p>
            Our server and hosting infrastructure may temporarily log technical
            information such as IP address, request time, and requested URL for
            security and troubleshooting. This data is not used to identify or track
            individual users.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Third-Party Services</h2>
          <p>
            Songbattle displays music data, including album information, track
            details, and cover images, supplied by third-party music services.
            Album artwork and other visual content remain the property of their
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
              href="https://github.com/Songbattle/new-Songbattle" 
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
