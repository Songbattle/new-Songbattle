package main

import (
	"crypto/rand"
	"encoding/hex"
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
	"strings"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/inconsolata"
	"golang.org/x/image/math/fixed"
)

// uploadImageHandler accepts a multipart/form-data POST with `file` and saves it under web/results
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
	resultsDir := "./web/results"
	if err := os.MkdirAll(resultsDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create results dir"})
		return
	}
	// create filename with random string
	randomStr := generateRandomString(8)
	fn := fmt.Sprintf("upload_%s.png", randomStr)
	full := resultsDir + "/" + fn
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
	url := "/results/" + fn
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

// generateImageHandler generates a results image server-side
func generateImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		Title      string `json:"title"`
		AlbumID    string `json:"albumId"`
		Items      []struct {
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

	resultsDir := "./web/results"
	if err := os.MkdirAll(resultsDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "cannot create results dir"})
		return
	}

	// Create image
	const width = 800
	lineHeight := 35
	titleHeight := 90
	coverSize := 120
	padding := 25
	coverPadding := 10 // Reduced padding between title and cover
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
							img.Set(width/2-coverSize/2+x, titleHeight+coverPadding+y, coverImg.At(srcX, srcY))
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
	y = titleHeight + coverSize + coverPadding + padding
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
	// Generate filename: albumId_randomstring.png
	albumIDSafe := sanitizeFilename(req.AlbumID)
	if albumIDSafe == "" {
		albumIDSafe = "unknown"
	}
	randomStr := generateRandomString(8)
	fn := fmt.Sprintf("%s_%s.png", albumIDSafe, randomStr)
	full := filepath.Join(resultsDir, fn)

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
	url := "/results/" + fn

	// Send Discord notification
	go notifyDiscordImageGenerated(req.Title, len(req.Items), url, r)

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

// generateRandomString generates a cryptographically secure random hex string
func generateRandomString(length int) string {
	bytes := make([]byte, length/2+1)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp if crypto/rand fails
		return fmt.Sprintf("%x", time.Now().UnixNano())[:length]
	}
	return hex.EncodeToString(bytes)[:length]
}

// sanitizeFilename removes/replaces characters that are unsafe for filenames
func sanitizeFilename(s string) string {
	// Replace common unsafe characters with underscore
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
		" ", "_",
	)
	clean := replacer.Replace(s)
	// Limit length
	if len(clean) > 50 {
		clean = clean[:50]
	}
	return clean
}
