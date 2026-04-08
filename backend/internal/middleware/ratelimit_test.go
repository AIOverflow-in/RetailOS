package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_AllowsBurst(t *testing.T) {
	rl := NewRateLimiter(1, 5) // 1/sec, burst 5

	for i := 0; i < 5; i++ {
		if !rl.Allow("127.0.0.1") {
			t.Errorf("request %d should be allowed within burst", i+1)
		}
	}
}

func TestRateLimiter_BlocksAfterBurst(t *testing.T) {
	rl := NewRateLimiter(1, 3) // 1/sec, burst 3

	for i := 0; i < 3; i++ {
		rl.Allow("127.0.0.1")
	}

	if rl.Allow("127.0.0.1") {
		t.Error("4th request should be blocked after burst of 3")
	}
}

func TestRateLimiter_SeparateKeys(t *testing.T) {
	rl := NewRateLimiter(1, 2)

	rl.Allow("10.0.0.1")
	rl.Allow("10.0.0.1")

	// Second IP should still have full burst
	if !rl.Allow("10.0.0.2") {
		t.Error("different IP should have its own bucket")
	}
}

func TestRateLimiter_LimitMiddleware_Returns429(t *testing.T) {
	rl := NewRateLimiter(1, 1) // 1/sec, burst 1

	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request: allowed
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("first request: status = %d, want 200", w.Code)
	}

	// Second request: blocked
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req)

	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("second request: status = %d, want 429", w2.Code)
	}
	if w2.Header().Get("Retry-After") == "" {
		t.Error("missing Retry-After header on 429 response")
	}
}

func TestRateLimiter_UsesXForwardedFor(t *testing.T) {
	rl := NewRateLimiter(1, 1)

	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request with X-Forwarded-For
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.50")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}

	// Second request from same forwarded IP: blocked
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req)

	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d, want 429", w2.Code)
	}

	// Different forwarded IP: allowed
	req2 := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req2.Header.Set("X-Forwarded-For", "203.0.113.51")
	w3 := httptest.NewRecorder()
	handler.ServeHTTP(w3, req2)

	if w3.Code != http.StatusOK {
		t.Errorf("different IP: status = %d, want 200", w3.Code)
	}
}

func TestRateLimiter_ErrorResponseIsJSON(t *testing.T) {
	rl := NewRateLimiter(1, 0) // burst 0 = always blocked

	// With burst 0, first token calc: burst-1 = -1, so first request is blocked
	// Actually let's use burst 1 and exhaust it
	rl2 := NewRateLimiter(0.01, 1)
	handler := rl2.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	_ = rl // unused, just for clarity

	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "1.2.3.4:1234"

	// Exhaust
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Now blocked
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req)

	if ct := w2.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}
