# Spotify Battle – Todo-Liste

Nutze diese Checkliste, um das Projekt von Setup bis Deployment umzusetzen.

## Setup
- [ ] Spotify Developer-Konto erstellen
- [ ] Neue App anlegen
- [ ] Redirect-URL setzen: http://localhost:8080/api/callback
- [ ] Client ID und Client Secret notieren
- [ ] Umgebungsvariablen setzen: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URL

## Backend (Go)
- [ ] OAuth-Login-Endpunkt: GET /api/login
- [ ] OAuth-Callback: GET /api/callback tauscht Code gegen Token
- [ ] Nutzerinfo: GET /api/me (Authorization: Bearer)
- [ ] Album-Suche: GET /api/search?album={query}
- [ ] Album-Tracks: GET /api/albums/{id}/tracks
- [ ] CORS aktivieren (Origin, Credentials, Methods)
- [ ] Einheitliche Fehlerbehandlung (inkl. 401/400)
- [ ] Token-Refresh unterstützen (optional)
- [ ] Statische Dateien aus /web ausliefern

## Frontend (SPA)
- [ ] Login-Button, der auf /api/login leitet
- [ ] Nutzerinfo laden und darstellen
- [ ] Suchfeld für Alben mit Ergebnisliste
- [ ] Albumauswahl und Album-ID speichern
- [ ] Trackliste des Albums laden und anzeigen
- [ ] Voting-UI: zwei Songs nebeneinander, Vote links/rechts
- [ ] Fortschritt (verbleibende Vergleiche/Runden) anzeigen
- [ ] Ergebnisseite mit Ranking der Lieblingssongs
- [ ] UI/UX Feinschliff (Mobile, Tastatur-Shortcuts optional)

## Voting-Logik
- [ ] Paarweises Vergleichen aller Songs (Round-Robin oder Turnier)
- [ ] Doppelte Paarungen vermeiden
- [ ] Unentschieden-Fall definieren (optional)
- [ ] Ranking berechnen (z. B. ELO oder Punkte)
- [ ] Persistenz: LocalStorage (Frontend) oder Session (Backend)
- [ ] Export/Teilen der Ergebnisse (optional)

## Qualität & Tests
- [ ] API-Response-Validierung
- [ ] UI-Interaktionstests (optional)
- [ ] Linting/Typecheck konfigurieren (falls Tooling vorhanden)
- [ ] Fehlerfälle simulieren (Timeouts, 401)

## Betrieb & Deployment
- [ ] Produktions-Env-Variablen setzen
- [ ] Redirect-URL in Spotify-App auf Produktions-URL ändern
- [ ] Hosting konfigurieren (z. B. Render/Vercel/Netlify)
- [ ] HTTPS erzwingen
- [ ] Basis-Monitoring/Logs prüfen

## Meilensteine
- [ ] MVP: Login, Album-Suche, Tracks, einfaches Voting, Ergebnisliste
- [ ] V1: Persistenz, Teilen, bessere UI
- [ ] V2: ELO/Turnier-Modus, Multiplayer (optional)

