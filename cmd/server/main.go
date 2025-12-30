package main

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/inconsolata"
	"golang.org/x/image/math/fixed"
)

// Version info set by build flags
var (
	GitCommit = "dev"
	BuildDate = "unknown"
	GitTag    = "" // Set when building from a release tag
)

func main() {
	// load .env file if present so local environment variables are available
	if _, err := os.Stat(".env"); err == nil {
		if err := loadDotEnv(".env"); err != nil {
			log.Printf("warning: could not load .env: %v", err)
		}
	}

	// assign globals from environment after possible .env load
	spotifyClientID = os.Getenv("SPOTIFY_CLIENT_ID")
	spotifyClientSecret = os.Getenv("SPOTIFY_CLIENT_SECRET")
	spotifyRedirect = os.Getenv("SPOTIFY_REDIRECT_URL")
	// start uploads cleanup: remove files older than configured TTL every configured interval
	uploadDir := "./web/uploads"
	// defaults
	ttlDays := 30
	intervalHours := 24
	if v := os.Getenv("UPLOAD_TTL_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			ttlDays = n
		}
	}
	if v := os.Getenv("UPLOAD_CLEANUP_INTERVAL_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			intervalHours = n
		}
	}
	go startUploadsCleanup(uploadDir, time.Duration(ttlDays)*24*time.Hour, time.Duration(intervalHours)*time.Hour)

	addr := ":8080"
	http.HandleFunc("/api/login", cors(loginHandler))
	http.HandleFunc("/api/callback", cors(callbackHandler))
	http.HandleFunc("/api/me", cors(meHandler))
	http.HandleFunc("/api/me/playlists", cors(myPlaylistsHandler))
	http.HandleFunc("/api/me/albums", cors(myAlbumsHandler))
	http.HandleFunc("/api/config", cors(configHandler))
	http.HandleFunc("/api/upload-image", cors(uploadImageHandler))
	http.HandleFunc("/api/generate-image", cors(generateImageHandler))
	http.HandleFunc("/api/version", cors(versionHandler))
	http.HandleFunc("/api/search", cors(searchHandler))
	http.HandleFunc("/api/albums/", cors(albumTracksHandler))
	http.HandleFunc("/api/playlists/", cors(playlistTracksHandler))

	// serve uploaded images
	http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./web/uploads"))))

	// static files - serve built React app from web/dist with SPA fallback
	http.HandleFunc("/", spaHandler)

	log.Printf("Server starting on %s", addr)
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
	spotifyClientID     string
	spotifyClientSecret string
	spotifyRedirect     string
)

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if spotifyClientID == "" || spotifyRedirect == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"mock": true, "message": "No Spotify creds set; using mock mode"})
		return
	}
	scopes := "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read"
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
		// mock mode with avatar
		writeJSON(w, http.StatusOK, map[string]interface{}{"id": "mock-user", "display_name": "Mock User", "images": []map[string]string{{"url": "https://picsum.photos/seed/mock-user/48"}}})
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

func myPlaylistsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user's playlists, limit to 5
	token := ""
	if c, err := r.Cookie("access_token"); err == nil {
		token = c.Value
	}

	if spotifyClientID == "" || spotifyClientSecret == "" {
		// mock mode - return 5 mock playlists
		items := []map[string]interface{}{}
		for i := 1; i <= 5; i++ {
			items = append(items, map[string]interface{}{
				"id":     fmt.Sprintf("mypl%d", i),
				"name":   fmt.Sprintf("My Playlist %d", i),
				"owner":  map[string]string{"display_name": "Mock User"},
				"images": []map[string]string{{"url": fmt.Sprintf("https://picsum.photos/seed/mypl%d/80", i)}},
				"tracks": map[string]int{"total": 20 + i},
			})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
		return
	}

	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing token"})
		return
	}

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "https://api.spotify.com/v1/me/playlists?limit=5", nil)
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

func myAlbumsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user's saved albums, limit to 5
	token := ""
	if c, err := r.Cookie("access_token"); err == nil {
		token = c.Value
	}

	if spotifyClientID == "" || spotifyClientSecret == "" {
		// mock mode - return 5 mock albums
		items := []map[string]interface{}{}
		for i := 1; i <= 5; i++ {
			items = append(items, map[string]interface{}{
				"album": map[string]interface{}{
					"id":      fmt.Sprintf("myalb%d", i),
					"name":    fmt.Sprintf("My Album %d", i),
					"artists": []map[string]string{{"name": "Mock Artist"}},
					"images":  []map[string]string{{"url": fmt.Sprintf("https://picsum.photos/seed/myalb%d/80", i)}},
					"total_tracks": 10 + i,
				},
			})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
		return
	}

	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing token"})
		return
	}

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "https://api.spotify.com/v1/me/albums?limit=5", nil)
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
	// If client supplies a full `next` or `previous` URL (Spotify absolute URL), proxy it server-side
	if nxt := r.URL.Query().Get("next"); nxt != "" {
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, nxt, nil)
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
		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
		w.WriteHeader(resp.StatusCode)
		w.Write(body)
		return
	}
	if prev := r.URL.Query().Get("previous"); prev != "" {
		req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, prev, nil)
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
		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
		w.WriteHeader(resp.StatusCode)
		w.Write(body)
		return
	}
	// support album or playlist search
	q := r.URL.Query().Get("album")
	searchType := "album"
	if q == "" {
		q = r.URL.Query().Get("playlist")
		if q != "" {
			searchType = "playlist"
		}
	}
	if q == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing album or playlist query"})
		return
	}
	// support pagination params
	offset := 0
	limit := 10
	if of := r.URL.Query().Get("offset"); of != "" {
		fmt.Sscanf(of, "%d", &offset)
	}
	if lm := r.URL.Query().Get("limit"); lm != "" {
		fmt.Sscanf(lm, "%d", &limit)
	}

	if spotifyClientID == "" || spotifyClientSecret == "" {
		// return mock albums or playlists with paging and images
		total := 50
		items := []map[string]interface{}{}
		start := offset + 1
		end := offset + limit
		if end > total {
			end = total
		}
		for i := start; i <= end; i++ {
			id := fmt.Sprintf("%s%d", searchType[:3], i)
			if searchType == "album" {
				// mock total_tracks between 8 and 15
				tt := 8 + ((i - start) % 8)
				items = append(items, map[string]interface{}{"id": id, "name": fmt.Sprintf("%s — Album %d", q, i), "artists": []map[string]string{{"name": "Mock Artist"}}, "images": []map[string]string{{"url": fmt.Sprintf("https://picsum.photos/seed/%s-%d/80", q, i)}}, "total_tracks": tt})
			} else {
				// playlist mock: include owner and images
				items = append(items, map[string]interface{}{"id": id, "name": fmt.Sprintf("%s — Playlist %d", q, i), "owner": map[string]string{"display_name": "Mock User"}, "images": []map[string]string{{"url": fmt.Sprintf("https://picsum.photos/seed/%s-pl-%d/80", q, i)}}, "tracks": map[string]int{"total": 15}})
			}
		}
		// compute next/previous as relative API URLs
		var nextURL *string = nil
		var prevURL *string = nil
		if offset+limit < total {
			n := fmt.Sprintf("/api/search?%s=%s&offset=%d&limit=%d", searchType, urlEncode(q), offset+limit, limit)
			nextURL = &n
		}
		if offset-limit >= 0 {
			p := fmt.Sprintf("/api/search?%s=%s&offset=%d&limit=%d", searchType, urlEncode(q), offset-limit, limit)
			prevURL = &p
		}
		albums := map[string]interface{}{"items": items, "total": total, "limit": limit, "offset": offset}
		if nextURL != nil {
			albums["next"] = *nextURL
		} else {
			albums["next"] = nil
		}
		if prevURL != nil {
			albums["previous"] = *prevURL
		} else {
			albums["previous"] = nil
		}
		// return under albums key for compatibility; frontend filters fields
		resp := map[string]interface{}{"albums": albums}
		writeJSON(w, http.StatusOK, resp)
		return
	}
	// Real Spotify search
	apiURL := fmt.Sprintf("https://api.spotify.com/v1/search?q=%s&type=%s&limit=10", urlEncode(q), searchType)
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

