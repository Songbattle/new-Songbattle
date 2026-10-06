import { useI18n } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="privacy-link">
      {children}
    </a>
  )
}

function Privacy() {
  const { t } = useI18n()

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <LanguageSwitcher />
        </div>
        <h1>{t('privacy.title')}</h1>
        <p className="privacy-date">{t('privacy.updated')}</p>

        <section className="privacy-section">
          <h2>{t('privacy.dataTitle')}</h2>
          <p>{t('privacy.dataText')}</p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.authTitle')}</h2>
          <p>{t('privacy.authText1')}</p>
          <p>
            {t('privacy.authText2')}{' '}
            <ExternalLink href="https://www.spotify.com/us/account/apps/">
              {t('privacy.authLink')}
            </ExternalLink>
            .
          </p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.imagesTitle')}</h2>
          <p>{t('privacy.imagesText')}</p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.cookiesTitle')}</h2>
          <p>{t('privacy.cookiesText')}</p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.thirdTitle')}</h2>
          <p>
            {t('privacy.thirdText1')}{' '}
            <ExternalLink href="https://www.spotify.com/legal/privacy-policy/">
              {t('privacy.thirdLink')}
            </ExternalLink>
            .
          </p>
          <p>{t('privacy.thirdText2')}</p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.cloudflareTitle')}</h2>
          <p>
            {t('privacy.cloudflareText1')}{' '}
            <ExternalLink href="https://www.cloudflare.com/privacypolicy/">
              {t('privacy.cloudflareLink')}
            </ExternalLink>
            {t('privacy.cloudflareText2')}
          </p>
        </section>

        <section className="privacy-section">
          <h2>{t('privacy.contactTitle')}</h2>
          <p>
            {t('privacy.contactText')}{' '}
            <ExternalLink href="https://github.com/Songbattle/new-Songbattle">
              {t('privacy.contactLink')}
            </ExternalLink>
            .
          </p>
        </section>

        <div className="privacy-back">
          <a href="/" className="ghost">{t('privacy.back')}</a>
        </div>
      </div>
    </div>
  )
}

export default Privacy
