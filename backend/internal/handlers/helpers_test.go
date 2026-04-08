package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------

func TestRound2(t *testing.T) {
	tests := []struct {
		name string
		in   float64
		want float64
	}{
		{"zero", 0, 0},
		{"positive round down", 1.234, 1.23},
		{"positive round up", 1.235, 1.24},
		{"negative", -1.235, -1.24},
		{"already 2 decimals", 99.99, 99.99},
		{"integer", 42.0, 42.0},
		{"small fraction", 0.001, 0.0},
		{"classic float issue 0.1+0.2", round2(0.1 + 0.2), 0.3},
		{"large number", 123456.789, 123456.79},
		{"half-cent rounding", 10.005, 10.01},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := round2(tt.in)
			if got != tt.want {
				t.Errorf("round2(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// numericFromFloat
// ---------------------------------------------------------------------------

func TestNumericFromFloat(t *testing.T) {
	tests := []struct {
		name string
		in   float64
	}{
		{"zero", 0},
		{"positive", 123.45},
		{"negative", -99.99},
		{"high precision", 0.1234},
		{"large", 999999.9999},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n := numericFromFloat(tt.in)
			if !n.Valid {
				t.Errorf("numericFromFloat(%v) returned invalid Numeric", tt.in)
			}
			f, err := n.Float64Value()
			if err != nil {
				t.Fatalf("Float64Value error: %v", err)
			}
			// Allow small epsilon for float round-trip
			diff := f.Float64 - tt.in
			if diff < -0.001 || diff > 0.001 {
				t.Errorf("numericFromFloat(%v) round-tripped to %v", tt.in, f.Float64)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// writeJSON
// ---------------------------------------------------------------------------

func TestWriteJSON(t *testing.T) {
	t.Run("writes status and content-type", func(t *testing.T) {
		w := httptest.NewRecorder()
		writeJSON(w, http.StatusCreated, map[string]string{"key": "value"})

		if w.Code != http.StatusCreated {
			t.Errorf("status = %d, want %d", w.Code, http.StatusCreated)
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", ct)
		}

		var body map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body["key"] != "value" {
			t.Errorf("body[key] = %q, want %q", body["key"], "value")
		}
	})

	t.Run("nil slice becomes empty array", func(t *testing.T) {
		w := httptest.NewRecorder()
		var nilSlice []string
		writeJSON(w, http.StatusOK, nilSlice)

		body := w.Body.String()
		if body != "[]\n" {
			t.Errorf("nil slice serialised as %q, want %q", body, "[]\n")
		}
	})

	t.Run("non-nil slice stays intact", func(t *testing.T) {
		w := httptest.NewRecorder()
		writeJSON(w, http.StatusOK, []string{"a", "b"})

		var body []string
		json.Unmarshal(w.Body.Bytes(), &body)
		if len(body) != 2 || body[0] != "a" || body[1] != "b" {
			t.Errorf("unexpected body: %v", body)
		}
	})

	t.Run("nil value", func(t *testing.T) {
		w := httptest.NewRecorder()
		writeJSON(w, http.StatusOK, nil)

		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
	})
}

// ---------------------------------------------------------------------------
// writeError
// ---------------------------------------------------------------------------

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "something went wrong")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "something went wrong" {
		t.Errorf("error = %q, want %q", body["error"], "something went wrong")
	}
}
