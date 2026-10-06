package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterBurstAndRefill(t *testing.T) {
	l := newRateLimiter(60, 3) // 1 token/second, burst 3
	now := time.Now()

	for i := 0; i < 3; i++ {
		if ok, _ := l.allow("a", now); !ok {
			t.Fatalf("request %d should be allowed within burst", i)
		}
	}
	ok, retry := l.allow("a", now)
	if ok {
		t.Fatal("4th request should be limited")
	}
	if retry <= 0 || retry > time.Second {
		t.Fatalf("unexpected retryAfter: %v", retry)
	}
	// other keys are independent
	if ok, _ := l.allow("b", now); !ok {
		t.Fatal("other key must not be limited")
	}
	// after one second a token is back
	if ok, _ := l.allow("a", now.Add(time.Second)); !ok {
		t.Fatal("token should have refilled")
	}
}

func TestRateLimiterCleanup(t *testing.T) {
	l := newRateLimiter(60, 3)
	now := time.Now()
	l.allow("a", now)
	l.cleanup(now.Add(time.Hour))
	if len(l.buckets) != 0 {
		t.Fatalf("idle bucket should be removed, have %d", len(l.buckets))
	}
}

func TestLimitMiddleware(t *testing.T) {
	l := newRateLimiter(60, 1)
	h := l.limit(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	req.RemoteAddr = "1.2.3.4:5555"

	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first request: got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: got %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After header")
	}
}

func TestClientIPProxyHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	req.Header.Set("X-Forwarded-For", "9.9.9.9, 10.0.0.1")

	t.Setenv("TRUST_PROXY", "")
	if got := clientIP(req); got != "10.0.0.1" {
		t.Fatalf("without TRUST_PROXY got %q", got)
	}
	t.Setenv("TRUST_PROXY", "true")
	if got := clientIP(req); got != "9.9.9.9" {
		t.Fatalf("with TRUST_PROXY got %q", got)
	}
}
