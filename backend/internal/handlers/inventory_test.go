package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// CreateProduct — input validation
// ---------------------------------------------------------------------------

func TestCreateProduct_InvalidJSON(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewBufferString("not json"))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateProduct_MissingName(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]string{"name": "", "company_name": "Pharma Co"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "name and company_name are required" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateProduct_MissingCompanyName(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]string{"name": "Aspirin", "company_name": ""}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/products", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateProduct(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// CreateBatch — input validation
// ---------------------------------------------------------------------------

func TestCreateBatch_InvalidJSON(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateBatch_MissingRequiredFields(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	tests := []struct {
		name string
		body map[string]interface{}
	}{
		{"missing product_id", map[string]interface{}{
			"product_id": "", "batch_no": "B001", "expiry_date": "2027-01-01",
			"mrp": 100, "buying_price": 60, "selling_price": 80, "purchase_qty": 10,
		}},
		{"missing batch_no", map[string]interface{}{
			"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "", "expiry_date": "2027-01-01",
			"mrp": 100, "buying_price": 60, "selling_price": 80, "purchase_qty": 10,
		}},
		{"missing expiry_date", map[string]interface{}{
			"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001", "expiry_date": "",
			"mrp": 100, "buying_price": 60, "selling_price": 80, "purchase_qty": 10,
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
			w := httptest.NewRecorder()
			handler.CreateBatch(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestCreateBatch_ZeroPurchaseQty(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "2027-01-01", "mrp": 100, "buying_price": 60,
		"selling_price": 80, "purchase_qty": 0,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "purchase_qty must be greater than 0" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateBatch_PriceHierarchy_BuyingGteSelling(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "2027-01-01", "mrp": 100,
		"buying_price": 80, "selling_price": 80, // buying == selling
		"purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "selling_price must be greater than buying_price" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateBatch_PriceHierarchy_SellingGteMRP(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "2027-01-01", "mrp": 90,
		"buying_price": 60, "selling_price": 90, // selling == MRP
		"purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "mrp must be greater than selling_price" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateBatch_PriceHierarchy_BuyingGtSelling(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "2027-01-01", "mrp": 200,
		"buying_price": 100, "selling_price": 50, // buying > selling
		"purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateBatch_PastExpiryDate(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "2020-01-01", // past
		"mrp": 100, "buying_price": 60, "selling_price": 80,
		"purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "expiry_date must be a future date" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateBatch_BadDateFormat(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "550e8400-e29b-41d4-a716-446655440000", "batch_no": "B001",
		"expiry_date": "01-01-2027", // wrong format
		"mrp": 100, "buying_price": 60, "selling_price": 80,
		"purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "expiry_date must be in YYYY-MM-DD format" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestCreateBatch_InvalidProductID(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	body := map[string]interface{}{
		"product_id": "not-a-uuid", "batch_no": "B001",
		"expiry_date": "2027-01-01", "mrp": 100,
		"buying_price": 60, "selling_price": 80, "purchase_qty": 10,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/batches", bytes.NewReader(b))
	w := httptest.NewRecorder()
	handler.CreateBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "invalid product_id" {
		t.Errorf("error = %q", resp["error"])
	}
}

// ---------------------------------------------------------------------------
// ListBatches — validation
// ---------------------------------------------------------------------------

func TestListBatches_MissingProductID(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/batches", nil)
	w := httptest.NewRecorder()
	handler.ListBatches(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "product_id is required" {
		t.Errorf("error = %q", resp["error"])
	}
}

func TestListBatches_InvalidProductID(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/batches?product_id=bad", nil)
	w := httptest.NewRecorder()
	handler.ListBatches(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListActiveBatches_MissingProductID(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/batches/active", nil)
	w := httptest.NewRecorder()
	handler.ListActiveBatches(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListActiveBatches_InvalidProductID(t *testing.T) {
	handler := &InventoryHandler{pool: nil}

	req := httptest.NewRequest(http.MethodGet, "/batches/active?product_id=xyz", nil)
	w := httptest.NewRecorder()
	handler.ListActiveBatches(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
