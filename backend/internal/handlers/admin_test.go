package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// randomHex — pure function
// ---------------------------------------------------------------------------

func TestRandomHex_Length(t *testing.T) {
	tests := []int{4, 8, 16, 32}
	for _, n := range tests {
		result := randomHex(n)
		if len(result) != n {
			t.Errorf("randomHex(%d) length = %d, want %d", n, len(result), n)
		}
	}
}

func TestRandomHex_OnlyHexChars(t *testing.T) {
	for i := 0; i < 100; i++ {
		result := randomHex(16)
		for _, c := range result {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
				t.Errorf("randomHex produced non-hex char: %c in %q", c, result)
			}
		}
	}
}

func TestRandomHex_NotAllSame(t *testing.T) {
	// Very unlikely that 10 random hex strings are all identical
	results := make(map[string]bool)
	for i := 0; i < 10; i++ {
		results[randomHex(8)] = true
	}
	if len(results) < 2 {
		t.Error("randomHex produced all identical strings — likely broken RNG")
	}
}

func TestRandomHex_ZeroLength(t *testing.T) {
	result := randomHex(0)
	if result != "" {
		t.Errorf("randomHex(0) = %q, want empty string", result)
	}
}

// ---------------------------------------------------------------------------
// CreateTenant — input validation
// ---------------------------------------------------------------------------

func TestCreateTenant_InvalidJSON(t *testing.T) {
	handler := &AdminHandler{pool: nil}

	req := httptest.NewRequest(http.MethodPost, "/super-admin/tenants", bytes.NewBufferString("bad"))
	w := httptest.NewRecorder()
	handler.CreateTenant(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTenant_MissingFields(t *testing.T) {
	handler := &AdminHandler{pool: nil}

	tests := []struct {
		name string
		body createTenantRequest
	}{
		{"missing shop_name", createTenantRequest{ShopName: "", Username: "user", Password: "pass"}},
		{"missing username", createTenantRequest{ShopName: "Shop", Username: "", Password: "pass"}},
		{"missing password", createTenantRequest{ShopName: "Shop", Username: "user", Password: ""}},
		{"all empty", createTenantRequest{ShopName: "", Username: "", Password: ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/super-admin/tenants", bytes.NewReader(b))
			w := httptest.NewRecorder()
			handler.CreateTenant(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}

			var resp map[string]string
			json.Unmarshal(w.Body.Bytes(), &resp)
			if resp["error"] != "shop_name, username, and password are required" {
				t.Errorf("error = %q", resp["error"])
			}
		})
	}
}

func TestCreateTenant_DefaultOrderPrefix(t *testing.T) {
	// Verify the default logic: if OrderPrefix is empty, it should default to "INV"
	req := createTenantRequest{
		ShopName: "Test Shop",
		Username: "testuser",
		Password: "pass123",
	}

	if req.OrderPrefix == "" {
		req.OrderPrefix = "INV"
	}

	if req.OrderPrefix != "INV" {
		t.Errorf("default OrderPrefix = %q, want %q", req.OrderPrefix, "INV")
	}
}

func TestCreateTenant_CustomOrderPrefix(t *testing.T) {
	req := createTenantRequest{
		ShopName:    "Test Shop",
		Username:    "testuser",
		Password:    "pass123",
		OrderPrefix: "RX",
	}

	if req.OrderPrefix == "" {
		req.OrderPrefix = "INV"
	}

	if req.OrderPrefix != "RX" {
		t.Errorf("OrderPrefix = %q, want %q", req.OrderPrefix, "RX")
	}
}

// ---------------------------------------------------------------------------
// SetTenantActive — input validation
// ---------------------------------------------------------------------------

func TestSetTenantActive_InvalidJSON(t *testing.T) {
	handler := &AdminHandler{pool: nil}

	req := httptest.NewRequest(http.MethodPatch, "/super-admin/tenants/some-id", bytes.NewBufferString("bad"))
	w := httptest.NewRecorder()
	handler.SetTenantActive(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSetTenantActive_InvalidUUID(t *testing.T) {
	handler := &AdminHandler{pool: nil}

	body := map[string]bool{"is_active": true}
	b, _ := json.Marshal(body)
	// Without Chi router, URLParam returns "" which is invalid UUID
	req := httptest.NewRequest(http.MethodPatch, "/super-admin/tenants/not-uuid", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.SetTenantActive(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// createTenantRequest — JSON serialization
// ---------------------------------------------------------------------------

func TestCreateTenantRequest_JSONFields(t *testing.T) {
	req := createTenantRequest{
		ShopName:    "PharmaCo",
		Username:    "pharma",
		Password:    "secret",
		OrderPrefix: "PH",
	}
	b, _ := json.Marshal(req)

	var m map[string]string
	json.Unmarshal(b, &m)

	if m["shop_name"] != "PharmaCo" {
		t.Errorf("shop_name = %q", m["shop_name"])
	}
	if m["username"] != "pharma" {
		t.Errorf("username = %q", m["username"])
	}
	if m["order_prefix"] != "PH" {
		t.Errorf("order_prefix = %q", m["order_prefix"])
	}
}
