package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
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

	// Check from is April 1
	if from.Time.Month() != 4 || from.Time.Day() != 1 {
		t.Errorf("from = %v, want April 1", from.Time)
	}
	// Check to is end of April 30
	if to.Time.Month() != 4 || to.Time.Day() != 30 {
		t.Errorf("to date = %v, want April 30", to.Time)
	}
	// to should be end of day (23:59:59)
	if to.Time.Hour() != 23 || to.Time.Minute() != 59 {
		t.Errorf("to time = %02d:%02d, want 23:59", to.Time.Hour(), to.Time.Minute())
	}
}

func TestParseDateRange_MissingFrom(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?to=2025-04-30", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for missing from")
	}
	if err.Error() != "from and to query params are required (YYYY-MM-DD)" {
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
	if err.Error() != "invalid from date format, use YYYY-MM-DD" {
		t.Errorf("error = %q", err.Error())
	}
}

func TestParseDateRange_BadToFormat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/reports/gst?from=2025-04-01&to=30-04-2025", nil)
	_, _, err := parseDateRange(req)

	if err == nil {
		t.Fatal("expected error for bad to format")
	}
	if err.Error() != "invalid to date format, use YYYY-MM-DD" {
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
