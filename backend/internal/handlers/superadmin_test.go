package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/retail-os/backend/internal/email"
)

// ---------------------------------------------------------------------------
// SuperAdmin Login — input validation
// ---------------------------------------------------------------------------

func TestSuperAdminLogin_SMTPNotConfigured(t *testing.T) {
	handler := &SuperAdminHandler{
		pool:      nil,
		jwtSecret: "test",
		smtp:      email.SMTPConfig{}, // empty = not configured
	}

	body := saLoginRequest{Username: "admin", Password: "pass"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/login", bytes.NewReader(b))
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", w.Code, http.StatusServiceUnavailable)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "SMTP is not configured" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestSuperAdminLogin_InvalidJSON(t *testing.T) {
	handler := &SuperAdminHandler{
		pool:      nil,
		jwtSecret: "test",
		smtp: email.SMTPConfig{
			Host: "smtp.test.com", Username: "u", Password: "p", From: "f",
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/login", bytes.NewBufferString("bad"))
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSuperAdminLogin_MissingCredentials(t *testing.T) {
	handler := &SuperAdminHandler{
		pool:      nil,
		jwtSecret: "test",
		smtp: email.SMTPConfig{
			Host: "smtp.test.com", Username: "u", Password: "p", From: "f",
		},
	}

	tests := []struct {
		name string
		body saLoginRequest
	}{
		{"missing username", saLoginRequest{Username: "", Password: "pass"}},
		{"missing password", saLoginRequest{Username: "admin", Password: ""}},
		{"both missing", saLoginRequest{Username: "", Password: ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/login", bytes.NewReader(b))
			w := httptest.NewRecorder()

			handler.Login(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// VerifyOTP — input validation
// ---------------------------------------------------------------------------

func TestVerifyOTP_InvalidJSON(t *testing.T) {
	handler := &SuperAdminHandler{pool: nil, jwtSecret: "test"}

	req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/verify-otp", bytes.NewBufferString("bad"))
	w := httptest.NewRecorder()

	handler.VerifyOTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestVerifyOTP_MissingFields(t *testing.T) {
	handler := &SuperAdminHandler{pool: nil, jwtSecret: "test"}

	tests := []struct {
		name string
		body verifyOTPRequest
	}{
		{"missing session_id", verifyOTPRequest{SessionID: "", OTP: "123456"}},
		{"missing otp", verifyOTPRequest{SessionID: "abc", OTP: ""}},
		{"both missing", verifyOTPRequest{SessionID: "", OTP: ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/verify-otp", bytes.NewReader(b))
			w := httptest.NewRecorder()

			handler.VerifyOTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestVerifyOTP_InvalidSessionID(t *testing.T) {
	handler := &SuperAdminHandler{pool: nil, jwtSecret: "test"}

	body := verifyOTPRequest{SessionID: "not-a-uuid", OTP: "123456"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/super-admin/auth/verify-otp", bytes.NewReader(b))
	w := httptest.NewRecorder()

	handler.VerifyOTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// generateOTP — format validation
// ---------------------------------------------------------------------------

func TestGenerateOTP_Format(t *testing.T) {
	for i := 0; i < 100; i++ {
		otp := generateOTP()
		if len(otp) != 6 {
			t.Errorf("OTP length = %d, want 6; value = %q", len(otp), otp)
		}
		for _, c := range otp {
			if c < '0' || c > '9' {
				t.Errorf("OTP contains non-digit: %c in %q", c, otp)
			}
		}
	}
}

func TestGenerateOTP_NotAllSame(t *testing.T) {
	results := make(map[string]bool)
	for i := 0; i < 20; i++ {
		results[generateOTP()] = true
	}
	if len(results) < 2 {
		t.Error("generateOTP produced all identical OTPs — crypto/rand likely broken")
	}
}

// ---------------------------------------------------------------------------
// SMTPConfig.IsConfigured
// ---------------------------------------------------------------------------

func TestSMTPConfig_IsConfigured(t *testing.T) {
	tests := []struct {
		name string
		cfg  email.SMTPConfig
		want bool
	}{
		{"fully configured", email.SMTPConfig{
			Host: "smtp.gmail.com", Username: "u", Password: "p", From: "f@test.com",
		}, true},
		{"missing host", email.SMTPConfig{
			Host: "", Username: "u", Password: "p", From: "f@test.com",
		}, false},
		{"missing username", email.SMTPConfig{
			Host: "smtp.gmail.com", Username: "", Password: "p", From: "f@test.com",
		}, false},
		{"missing password", email.SMTPConfig{
			Host: "smtp.gmail.com", Username: "u", Password: "", From: "f@test.com",
		}, false},
		{"missing from", email.SMTPConfig{
			Host: "smtp.gmail.com", Username: "u", Password: "p", From: "",
		}, false},
		{"all empty", email.SMTPConfig{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.cfg.IsConfigured(); got != tt.want {
				t.Errorf("IsConfigured() = %v, want %v", got, tt.want)
			}
		})
	}
}
