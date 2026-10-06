import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translations, LANGUAGES, DEFAULT_LANGUAGE } from './translations'

const STORAGE_KEY = 'language'
const supported = LANGUAGES.map((l) => l.code)

function detectLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && supported.includes(stored)) return stored
  } catch (e) {
    /* localStorage unavailable */
  }
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const c of candidates) {
    const code = (c || '').slice(0, 2).toLowerCase()
    if (supported.includes(code)) return code
  }
  return DEFAULT_LANGUAGE
}

// Replace {name} placeholders. Unknown placeholders are left untouched.
function format(str, params) {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m))
}

// Translate outside of React (e.g. in api.js). Uses the currently stored language.
export function translate(key, params, lang = detectLanguage()) {
  const str = translations[lang]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key
  return format(str, params)
}

const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  t: (key, params) => translate(key, params, DEFAULT_LANGUAGE),
})

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = translate('app.title', undefined, lang)
  }, [lang])

  const setLang = useCallback((code) => {
    if (!supported.includes(code)) return
    setLangState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch (e) {
      /* ignore */
    }
  }, [])

  const t = useCallback((key, params) => translate(key, params, lang), [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export { LANGUAGES }
