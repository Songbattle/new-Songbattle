package main

import (
	"math"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// rateLimiter is a per-key token bucket limiter.
// Each key (client IP) may burst up to `burst` requests and refills at `rate` tokens per second.
type rateLimiter struct {
	mu      sync.Mutex
	rate    float64
	burst   float64
	buckets map[string]*bucket
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newRateLimiter(perMinute, burst int) *rateLimiter {
	return &rateLimiter{
		rate:    float64(perMinute) / 60.0,
		burst:   float64(burst),
		buckets: make(map[string]*bucket),
	}
}

// allow reports whether a request for key is allowed. If not, retryAfter tells
// how long the client should wait.
func (l *rateLimiter) allow(key string, now time.Time) (ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	b, found := l.buckets[key]
	if !found {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now

	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	missing := 1 - b.tokens
	return false, time.Duration(missing / l.rate * float64(time.Second))
}

// cleanup removes buckets that have been idle long enough to be fully refilled.
func (l *rateLimiter) cleanup(now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	idle := time.Duration(l.burst/l.rate*float64(time.Second)) + time.Minute
	for k, b := range l.buckets {
		if now.Sub(b.last) > idle {
			delete(l.buckets, k)
		}
	}
}

func (l *rateLimiter) startCleanup(interval time.Duration) {
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for now := range t.C {
			l.cleanup(now)
		}
	}()
}

// clientIP returns the client address. Proxy headers are only honoured when
// TRUST_PROXY=true, otherwise they could be spoofed to bypass the limit.
// The header is configurable via CLIENT_IP_HEADER (default X-Forwarded-For, which
// Traefik sets). Use CF-Connecting-IP only if Cloudflare is the outermost proxy
// and requests can not reach the server without passing through it.
func clientIP(r *http.Request) string {
	if os.Getenv("TRUST_PROXY") == "true" {
		header := os.Getenv("CLIENT_IP_HEADER")
		if header == "" {
			header = "X-Forwarded-For"
		}
		if v := r.Header.Get(header); v != "" {
			if ip := strings.TrimSpace(strings.Split(v, ",")[0]); ip != "" {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// limit wraps a handler and answers 429 when the client exceeds the limiter.
// The JSON body carries "source":"server" so the frontend can tell it apart
// from a rate limit hit at Spotify.
func (l *rateLimiter) limit(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Let CORS preflight requests through; they are cheap.
		if r.Method == http.MethodOptions {
			h(w, r)
			return
		}
		ok, retry := l.allow(clientIP(r), time.Now())
		if !ok {
			secs := int(math.Ceil(retry.Seconds()))
			w.Header().Set("Retry-After", strconv.Itoa(secs))
			writeJSON(w, http.StatusTooManyRequests, map[string]interface{}{
				"error":      "rate_limited",
				"source":     "server",
				"retryAfter": secs,
			})
			return
		}
		h(w, r)
	}
}

// envInt reads a positive integer from the environment, falling back to def.
func envInt(name string, def int) int {
	if v := os.Getenv(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}