func playlistTracksHandler(w http.ResponseWriter, r *http.Request) {
	// Expect path /api/playlists/{id}/tracks
	p := strings.TrimPrefix(r.URL.Path, "/api/playlists/")
	id := strings.TrimSuffix(p, "/tracks")
	id = strings.Trim(id, "/")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing playlist id"})
		return
	}
	if spotifyClientID == "" || spotifyClientSecret == "" {
		// Mock tracks
		tracks := []map[string]interface{}{}
		for i := 1; i <= 8; i++ {
			tracks = append(tracks, map[string]interface{}{"id": fmt.Sprintf("%s-tr%d", id, i), "name": fmt.Sprintf("Track %d", i), "duration_ms": 180000 + i*1000})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": tracks})
		return
	}
	apiURL := fmt.Sprintf("https://api.spotify.com/v1/playlists/%s/tracks", id)
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

// configHandler exposes small runtime config values (e.g. share link) from env
func configHandler(w http.ResponseWriter, r *http.Request) {
	share := os.Getenv("SHARE_URL")
	if share == "" {
		// provide empty string instead of null for JS friendliness
		share = ""
	}
	writeJSON(w, http.StatusOK, map[string]string{"share_url": share})
}

// versionHandler returns build version information
func versionHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]string{
		"commit": GitCommit,
		"date":   BuildDate,
	}
	if GitTag != "" {
		response["tag"] = GitTag
	}
	writeJSON(w, http.StatusOK, response)
}

// uploadImageHandler accepts a multipart/form-data POST with `file` and saves it under web/uploads
func uploadImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	// parse multipart
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart"})
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing file"})
		return
	}
	defer file.Close()
	// ensure upload dir
	uploadDir := "./web/uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create upload dir"})
		return
	}
	// create filename
	fn := fmt.Sprintf("%d.png", time.Now().UnixNano())
	full := uploadDir + "/" + fn
	out, err := os.Create(full)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create file"})
		return
	}
	defer out.Close()
	if _, err := io.Copy(out, file); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot save file"})
		return
	}
	// return a public URL path relative to web root
	url := "/uploads/" + fn
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

