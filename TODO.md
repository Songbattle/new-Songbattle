
# Spotify Battle – Todo List

Use this checklist to implement the project from setup to deployment.

## Setup
- [ ] Create a Spotify Developer account
- [ ] Register a new App in the Spotify dashboard
- [ ] Set redirect URL: http://localhost:8080/api/callback
- [ ] Note Client ID and Client Secret
- [ ] Set environment variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URL

## Backend (Go)
- [ ] OAuth login endpoint: GET /api/login
- [ ] OAuth callback: GET /api/callback exchange code for token
- [ ] User info: GET /api/me (Authorization: Bearer)
- [ ] Album search: GET /api/search?album={query}
- [ ] Album tracks: GET /api/albums/{id}/tracks
- [ ] Enable CORS (Origin, Credentials, Methods)
- [ ] Consistent error handling (incl. 401/400)
- [ ] Support token refresh (optional)
- [ ] Serve static files from /web

## Frontend (SPA)
- [ ] Login button that points to /api/login
- [ ] Load and display user info
- [ ] Search input for albums with results list
- [ ] Album selection and store selected album ID
- [ ] Load and display album tracklist
- [ ] Voting UI: two songs side-by-side, vote left/right
- [ ] Show progress (remaining comparisons/rounds)
- [ ] Results page with ranked favorite songs
- [ ] UX polish (mobile, keyboard shortcuts optional)

## Voting Logic
- [ ] Pairwise compare all songs (round-robin or tournament)
- [ ] Avoid duplicate pairings
- [ ] Define tie behavior (optional)
- [ ] Calculate ranking (e.g. ELO or simple points)
- [ ] Persistence: LocalStorage (frontend) or session (backend)
- [ ] Export/share results (optional)

## Quality & Tests
- [ ] API response validation
- [ ] UI interaction tests (optional)
- [ ] Configure linting/typecheck if tooling available
- [ ] Simulate error cases (timeouts, 401)

## Operations & Deployment
- [ ] Set production environment variables
- [ ] Update redirect URL in Spotify app for production URL
- [ ] Configure hosting (e.g. Render/Vercel/Netlify)
- [ ] Enforce HTTPS
- [ ] Basic monitoring/logging checks

## Milestones
- [ ] MVP: Login, album search, tracks, simple voting, results list
- [ ] V1: Persistence, sharing, improved UI
- [ ] V2: ELO/tournament mode, multiplayer (optional)

