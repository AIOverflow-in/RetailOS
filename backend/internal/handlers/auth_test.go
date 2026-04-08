package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// Login handler — input validation (no DB needed for these paths)
// ---------------------------------------------------------------------------

func TestLogin_InvalidJSON(t *testing.T) {
	handler := &AuthHandler{pool: nil, jwtSecret: "test"}

	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBufferString("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["error"] != "invalid request body" {
		t.Errorf("error = %q, want %q", body["error"], "invalid request body")
	}
}

func TestLogin_MissingUsername(t *testing.T) {
	handler := &AuthHandler{pool: nil, jwtSecret: "test"}

	payload := loginRequest{Username: "", Password: "pass123"}
	b, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["error"] != "username and password are required" {
		t.Errorf("error = %q", body["error"])
	}
}

func TestLogin_MissingPassword(t *testing.T) {
	handler := &AuthHandler{pool: nil, jwtSecret: "test"}

	payload := loginRequest{Username: "admin", Password: ""}
	b, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLogin_BothFieldsMissing(t *testing.T) {
	handler := &AuthHandler{pool: nil, jwtSecret: "test"}

	payload := loginRequest{Username: "", Password: ""}
	b, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLogin_EmptyBody(t *testing.T) {
	handler := &AuthHandler{pool: nil, jwtSecret: "test"}

	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// loginRequest / loginResponse — JSON serialization
// ---------------------------------------------------------------------------

func TestLoginRequest_JSONRoundTrip(t *testing.T) {
	original := loginRequest{Username: "shop1", Password: "secret"}
	b, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded loginRequest
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if decoded.Username != original.Username || decoded.Password != original.Password {
		t.Errorf("round-trip mismatch: got %+v, want %+v", decoded, original)
	}
}

func TestLoginResponse_JSONFields(t *testing.T) {
	resp := loginResponse{
		Token:      "jwt.token.here",
		ShopName:   "My Shop",
		SchemaName: "tenant_abc123",
	}
	b, _ := json.Marshal(resp)

	var m map[string]string
	json.Unmarshal(b, &m)

	if m["token"] != "jwt.token.here" {
		t.Errorf("token = %q", m["token"])
	}
	if m["shop_name"] != "My Shop" {
		t.Errorf("shop_name = %q", m["shop_name"])
	}
	if m["schema_name"] != "tenant_abc123" {
		t.Errorf("schema_name = %q", m["schema_name"])
	}
}
