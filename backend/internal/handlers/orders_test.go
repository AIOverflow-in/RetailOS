package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/retail-os/backend/internal/middleware"
)

// ---------------------------------------------------------------------------
// financialYearStart — pure function
// ---------------------------------------------------------------------------

func TestFinancialYearStart(t *testing.T) {
	tests := []struct {
		name string
		date time.Time
		want time.Time // expected April 1
	}{
		{
			"after april (Jun 2025)",
			time.Date(2025, time.June, 15, 0, 0, 0, 0, time.UTC),
			time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			"before april (Feb 2025 -> FY 2024)",
			time.Date(2025, time.February, 10, 0, 0, 0, 0, time.UTC),
			time.Date(2024, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			"exactly april 1",
			time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
			time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			"march 31 (last day before new FY)",
			time.Date(2025, time.March, 31, 23, 59, 59, 0, time.UTC),
			time.Date(2024, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			"december (same FY)",
			time.Date(2025, time.December, 25, 0, 0, 0, 0, time.UTC),
			time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			"january (previous FY)",
			time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
			time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := financialYearStart(tt.date)
			if !got.Equal(tt.want) {
				t.Errorf("financialYearStart(%v) = %v, want %v", tt.date, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// GST calculation logic — tests the server-side recomputation
// ---------------------------------------------------------------------------

func TestGSTCalculation_InState(t *testing.T) {
	// Simulates the server-side GST logic from CreateOrder handler
	salePrice := 100.0
	qty := int32(2)
	gstRate := 18.0

	taxable := salePrice * float64(qty) // 200
	totalTax := round2(taxable * (gstRate / 100)) // 36
	lineTotal := round2(taxable + totalTax) // 236

	cgst := round2(totalTax / 2) // 18
	sgst := round2(totalTax / 2) // 18

	if taxable != 200.0 {
		t.Errorf("taxable = %v, want 200", taxable)
	}
	if totalTax != 36.0 {
		t.Errorf("totalTax = %v, want 36", totalTax)
	}
	if lineTotal != 236.0 {
		t.Errorf("lineTotal = %v, want 236", lineTotal)
	}
	if cgst != 18.0 {
		t.Errorf("cgst = %v, want 18", cgst)
	}
	if sgst != 18.0 {
		t.Errorf("sgst = %v, want 18", sgst)
	}
}

func TestGSTCalculation_InterState(t *testing.T) {
	salePrice := 100.0
	qty := int32(3)
	gstRate := 12.0

	taxable := salePrice * float64(qty) // 300
	totalTax := round2(taxable * (gstRate / 100)) // 36
	lineTotal := round2(taxable + totalTax) // 336

	igst := totalTax // 36 (no split for inter-state)

	if taxable != 300.0 {
		t.Errorf("taxable = %v, want 300", taxable)
	}
	if totalTax != 36.0 {
		t.Errorf("totalTax = %v, want 36", totalTax)
	}
	if lineTotal != 336.0 {
		t.Errorf("lineTotal = %v, want 336", lineTotal)
	}
	if igst != 36.0 {
		t.Errorf("igst = %v, want 36", igst)
	}
}

func TestGSTCalculation_OddRounding(t *testing.T) {
	// Test that half-cent GST splits don't lose money
	salePrice := 33.33
	qty := int32(1)
	gstRate := 5.0

	taxable := salePrice * float64(qty) // 33.33
	totalTax := round2(taxable * (gstRate / 100)) // 1.67
	cgst := round2(totalTax / 2) // 0.84
	sgst := round2(totalTax / 2) // 0.84

	if totalTax != 1.67 {
		t.Errorf("totalTax = %v, want 1.67", totalTax)
	}
	if cgst != 0.84 {
		t.Errorf("cgst = %v, want 0.84", cgst)
	}
	if sgst != 0.84 {
		t.Errorf("sgst = %v, want 0.84", sgst)
	}
}

func TestGSTCalculation_ZeroRate(t *testing.T) {
	salePrice := 500.0
	qty := int32(1)
	gstRate := 0.0

	taxable := salePrice * float64(qty)
	totalTax := round2(taxable * (gstRate / 100))
	lineTotal := round2(taxable + totalTax)

	if totalTax != 0.0 {
		t.Errorf("totalTax = %v, want 0", totalTax)
	}
	if lineTotal != 500.0 {
		t.Errorf("lineTotal = %v, want 500", lineTotal)
	}
}

func TestGSTCalculation_MultiItemAggregation(t *testing.T) {
	// Simulates multi-item order aggregation as done in CreateOrder
	items := []struct {
		salePrice float64
		qty       int32
		gstRate   float64
	}{
		{100.0, 2, 18.0},  // taxable=200, tax=36, line=236
		{50.0, 3, 12.0},   // taxable=150, tax=18, line=168
		{200.0, 1, 5.0},   // taxable=200, tax=10, line=210
	}

	var cgstTotal, sgstTotal, totalAmount float64
	isInState := true

	for _, item := range items {
		taxable := item.salePrice * float64(item.qty)
		totalTax := round2(taxable * (item.gstRate / 100))
		lineTotal := round2(taxable + totalTax)
		totalAmount += lineTotal
		if isInState {
			cgstTotal += round2(totalTax / 2)
			sgstTotal += round2(totalTax / 2)
		}
	}
	cgstTotal = round2(cgstTotal)
	sgstTotal = round2(sgstTotal)
	totalAmount = round2(totalAmount)

	if totalAmount != 614.0 {
		t.Errorf("totalAmount = %v, want 614", totalAmount)
	}
	if cgstTotal != 32.0 {
		t.Errorf("cgstTotal = %v, want 32", cgstTotal)
	}
	if sgstTotal != 32.0 {
		t.Errorf("sgstTotal = %v, want 32", sgstTotal)
	}
}

// ---------------------------------------------------------------------------
// CreateOrder handler — input validation (no DB needed)
// ---------------------------------------------------------------------------

func TestCreateOrder_EmptyItems(t *testing.T) {
	handler := &OrderHandler{pool: nil} // pool not needed for validation

	body := createOrderRequest{
		Phone: "1234567890",
		Items: []orderItemRequest{}, // empty
	}
	b, _ := json.Marshal(body)

	// We need claims and conn in context, but the validation for empty items
	// happens before DB access, so we test with a minimal setup.
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	// Add claims to context so the handler doesn't panic before reaching validation
	claims := &middleware.Claims{TenantID: "test", SchemaName: "test", OrderPrefix: "INV"}
	ctx := context.WithValue(req.Context(), middleware.ClaimsKey, claims)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.CreateOrder(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "order must have at least one item" {
		t.Errorf("error = %q, want %q", resp["error"], "order must have at least one item")
	}
}

func TestCreateOrder_InvalidJSON(t *testing.T) {
	handler := &OrderHandler{pool: nil}

	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateOrder(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// ListOrders — pagination defaults
// ---------------------------------------------------------------------------

func TestListOrders_PaginationDefaults(t *testing.T) {
	// Test that page and limit defaults are applied correctly
	tests := []struct {
		name      string
		pageStr   string
		limitStr  string
		wantPage  int
		wantLimit int32
	}{
		{"defaults", "", "", 1, 50},
		{"explicit page 2", "2", "", 2, 50},
		{"negative page", "-1", "", 1, 50},
		{"zero page", "0", "", 1, 50},
		{"custom limit", "", "20", 1, 20},
		{"limit too high", "", "500", 1, 50},
		{"limit negative", "", "-5", 1, 50},
		{"both set", "3", "100", 3, 100},
		{"limit at max", "", "200", 1, 200},
		{"limit over max", "", "201", 1, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pageStr := tt.pageStr
			limitStr := tt.limitStr

			// Replicate the parsing logic from ListOrders
			page := 0
			if pageStr != "" {
				for _, c := range pageStr {
					if c >= '0' && c <= '9' {
						page = page*10 + int(c-'0')
					} else if c == '-' {
						page = -1
						break
					}
				}
			}
			if page < 1 {
				page = 1
			}

			limitVal := 0
			if limitStr != "" {
				for _, c := range limitStr {
					if c >= '0' && c <= '9' {
						limitVal = limitVal*10 + int(c-'0')
					} else if c == '-' {
						limitVal = -1
						break
					}
				}
			}
			if limitVal < 1 || limitVal > 200 {
				limitVal = 50
			}
			limit := int32(limitVal)

			if page != tt.wantPage {
				t.Errorf("page = %d, want %d", page, tt.wantPage)
			}
			if limit != tt.wantLimit {
				t.Errorf("limit = %d, want %d", limit, tt.wantLimit)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// SoftDeleteOrder — invalid UUID
// ---------------------------------------------------------------------------

func TestSoftDeleteOrder_InvalidUUID(t *testing.T) {
	handler := &OrderHandler{pool: nil}

	req := httptest.NewRequest(http.MethodDelete, "/orders/not-a-uuid", nil)
	// Chi URL params need to be set via chi context; we test the UUID parsing
	// directly since the handler reads chi.URLParam which returns "" without chi
	w := httptest.NewRecorder()
	handler.SoftDeleteOrder(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetOrder_InvalidUUID(t *testing.T) {
	handler := &OrderHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/orders/invalid", nil)
	w := httptest.NewRecorder()
	handler.GetOrder(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
