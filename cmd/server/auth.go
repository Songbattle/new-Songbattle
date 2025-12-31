package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Global authentication variables
var (
	spotifyClientID     string
	spotifyClientSecret string
	spotifyRedirect     string
	globalAccessToken   string
	globalRefreshToken  string
	globalTokenExpiry   time.Time
)

// TokenData represents the structure for persisting tokens
type TokenData struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	Expiry       time.Time `json:"expiry"`
}

const tokenFilePath = "./data/spotify_token.json"

// loadTokenFromFile loads the stored token from disk
func loadTokenFromFile() error {
	data, err := os.ReadFile(tokenFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No token file yet, that's ok
		}
		return err
	}

	var tokenData TokenData
	if err := json.Unmarshal(data, &tokenData); err != nil {
		return err
	}

	// Only load if token is still valid or can be refreshed
	if tokenData.RefreshToken != "" {
		globalAccessToken = tokenData.AccessToken
		globalRefreshToken = tokenData.RefreshToken
		globalTokenExpiry = tokenData.Expiry
		log.Printf("Token loaded from file. Expiry: %s", globalTokenExpiry.Format(time.RFC3339))
		return nil
	}

	return nil
}

// saveTokenToFile saves the current token to disk
func saveTokenToFile() error {
	if globalAccessToken == "" || globalRefreshToken == "" {
		return nil // Nothing to save
	}

	tokenData := TokenData{
		AccessToken:  globalAccessToken,
		RefreshToken: globalRefreshToken,
		Expiry:       globalTokenExpiry,
	}

	data, err := json.MarshalIndent(tokenData, "", "  ")
	if err != nil {
		return err
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(tokenFilePath), 0755); err != nil {
		return err
	}

	if err := os.WriteFile(tokenFilePath, data, 0600); err != nil {
		return err
	}

	log.Printf("Token saved to file")
	return nil
}

// startTokenRefreshRoutine starts a background goroutine that periodically checks and refreshes the token
func startTokenRefreshRoutine() {
	go func() {
		for {
			// Check every minute
			time.Sleep(1 * time.Minute)

			if globalAccessToken == "" || globalRefreshToken == "" {
				continue
			}

			// Refresh if token expires in less than 5 minutes
			if time.Now().Add(5 * time.Minute).After(globalTokenExpiry) {
				log.Println("Token is about to expire, refreshing...")
				if err := refreshGlobalToken(); err != nil {
					log.Printf("Failed to refresh token in background: %v", err)
				} else {
					// Save the refreshed token
					if err := saveTokenToFile(); err != nil {
						log.Printf("Failed to save refreshed token: %v", err)
					}
				}
			}
		}
	}()
	log.Println("Token refresh routine started")
}

// adminLoginHandler initiates Spotify OAuth for server-side token management
func adminLoginHandler(w http.ResponseWriter, r *http.Request) {
	// Check if valid token already exists
	if globalAccessToken != "" && time.Now().Before(globalTokenExpiry) {
		message := fmt.Sprintf("Valid token already exists. Login not needed. (Expires: %s)", globalTokenExpiry.Format("2006-01-02 15:04:05"))
		http.Redirect(w, r, "/?login-info="+urlEncode(message), http.StatusFound)
		return
	}

	if spotifyClientID == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"mock": true, "message": "No Spotify creds set; using mock mode"})
		return
	}

	// Build redirect URL from request
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	redirectURL := fmt.Sprintf("%s://%s/admin-callback", scheme, host)

	scopes := "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read"
	url := fmt.Sprintf("https://accounts.spotify.com/authorize?response_type=code&client_id=%s&scope=%s&redirect_uri=%s", spotifyClientID, urlEncode(scopes), urlEncode(redirectURL))
	http.Redirect(w, r, url, http.StatusFound)
}

// tokenStatusHandler returns whether the server has a valid token
func tokenStatusHandler(w http.ResponseWriter, r *http.Request) {
	hasToken := globalAccessToken != "" && time.Now().Before(globalTokenExpiry)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"hasToken": hasToken,
		"expiry":   globalTokenExpiry.Format(time.RFC3339),
	})
}

// refreshGlobalToken refreshes the global Spotify access token
func refreshGlobalToken() error {
	if globalRefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	form := urlEncodeForm(map[string]string{
		"grant_type":    "refresh_token",
		"refresh_token": globalRefreshToken,
	})

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(form))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(spotifyClientID, spotifyClientSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		// Token refresh failed - notify Discord
		notifyDiscordTokenExpired()
		return fmt.Errorf("token refresh failed: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return err
	}

	accessToken, _ := data["access_token"].(string)
	expiresIn, _ := data["expires_in"].(float64)

	if accessToken != "" {
		globalAccessToken = accessToken
		globalTokenExpiry = time.Now().Add(time.Duration(expiresIn) * time.Second)
		log.Printf("Token refreshed successfully, expires at %s", globalTokenExpiry.Format(time.RFC3339))
	}

	// Update refresh token if provided
	if newRefreshToken, ok := data["refresh_token"].(string); ok && newRefreshToken != "" {
		globalRefreshToken = newRefreshToken
	}

	// Save refreshed token to file
	if err := saveTokenToFile(); err != nil {
		log.Printf("Failed to save refreshed token to file: %v", err)
	}

	return nil
}

// getValidToken returns a valid access token, refreshing if necessary
func getValidToken() (string, error) {
	if globalAccessToken == "" {
		return "", fmt.Errorf("no token available")
	}

	// Refresh if token expires in less than 5 minutes
	if time.Now().Add(5 * time.Minute).After(globalTokenExpiry) {
		if err := refreshGlobalToken(); err != nil {
			return "", err
		}
	}

	return globalAccessToken, nil
}

// adminCallbackHandler handles OAuth callback and stores token server-side
func adminCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if spotifyClientID == "" || spotifyClientSecret == "" {
		globalAccessToken = "mock-token"
		globalTokenExpiry = time.Now().Add(24 * time.Hour)
		http.Redirect(w, r, "/?admin=success", http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing code"})
		return
	}

	// Build redirect URL from request
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	redirectURL := fmt.Sprintf("%s://%s/admin-callback", scheme, host)

	// Exchange code for token
	form := urlEncodeForm(map[string]string{
		"grant_type":   "authorization_code",
		"code":         code,
		"redirect_uri": redirectURL,
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

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid token response"})
		return
	}

	accessToken, _ := data["access_token"].(string)
	refreshToken, _ := data["refresh_token"].(string)
	expiresIn, _ := data["expires_in"].(float64)

	if accessToken != "" {
		globalAccessToken = accessToken
		globalRefreshToken = refreshToken
		globalTokenExpiry = time.Now().Add(time.Duration(expiresIn) * time.Second)
		log.Printf("Server token acquired successfully, expires at %s", globalTokenExpiry.Format(time.RFC3339))
		notifyDiscordTokenSuccess(globalTokenExpiry)

		// Save token to file for persistence
		if err := saveTokenToFile(); err != nil {
			log.Printf("Failed to save token to file: %v", err)
		}
	}

	http.Redirect(w, r, "/?admin=success", http.StatusFound)
}