// generateImageHandler generates a results image server-side
func generateImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	
	var req struct {
		Title    string            `json:"title"`
		Items    []struct {
			Rank  int    `json:"rank"`
			Name  string `json:"name"`
			Score int    `json:"score"`
		} `json:"items"`
		ShareURL   string `json:"shareUrl"`
		CoverImage string `json:"coverImage"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	
	uploadDir := "./web/uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create upload dir"})
		return
	}
	
	// Create image
	const width = 800
	lineHeight := 35
	titleHeight := 90
	coverSize := 120
	padding := 25
	footerHeight := 60
	
	itemsHeight := len(req.Items) * lineHeight
	height := titleHeight + coverSize + itemsHeight + footerHeight + padding*6
	
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	
	// Background color (dark, similar to app)
	bgColor := color.RGBA{26, 29, 41, 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{bgColor}, image.Point{}, draw.Src)
	
	// Fetch and draw cover image if provided
	if req.CoverImage != "" {
		resp, err := http.Get(req.CoverImage)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				coverImg, _, err := image.Decode(resp.Body)
				if err == nil {
					// Draw cover image centered and scaled
					srcBounds := coverImg.Bounds()
					for y := 0; y < coverSize; y++ {
						for x := 0; x < coverSize; x++ {
							srcX := srcBounds.Min.X + (x * srcBounds.Dx() / coverSize)
							srcY := srcBounds.Min.Y + (y * srcBounds.Dy() / coverSize)
							img.Set(width/2-coverSize/2+x, titleHeight+padding+y, coverImg.At(srcX, srcY))
						}
					}
				} else {
					log.Printf("Failed to decode cover image: %v", err)
				}
			} else {
				log.Printf("Failed to fetch cover: HTTP %d", resp.StatusCode)
			}
		} else {
			log.Printf("Failed to fetch cover image: %v", err)
		}
	}
	
	// Draw text
	textColor := color.RGBA{255, 255, 255, 255}
	subtitleColor := color.RGBA{180, 180, 180, 255}
	y := titleHeight - 50
	
	// Subtitle first (centered)
	subtitle := "My Favorite Ranking"
	addLabel(img, width/2-len(subtitle)*4, y, subtitle, subtitleColor)
	
	// Title below (centered)
	y += 30
	addLabel(img, width/2-len(req.Title)*4, y, req.Title, textColor)
	
	// Items (centered, without points)
	y = titleHeight + coverSize + padding*2
	for _, item := range req.Items {
		text := fmt.Sprintf("%d. %s", item.Rank, item.Name)
		if len(text) > 90 {
			text = text[:87] + "..."
		}
		// Center the text
		textWidth := len(text) * 8 // inconsolata.Regular8x16 is ~8px wide per char
		addLabel(img, width/2-textWidth/2, y, text, textColor)
		y += lineHeight
	}
	
	// Footer (share URL, centered)
	if req.ShareURL != "" {
		y += padding
		urlWidth := len(req.ShareURL) * 7
		addLabel(img, width/2-urlWidth/2, y, req.ShareURL, color.RGBA{150, 150, 150, 255})
	}
	
	// Save to file
	fn := fmt.Sprintf("%d.png", time.Now().UnixNano())
	full := filepath.Join(uploadDir, fn)
	
	f, err := os.Create(full)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create file"})
		return
	}
	defer f.Close()
	
	if err := png.Encode(f, img); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot encode image"})
		return
	}
	
	// Return relative URL (browser will use correct base)
	url := "/uploads/" + fn
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

// addLabel draws text on an image at position (x,y)
func addLabel(img *image.RGBA, x, y int, label string, col color.Color) {
	point := fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)}
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(col),
		Face: inconsolata.Regular8x16,
		Dot:  point,
	}
	d.DrawString(label)
}

// startUploadsCleanup starts a background goroutine that periodically
// deletes files in dir older than olderThan. It performs one immediate run
// and then repeats every interval.
func startUploadsCleanup(dir string, olderThan, interval time.Duration) {
	// perform initial cleanup
	cleanupUploadsOnce(dir, olderThan)
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			cleanupUploadsOnce(dir, olderThan)
		}
	}()
}

func cleanupUploadsOnce(dir string, olderThan time.Duration) {
	// ensure dir exists
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("cleanup: cannot read upload dir: %v", err)
		return
	}
	now := time.Now()
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		p := filepath.Join(dir, e.Name())
		fi, err := os.Stat(p)
		if err != nil {
			continue
		}
		if now.Sub(fi.ModTime()) > olderThan {
			if err := os.Remove(p); err != nil {
				log.Printf("cleanup: failed to remove %s: %v", p, err)
			} else {
				log.Printf("cleanup: removed old upload %s", p)
			}
		}
	}
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

// loadDotEnv is a tiny .env loader: parses KEY=VALUE lines and sets env vars.
func loadDotEnv(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		eq := strings.Index(line, "=")
		if eq <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		// strip optional surrounding quotes
		if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
			val = val[1 : len(val)-1]
		}
		os.Setenv(key, val)
	}
	return nil
}

// spaHandler serves static files from web/dist and falls back to index.html for client-side routing
func spaHandler(w http.ResponseWriter, r *http.Request) {
	staticDir := "./web/dist"
	path := filepath.Join(staticDir, r.URL.Path)
	
	// Check if file exists
	fileInfo, err := os.Stat(path)
	if err == nil && !fileInfo.IsDir() {
		// File exists, serve it
		http.ServeFile(w, r, path)
		return
	}
	
	// Check if path is a directory with index.html
	if err == nil && fileInfo.IsDir() {
		indexPath := filepath.Join(path, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
			return
		}
	}
	
	// Fallback to index.html for SPA routing (except for /api and /uploads)
	if !strings.HasPrefix(r.URL.Path, "/api") && !strings.HasPrefix(r.URL.Path, "/uploads") {
		indexPath := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
			return
		}
	}
	
	// If nothing worked, return 404
	http.NotFound(w, r)
}
