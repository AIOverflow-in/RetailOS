package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// parseDateRange — pure function
// ---------------------------------------------------------------------------

func TestParseDateRange_Valid(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=2025-04-01&to=2025-04-30", nil)
	from, to, err := parseDateRange(req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !from.Valid {
		t.Error("from should be valid")
	}
	if !to.Valid {
		t.Error("to should be valid")
	}

	// From 00:00 IST on 1 April up to (excluding) 00:00 IST on 1 May, so the
	// whole of 30 April IST is included. 00:00 IST is 18:30 UTC the day before.
	wantFrom := time.Date(2025, 3, 31, 18, 30, 0, 0, time.UTC)
	wantTo := time.Date(2025, 4, 30, 18, 30, 0, 0, time.UTC)
	if !from.Time.Equal(wantFrom) {
		t.Errorf("from = %v, want %v", from.Time.UTC(), wantFrom)
	}
	if !to.Time.Equal(wantTo) {
		t.Errorf("to = %v, want %v", to.Time.UTC(), wantTo)
	}
}

func TestParseDateRange_MissingFrom(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?to=2025-04-30", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for missing from")
	}
	if err.Error() != "Pick both a start date and an end date." {
		t.Errorf("error = %q", err.Error())
	}
}

func TestParseDateRange_MissingTo(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=2025-04-01", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for missing to")
	}
}

func TestParseDateRange_MissingBoth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for missing both")
	}
}

func TestParseDateRange_BadFromFormat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=01-04-2025&to=2025-04-30", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for bad from format")
	}
	if err.Error() != "The start date isn't valid." {
		t.Errorf("error = %q", err.Error())
	}
}

func TestParseDateRange_BadToFormat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=2025-04-01&to=30-04-2025", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for bad to format")
	}
	if err.Error() != "The end date isn't valid." {
		t.Errorf("error = %q", err.Error())
	}
}

// ---------------------------------------------------------------------------
// GSTReport handler — input validation
// ---------------------------------------------------------------------------

func TestGSTReport_MissingDateRange(t *testing.T) {
	handler := &ReportHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/reports/gst", nil)
	w := httptest.NewRecorder()
	handler.GSTReport(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGSTReportCSV_MissingDateRange(t *testing.T) {
	handler := &ReportHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/reports/gst/export", nil)
	w := httptest.NewRecorder()
	handler.GSTReportCSV(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGSTReport_InvalidDateFormat(t *testing.T) {
	handler := &ReportHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=2025/04/01&to=2025/04/30", nil)
	w := httptest.NewRecorder()
	handler.GSTReport(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// mustFloat — utility function
// ---------------------------------------------------------------------------

func TestMustFloat(t *testing.T) {
	n := numericFromFloat(123.45)
	f := mustFloat(n)
	if f < 123.44 || f > 123.46 {
		t.Errorf("mustFloat(numericFromFloat(123.45)) = %v, want ~123.45", f)
	}
}

func TestMustFloat_Zero(t *testing.T) {
	n := numericFromFloat(0)
	f := mustFloat(n)
	if f != 0 {
		t.Errorf("mustFloat(numericFromFloat(0)) = %v, want 0", f)
	}
}
