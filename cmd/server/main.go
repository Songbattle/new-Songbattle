package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
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
	discordWebhookURL = os.Getenv("DISCORD_WEBHOOK_URL")

	// Load persisted token if available
	if err := loadTokenFromFile(); err != nil {
		log.Printf("Warning: could not load token from file: %v", err)
	} else if globalAccessToken != "" {
		log.Println("Token loaded successfully from persistent storage")
		// If token is already expired or about to expire, try to refresh it immediately
		if time.Now().Add(5 * time.Minute).After(globalTokenExpiry) {
			log.Println("Loaded token is expired or about to expire, refreshing...")
			if err := refreshGlobalToken(); err != nil {
				log.Printf("Failed to refresh token on startup: %v", err)
			} else {
				if err := saveTokenToFile(); err != nil {
					log.Printf("Failed to save refreshed token: %v", err)
				}
			}
		}
	}

	// Start background token refresh routine
	startTokenRefreshRoutine()

	// start results cleanup: remove files older than configured TTL every configured interval
	resultsDir := "./web/results"
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
	go startUploadsCleanup(resultsDir, time.Duration(ttlDays)*24*time.Hour, time.Duration(intervalHours)*time.Hour)

	// Setup HTTP routes
	addr := ":8080"
	http.HandleFunc("/login", cors(adminLoginHandler))
	http.HandleFunc("/admin-callback", cors(adminCallbackHandler))
	http.HandleFunc("/api/config", cors(configHandler))
	http.HandleFunc("/api/upload-image", cors(uploadImageHandler))
	http.HandleFunc("/api/generate-image", cors(generateImageHandler))
	http.HandleFunc("/api/version", cors(versionHandler))
	http.HandleFunc("/api/search", cors(searchHandler))
	http.HandleFunc("/api/albums/", cors(albumTracksHandler))
	http.HandleFunc("/api/playlists/", cors(playlistTracksHandler))
	http.HandleFunc("/api/token-status", cors(tokenStatusHandler))

	// serve result images
	http.Handle("/results/", http.StripPrefix("/results/", http.FileServer(http.Dir("./web/results"))))

	// static files - serve built React app from web/dist with SPA fallback
	http.HandleFunc("/", spaHandler)

	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
