package main

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "strings"
    "time"
)

func main() {
    addr := ":8080"
    http.HandleFunc("/api/login", cors(loginHandler))
    http.HandleFunc("/api/callback", cors(callbackHandler))
    http.HandleFunc("/api/me", cors(meHandler))
    http.HandleFunc("/api/search", cors(searchHandler))
    http.HandleFunc("/api/albums/", cors(albumTracksHandler))

    // static files
    fs := http.FileServer(http.Dir("./web"))
    http.Handle("/", fs)

    log.Printf("Server startet auf %s", addr)
    if err := http.ListenAndServe(addr, nil); err != nil {
        log.Fatal(err)
    }
}

// --- Helpers ---
func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

func cors(h func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
    return func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")
        if origin == "" {
            origin = "*"
        }
        w.Header().Set("Access-Control-Allow-Origin", origin)
        w.Header().Set("Access-Control-Allow-Credentials", "true")
        w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        h(w, r)
    }
}

// --- Mock / Partial Spotify integration ---
var (
    spotifyClientID     = os.Getenv("SPOTIFY_CLIENT_ID")
    spotifyClientSecret = os.Getenv("SPOTIFY_CLIENT_SECRET")
    spotifyRedirect     = os.Getenv("SPOTIFY_REDIRECT_URL")
)

func loginHandler(w http.ResponseWriter, r *http.Request) {
    if spotifyClientID == "" || spotifyRedirect == "" {
        writeJSON(w, http.StatusOK, map[string]interface{}{"mock": true, "message": "No Spotify creds set; using mock mode"})
        return
    }
    scopes := "user-read-private user-read-email"
    url := fmt.Sprintf("https://accounts.spotify.com/authorize?response_type=code&client_id=%s&scope=%s&redirect_uri=%s", spotifyClientID, urlEncode(scopes), urlEncode(spotifyRedirect))
    http.Redirect(w, r, url, http.StatusFound)
}

func callbackHandler(w http.ResponseWriter, r *http.Request) {
    if spotifyClientID == "" || spotifyClientSecret == "" || spotifyRedirect == "" {
        http.SetCookie(w, &http.Cookie{Name: "access_token", Value: "mock-token", Path: "/", Expires: time.Now().Add(24 * time.Hour)})
        http.Redirect(w, r, "/", http.StatusFound)
        return
    }
    code := r.URL.Query().Get("code")
    if code == "" {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing code"})
        return
    }
    // Exchange code for token (simple implementation)
    form := urlEncodeForm(map[string]string{
        "grant_type":   "authorization_code",
        "code":         code,
        "redirect_uri": spotifyRedirect,
    })
    req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(form))
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
    req.SetBasicAuth(spotifyClientID, spotifyClientSecret)
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
        return
    }
    defer resp.Body.Close()
    body, _ := io.ReadAll(resp.Body)
    if resp.StatusCode >= 400 {
        w.WriteHeader(resp.StatusCode)
        w.Write(body)
        return
    }
    // parse token from Spotify response and set cookie, then redirect to SPA
    var data map[string]interface{}
    if err := json.Unmarshal(body, &data); err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid token response"})
        return
    }
    at, _ := data["access_token"].(string)
    if at == "" {
        // fallback: keep raw body but set generic cookie
        http.SetCookie(w, &http.Cookie{Name: "access_token", Value: "real-token", Path: "/", Expires: time.Now().Add(24 * time.Hour)})
    } else {
        http.SetCookie(w, &http.Cookie{Name: "access_token", Value: at, Path: "/", Expires: time.Now().Add(24 * time.Hour)})
    }
    http.Redirect(w, r, "/", http.StatusFound)
}

func meHandler(w http.ResponseWriter, r *http.Request) {
    // Check Authorization header
    auth := r.Header.Get("Authorization")
    // prefer Authorization header, fallback to cookie
    token := ""
    if auth != "" {
        token = strings.TrimPrefix(auth, "Bearer ")
    } else if c, err := r.Cookie("access_token"); err == nil {
        token = c.Value
    }

    if spotifyClientID == "" || spotifyClientSecret == "" {
        // mock mode
        writeJSON(w, http.StatusOK, map[string]interface{}{"id": "mock-user", "display_name": "Mock User"})
        return
    }

    if token == "" {
        writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing token"})
        return
    }

    req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "https://api.spotify.com/v1/me", nil)
    req.Header.Set("Authorization", "Bearer "+token)
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
        return
    }
    defer resp.Body.Close()
    body, _ := io.ReadAll(resp.Body)
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)
    w.Write(body)
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("album")
    if q == "" {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing album query"})
        return
    }
    if spotifyClientID == "" || spotifyClientSecret == "" {
        // return mock albums
        resp := map[string]interface{}{"albums": map[string]interface{}{"items": []map[string]interface{}{}}}
        items := []map[string]interface{}{
            {"id": "alb1", "name": q + " - Best Of", "artists": []map[string]string{{"name": "Mock Artist"}}},
            {"id": "alb2", "name": q + " (Deluxe)", "artists": []map[string]string{{"name": "Mock Artist 2"}}},
        }
        resp["albums"].(map[string]interface{})["items"] = items
        writeJSON(w, http.StatusOK, resp)
        return
    }
    // Real Spotify search
    apiURL := fmt.Sprintf("https://api.spotify.com/v1/search?q=%s&type=album&limit=10", urlEncode(q))
    req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, apiURL, nil)
    if c, err := r.Cookie("access_token"); err == nil {
        req.Header.Set("Authorization", "Bearer "+c.Value)
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
        return
    }
    defer resp.Body.Close()
    body, _ := io.ReadAll(resp.Body)
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)
    w.Write(body)
}

func albumTracksHandler(w http.ResponseWriter, r *http.Request) {
    // Expect path /api/albums/{id}/tracks
    p := strings.TrimPrefix(r.URL.Path, "/api/albums/")
    id := strings.TrimSuffix(p, "/tracks")
    id = strings.Trim(id, "/")
    if id == "" {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing album id"})
        return
    }
    if spotifyClientID == "" || spotifyClientSecret == "" {
        // Mock tracks
        tracks := []map[string]interface{}{}
        for i := 1; i <= 6; i++ {
            tracks = append(tracks, map[string]interface{}{"id": fmt.Sprintf("%s-tr%d", id, i), "name": fmt.Sprintf("Track %d", i), "duration_ms": 180000 + i*1000})
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{"items": tracks})
        return
    }
    apiURL := fmt.Sprintf("https://api.spotify.com/v1/albums/%s/tracks", id)
    req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, apiURL, nil)
    if c, err := r.Cookie("access_token"); err == nil {
        req.Header.Set("Authorization", "Bearer "+c.Value)
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
        return
    }
    defer resp.Body.Close()
    body, _ := io.ReadAll(resp.Body)
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)
    w.Write(body)
}

// --- small util functions ---
func urlEncode(s string) string {
    return strings.ReplaceAll(s, " ", "%20")
}

func urlEncodeForm(m map[string]string) string {
    parts := []string{}
    for k, v := range m {
        parts = append(parts, fmt.Sprintf("%s=%s", k, urlEncode(v)))
    }
    return strings.Join(parts, "&")
}
