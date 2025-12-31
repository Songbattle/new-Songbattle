package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// searchHandler handles album and playlist search requests
func searchHandler(w http.ResponseWriter, r *http.Request) {
	// If client supplies a full `next` or `previous` URL (Spotify absolute URL), proxy it server-side
	if nxt := r.URL.Query().Get("next"); nxt != "" {
		token, err := getValidToken()
		if err == nil {
			req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, nxt, nil)
			req.Header.Set("Authorization", "Bearer "+token)
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
		}
		return
	}
	if prev := r.URL.Query().Get("previous"); prev != "" {
		token, err := getValidToken()
		if err == nil {
			req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, prev, nil)
			req.Header.Set("Authorization", "Bearer "+token)
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
		}
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
	token, err := getValidToken()
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no valid token available"})
		return
	}

	apiURL := fmt.Sprintf("https://api.spotify.com/v1/search?q=%s&type=%s&limit=%d&offset=%d", urlEncode(q), searchType, limit, offset)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Check for rate limit or errors
	if resp.StatusCode == 429 {
		notifyDiscordRateLimit()
	} else if resp.StatusCode >= 400 {
		notifyDiscordError("/api/search", resp.StatusCode, string(body))
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// albumTracksHandler fetches tracks for a given album
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

	token, err := getValidToken()
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no valid token available"})
		return
	}

	apiURL := fmt.Sprintf("https://api.spotify.com/v1/albums/%s/tracks", id)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Check for rate limit or errors
	if resp.StatusCode == 429 {
		notifyDiscordRateLimit()
	} else if resp.StatusCode >= 400 {
		notifyDiscordError("/api/albums/tracks", resp.StatusCode, string(body))
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// playlistTracksHandler fetches tracks for a given playlist
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

	token, err := getValidToken()
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no valid token available"})
		return
	}

	apiURL := fmt.Sprintf("https://api.spotify.com/v1/playlists/%s/tracks", id)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Check for rate limit or errors
	if resp.StatusCode == 429 {
		notifyDiscordRateLimit()
	} else if resp.StatusCode >= 400 {
		notifyDiscordError("/api/playlists/tracks", resp.StatusCode, string(body))
	}

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
