package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// LookupCustomer — phone validation
// ---------------------------------------------------------------------------

func TestLookupCustomer_PhoneValidation(t *testing.T) {
	handler := &CustomerHandler{pool: nil}

	tests := []struct {
		name    string
		phone   string
		wantErr string
	}{
		{"empty phone", "", "phone must be exactly 10 digits"},
		{"too short", "12345", "phone must be exactly 10 digits"},
		{"too long", "12345678901", "phone must be exactly 10 digits"},
		{"9 digits", "123456789", "phone must be exactly 10 digits"},
		{"11 digits", "12345678901", "phone must be exactly 10 digits"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/customers?phone=" + tt.phone
			req := httptest.NewRequest(http.MethodGet, url, nil)
			w := httptest.NewRecorder()
			handler.LookupCustomer(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}

			var body map[string]string
			json.Unmarshal(w.Body.Bytes(), &body)
			if body["error"] != tt.wantErr {
				t.Errorf("error = %q, want %q", body["error"], tt.wantErr)
			}
		})
	}
}

func TestLookupCustomer_NoPhoneParam(t *testing.T) {
	handler := &CustomerHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/customers", nil)
	w := httptest.NewRecorder()
	handler.LookupCustomer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
