package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// writeJSON is a helper to write JSON responses
func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// cors adds CORS headers to HTTP handlers
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

// urlEncode is a simple URL encoding helper
func urlEncode(s string) string {
	return url.QueryEscape(s)
}

// urlEncodeForm creates a URL-encoded form string from a map
func urlEncodeForm(data map[string]string) string {
	vals := url.Values{}
	for k, v := range data {
		vals.Set(k, v)
	}
	return vals.Encode()
}

// startUploadsCleanup starts a background goroutine that periodically
// deletes files in dir older than olderThan. It performs one immediate run
// and then repeats every interval.
func startUploadsCleanup(dir string, olderThan, interval time.Duration) {
	// perform initial cleanup
	cleanupUploadsOnce(dir, olderThan)
	// repeat periodically
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			cleanupUploadsOnce(dir, olderThan)
		}
	}()
	log.Printf("Results cleanup started: deleting files older than %v every %v", olderThan, interval)
}

func cleanupUploadsOnce(dir string, olderThan time.Duration) {
	// ensure dir exists
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("Failed to read upload dir: %v", err)
		return
	}
	cutoff := time.Now().Add(-olderThan)
	deleted := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(dir, e.Name())
			if err := os.Remove(path); err == nil {
				deleted++
			} else {
				log.Printf("Failed to remove old file %s: %v", path, err)
			}
		}
	}
	if deleted > 0 {
		log.Printf("Cleaned up %d old result files", deleted)
	}
}

// loadDotEnv is a tiny .env loader: parses KEY=VALUE lines and sets env vars.
func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// split on first '='
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// remove surrounding quotes if present
		if len(val) >= 2 && val[0] == '"' && val[len(val)-1] == '"' {
			val = val[1 : len(val)-1]
		}
		os.Setenv(key, val)
	}
	return scanner.Err()
}

// spaHandler serves static files from web/dist and falls back to index.html for client-side routing
func spaHandler(w http.ResponseWriter, r *http.Request) {
	staticDir := "./web/dist"
	path := filepath.Join(staticDir, r.URL.Path)

	// Check if file exists
	fileInfo, err := os.Stat(path)

	// If file doesn't exist or is a directory, check for index.html
	if err != nil || fileInfo.IsDir() {
		// For directories, try to serve index.html from that directory
		if err == nil && fileInfo.IsDir() {
			indexPath := filepath.Join(path, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
		}

		// Fallback to index.html for SPA routing (except for /api and /results)
		if !strings.HasPrefix(r.URL.Path, "/api") && !strings.HasPrefix(r.URL.Path, "/results") {
			indexPath := filepath.Join(staticDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
		}

		// If nothing worked, return 404
		http.NotFound(w, r)
		return
	}

	// File exists, serve it
	http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
}
