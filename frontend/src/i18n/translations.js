// Translation dictionaries. Keys are shared across languages; `en` is the fallback.
// Placeholders use {name} syntax.
const en = {
  'app.title': 'Spotify Battle',
  'header.noFunction': 'No function available',
  'language.label': 'Language',

  'login.success': 'Login successful! Token has been acquired.',
  'rateLimit.spotify': 'Spotify rate limit reached. Please try again later.',
  'rateLimit.server': 'Too many requests. Please try again in {seconds} seconds.',

  'search.welcomeTitle': 'Welcome to Spotify Battle!',
  'search.welcomeText': 'Search and select an album below to start comparing tracks and find your favorites.',
  'search.noToken': 'No function available - No valid Spotify token',
  'search.albums': 'Albums',
  'search.playlists': 'Playlists',
  'search.placeholderAlbum': 'Search album...',
  'search.placeholderPlaylist': 'Search playlist...',
  'search.button': 'Search',
  'search.enterTerm': 'Please enter a search term',
  'search.open': 'Open',
  'search.select': 'Select',
  'search.previous': 'Previous',
  'search.next': 'Next',
  'search.range': '{from}–{to} of {total}',
  'search.empty': '0 of 0',
  'search.coverAlt': 'cover',

  'album.back': 'Back to Search',
  'album.trackCount': '{count} Tracks',
  'album.hideTracks': 'Hide tracks',
  'album.showTracks': 'Show tracks',
  'album.notEnough': 'Not enough tracks to vote.',

  'voting.chooseLeft': 'Choose left',
  'voting.chooseRight': 'Choose right',
  'voting.both': 'Both',
  'voting.noOpinion': 'No opinion',
  'voting.progress': 'Vote #{current} — {current}/{total}',

  'results.title': 'Results',
  'results.default': 'Results',
  'results.points': '{count} points',
  'results.openImage': 'Open image',
  'results.copyLink': 'Copy link',
  'results.shareWithImage': 'Share with image',
  'results.linkCopied': 'Link copied to clipboard',
  'results.copyFailed': 'Copy failed',
  'results.shareFailed': 'Share failed',
  'results.shareUnsupported': 'Web Share not supported in this browser',
  'results.shareText': 'I ranked the songs in "{album}" by their awesomeness! 🎵',
  'results.shareTitle': 'Spotify Battle Results',
  'results.imageSubtitle': 'My Favorite Ranking',

  'footer.privacy': 'Privacy Policy',
  'footer.version': 'Version:',
  'footer.disclaimer':
    'This project is not affiliated with, endorsed by, or in any way officially connected with Spotify AB.',

  'loginRedirect.checking': 'Checking login status...',
  'loginRedirect.expires': 'Expires: {date}',
  'loginRedirect.error': 'Error checking login status',
  'loginRedirect.title': 'Login Status',
  'loginRedirect.redirecting': 'Redirecting to home...',

  'privacy.title': 'Privacy Policy',
  'privacy.updated': 'Last updated: December 30, 2025',
  'privacy.back': 'Back to Home',
  'privacy.dataTitle': 'Data Collection',
  'privacy.dataText':
    'Spotify Battle does not store or collect any personal user data. We do not save your Spotify account information, listening history, or any other personal information.',
  'privacy.authTitle': 'Spotify Authentication',
  'privacy.authText1':
    "When you log in with Spotify, we use OAuth authentication to access your public profile, playlists, and saved albums. This access is temporary and only used during your active session. We do not store your Spotify access tokens or credentials.",
  'privacy.authText2': 'You can revoke this app\'s access to your Spotify account at any time by visiting',
  'privacy.authLink': 'Spotify Account Apps Settings',
  'privacy.imagesTitle': 'Generated Images',
  'privacy.imagesText':
    'When you complete a battle and generate a results image, this image is stored on our server for up to 30 days. This allows you to share and access your results. After 30 days, these images are automatically deleted from our servers.',
  'privacy.cookiesTitle': 'Cookies',
  'privacy.cookiesText':
    'We use session cookies to maintain your login state during your visit. These cookies are temporary and do not track you across different websites.',
  'privacy.thirdTitle': 'Third-Party Services',
  'privacy.thirdText1':
    "Spotify Battle integrates with Spotify's API. All music data, including album information, track details, and cover images, are provided directly by Spotify. Your use of Spotify's services is governed by",
  'privacy.thirdLink': "Spotify's Privacy Policy",
  'privacy.thirdText2':
    "Album artwork and other visual content displayed in this application are sourced from Spotify's API and remain the property of their respective copyright holders.",
  'privacy.cloudflareTitle': 'Cloudflare',
  'privacy.cloudflareText1':
    "This application may use Cloudflare's services for security, performance, and DDoS protection. Cloudflare may process your IP address and other technical data. Please refer to",
  'privacy.cloudflareLink': "Cloudflare's Privacy Policy",
  'privacy.cloudflareText2': ' for more information about their data handling practices.',
  'privacy.contactTitle': 'Contact',
  'privacy.contactText': 'If you have any questions about this Privacy Policy, please visit our',
  'privacy.contactLink': 'GitHub repository',
}

