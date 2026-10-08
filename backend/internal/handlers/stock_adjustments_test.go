package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateAdjustment_RestockMustAddStock(t *testing.T) {
	handler := &StockAdjustmentHandler{}

	b, _ := json.Marshal(map[string]any{
		"batch_id": "00000000-0000-0000-0000-000000000001", "qty_change": -5, "reason": "restock",
	})
	req := httptest.NewRequest(http.MethodPost, "/stock-adjustments", bytes.NewBuffer(b))
	w := httptest.NewRecorder()
	handler.CreateAdjustment(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateAdjustment_UnknownReason(t *testing.T) {
	handler := &StockAdjustmentHandler{}

	b, _ := json.Marshal(map[string]any{
		"batch_id": "00000000-0000-0000-0000-000000000001", "qty_change": 5, "reason": "gift",
	})
	req := httptest.NewRequest(http.MethodPost, "/stock-adjustments", bytes.NewBuffer(b))
	w := httptest.NewRecorder()
	handler.CreateAdjustment(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
