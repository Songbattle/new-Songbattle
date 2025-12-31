package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

var discordWebhookURL string

// notifyDiscordTokenExpired sends a notification to Discord when token expires
func notifyDiscordTokenExpired() {
	if discordWebhookURL == "" {
		return
	}

	message := map[string]interface{}{
		"content": "⚠️ Spotify token has expired and could not be refreshed. Please re-authenticate at /login",
	}

	jsonData, _ := json.Marshal(message)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, discordWebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Discord webhook returned error: %d", resp.StatusCode)
	} else {
		log.Println("Discord notification sent successfully")
	}
}

// notifyDiscordTokenSuccess sends a notification to Discord when new token is acquired
func notifyDiscordTokenSuccess(expiryTime time.Time) {
	if discordWebhookURL == "" {
		return
	}

	message := map[string]interface{}{
		"content": fmt.Sprintf("✅ New Spotify token acquired successfully. Expires at %s", expiryTime.Format(time.RFC3339)),
	}

	jsonData, _ := json.Marshal(message)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, discordWebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Discord webhook returned error: %d", resp.StatusCode)
	} else {
		log.Println("Discord notification sent successfully")
	}
}

// notifyDiscordRateLimit sends a notification to Discord when Spotify rate limit is hit
func notifyDiscordRateLimit() {
	if discordWebhookURL == "" {
		return
	}

	message := map[string]interface{}{
		"content": "🚨 Spotify API rate limit (429) encountered. Please wait before making more requests.",
	}

	jsonData, _ := json.Marshal(message)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, discordWebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Discord webhook returned error: %d", resp.StatusCode)
	} else {
		log.Println("Discord notification sent successfully")
	}
}

// notifyDiscordError sends a notification to Discord for general API errors
func notifyDiscordError(endpoint string, statusCode int, errorMsg string) {
	if discordWebhookURL == "" {
		return
	}

	message := map[string]interface{}{
		"content": fmt.Sprintf("❌ Spotify API error at %s: HTTP %d - %s", endpoint, statusCode, errorMsg),
	}

	jsonData, _ := json.Marshal(message)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, discordWebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Discord webhook returned error: %d", resp.StatusCode)
	} else {
		log.Println("Discord notification sent successfully")
	}
}

// notifyDiscordImageGenerated sends a notification to Discord when an image is generated
func notifyDiscordImageGenerated(title string, itemCount int, imageURL string, r *http.Request) {
	if discordWebhookURL == "" {
		return
	}

	// Build full URL
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	fullURL := fmt.Sprintf("%s://%s%s", scheme, r.Host, imageURL)

	message := map[string]interface{}{
		"content": fmt.Sprintf("🎨 New ranking image generated!\n**Title:** %s\n**Items:** %d\n**URL:** %s", title, itemCount, fullURL),
		"embeds": []map[string]interface{}{
			{
				"title":       title,
				"description": fmt.Sprintf("Ranking with %d items", itemCount),
				"color":       3447003, // Blue color
				"image": map[string]string{
					"url": fullURL,
				},
				"timestamp": time.Now().Format(time.RFC3339),
			},
		},
	}

	jsonData, _ := json.Marshal(message)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, discordWebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to send Discord notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Discord webhook returned error: %d", resp.StatusCode)
	} else {
		log.Println("Discord notification sent successfully for image generation")
	}
}
