import { useI18n, LANGUAGES } from '../i18n'

function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()

  return (
    <select
      className="language-switcher"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label={t('language.label')}
      title={t('language.label')}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}

export default LanguageSwitcher