const de = {
  'app.title': 'Spotify Battle',
  'header.noFunction': 'Keine Funktion verfügbar',
  'language.label': 'Sprache',

  'login.success': 'Login erfolgreich! Das Token wurde abgerufen.',
  'rateLimit.spotify': 'Das Spotify-Anfragelimit wurde erreicht. Bitte versuche es später erneut.',
  'rateLimit.server': 'Zu viele Anfragen. Bitte versuche es in {seconds} Sekunden erneut.',

  'search.welcomeTitle': 'Willkommen bei Spotify Battle!',
  'search.welcomeText':
    'Suche unten ein Album aus und wähle es aus, um die Songs miteinander zu vergleichen und deine Favoriten zu finden.',
  'search.noToken': 'Keine Funktion verfügbar - Kein gültiges Spotify-Token',
  'search.albums': 'Alben',
  'search.playlists': 'Playlists',
  'search.placeholderAlbum': 'Album suchen...',
  'search.placeholderPlaylist': 'Playlist suchen...',
  'search.button': 'Suchen',
  'search.enterTerm': 'Bitte gib einen Suchbegriff ein',
  'search.open': 'Öffnen',
  'search.select': 'Auswählen',
  'search.previous': 'Zurück',
  'search.next': 'Weiter',
  'search.range': '{from}–{to} von {total}',
  'search.empty': '0 von 0',
  'search.coverAlt': 'Cover',

  'album.back': 'Zurück zur Suche',
  'album.trackCount': '{count} Songs',
  'album.hideTracks': 'Songs ausblenden',
  'album.showTracks': 'Songs anzeigen',
  'album.notEnough': 'Nicht genug Songs zum Abstimmen.',

  'voting.chooseLeft': 'Links wählen',
  'voting.chooseRight': 'Rechts wählen',
  'voting.both': 'Beide',
  'voting.noOpinion': 'Keine Meinung',
  'voting.progress': 'Abstimmung #{current} — {current}/{total}',

  'results.title': 'Ergebnisse',
  'results.default': 'Ergebnisse',
  'results.points': '{count} Punkte',
  'results.openImage': 'Bild öffnen',
  'results.copyLink': 'Link kopieren',
  'results.shareWithImage': 'Mit Bild teilen',
  'results.linkCopied': 'Link in die Zwischenablage kopiert',
  'results.copyFailed': 'Kopieren fehlgeschlagen',
  'results.shareFailed': 'Teilen fehlgeschlagen',
  'results.shareUnsupported': 'Web Share wird von diesem Browser nicht unterstützt',
  'results.shareText': 'Ich habe die Songs von "{album}" nach ihrer Genialität gerankt! 🎵',
  'results.shareTitle': 'Spotify Battle Ergebnisse',
  'results.imageSubtitle': 'Meine Lieblings-Rangliste',

  'footer.privacy': 'Datenschutzerklärung',
  'footer.version': 'Version:',
  'footer.disclaimer':
    'Dieses Projekt steht in keiner Verbindung zu Spotify AB und wird weder von Spotify AB unterstützt noch offiziell befürwortet.',

  'loginRedirect.checking': 'Login-Status wird geprüft...',
  'loginRedirect.expires': 'Läuft ab: {date}',
  'loginRedirect.error': 'Fehler beim Prüfen des Login-Status',
  'loginRedirect.title': 'Login-Status',
  'loginRedirect.redirecting': 'Weiterleitung zur Startseite...',

  'privacy.title': 'Datenschutzerklärung',
  'privacy.updated': 'Zuletzt aktualisiert: 30. Dezember 2025',
  'privacy.back': 'Zurück zur Startseite',
  'privacy.dataTitle': 'Datenerhebung',
  'privacy.dataText':
    'Spotify Battle speichert oder erhebt keine personenbezogenen Nutzerdaten. Wir speichern weder deine Spotify-Kontoinformationen noch deinen Hörverlauf oder andere persönliche Informationen.',
  'privacy.authTitle': 'Spotify-Authentifizierung',
  'privacy.authText1':
    'Wenn du dich mit Spotify anmeldest, verwenden wir OAuth-Authentifizierung, um auf dein öffentliches Profil, deine Playlists und gespeicherten Alben zuzugreifen. Dieser Zugriff ist temporär und wird nur während deiner aktiven Sitzung genutzt. Wir speichern weder deine Spotify-Zugriffstoken noch deine Zugangsdaten.',
  'privacy.authText2':
    'Du kannst den Zugriff dieser App auf dein Spotify-Konto jederzeit widerrufen unter',
  'privacy.authLink': 'Spotify Konto-Apps-Einstellungen',
  'privacy.imagesTitle': 'Generierte Bilder',
  'privacy.imagesText':
    'Wenn du ein Battle abschließt und ein Ergebnisbild erzeugst, wird dieses Bild bis zu 30 Tage auf unserem Server gespeichert. So kannst du deine Ergebnisse teilen und abrufen. Nach 30 Tagen werden diese Bilder automatisch von unseren Servern gelöscht.',
  'privacy.cookiesTitle': 'Cookies',
  'privacy.cookiesText':
    'Wir verwenden Sitzungs-Cookies, um deinen Login-Status während deines Besuchs aufrechtzuerhalten. Diese Cookies sind temporär und verfolgen dich nicht über verschiedene Websites hinweg.',
  'privacy.thirdTitle': 'Drittanbieter-Dienste',
  'privacy.thirdText1':
    'Spotify Battle nutzt die API von Spotify. Alle Musikdaten, einschließlich Albuminformationen, Titeldetails und Coverbilder, werden direkt von Spotify bereitgestellt. Für die Nutzung der Spotify-Dienste gilt die',
  'privacy.thirdLink': 'Datenschutzerklärung von Spotify',
  'privacy.thirdText2':
    'Albumcover und andere visuelle Inhalte in dieser Anwendung stammen aus der Spotify-API und bleiben Eigentum der jeweiligen Rechteinhaber.',
  'privacy.cloudflareTitle': 'Cloudflare',
  'privacy.cloudflareText1':
    'Diese Anwendung nutzt möglicherweise Dienste von Cloudflare für Sicherheit, Performance und DDoS-Schutz. Cloudflare kann deine IP-Adresse und andere technische Daten verarbeiten. Weitere Informationen zur Datenverarbeitung findest du in der',
  'privacy.cloudflareLink': 'Datenschutzerklärung von Cloudflare',
  'privacy.cloudflareText2': '.',
  'privacy.contactTitle': 'Kontakt',
  'privacy.contactText': 'Bei Fragen zu dieser Datenschutzerklärung besuche bitte unser',
  'privacy.contactLink': 'GitHub-Repository',
}

export const translations = { en, de }
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
]
export const DEFAULT_LANGUAGE = 'en'
