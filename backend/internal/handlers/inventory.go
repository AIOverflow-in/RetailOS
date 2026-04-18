package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type InventoryHandler struct{ pool *pgxpool.Pool }

func NewInventoryHandler(pool *pgxpool.Pool) *InventoryHandler {
	return &InventoryHandler{pool: pool}
}

func (h *InventoryHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limitVal, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limitVal < 1 || limitVal > 200 {
		limitVal = 20
	}
	limit := int32(limitVal)
	offset := int32((page - 1) * int(limit))

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	total, err := queries.CountProducts(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count products")
		return
	}

	products, err := queries.SearchProducts(r.Context(), generated.SearchProductsParams{
		Column1: q,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch products")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"products": products,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

func (h *InventoryHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string  `json:"name"`
		CompanyName string  `json:"company_name"`
		SKU         *string `json:"sku"`
		HSNCode     *string `json:"hsn_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" || body.CompanyName == "" {
		writeError(w, http.StatusBadRequest, "name and company_name are required")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	product, err := queries.CreateProduct(r.Context(), generated.CreateProductParams{
		Name:        body.Name,
		CompanyName: body.CompanyName,
		Sku:         body.SKU,
		HsnCode:     body.HSNCode,
	})
	if err != nil {
		writeError(w, http.StatusConflict, "product creation failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, product)
}

func (h *InventoryHandler) ListBatches(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("product_id")
	if productID == "" {
		writeError(w, http.StatusBadRequest, "product_id is required")
		return
	}

	var pid pgtype.UUID
	if err := pid.Scan(productID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid product_id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	batches, err := queries.ListBatchesForProduct(r.Context(), pid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch batches")
		return
	}
	writeJSON(w, http.StatusOK, batches)
}

func (h *InventoryHandler) ListActiveBatches(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("product_id")
	if productID == "" {
		writeError(w, http.StatusBadRequest, "product_id is required")
		return
	}

	var pid pgtype.UUID
	if err := pid.Scan(productID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid product_id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	batches, err := queries.ListActiveBatchesForProduct(r.Context(), pid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch active batches")
		return
	}
	writeJSON(w, http.StatusOK, batches)
}

func (h *InventoryHandler) CreateBatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID         string   `json:"product_id"`
		BatchNo           string   `json:"batch_no"`
		ExpiryDate        string   `json:"expiry_date"` // YYYY-MM-DD
		MRP               float64  `json:"mrp"`
		BuyingPrice       float64  `json:"buying_price"`
		SellingPrice      float64  `json:"selling_price"`
		PurchaseQty       int32    `json:"purchase_qty"`
		BoxNo             *string  `json:"box_no"`
		PurchaseGSTRate   *float64 `json:"purchase_gst_rate"`
		DistributorID     *string  `json:"distributor_id"`
		PurchaseInvoiceNo *string  `json:"purchase_invoice_no"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Mandatory field validation
	if body.ProductID == "" || body.BatchNo == "" || body.ExpiryDate == "" {
		writeError(w, http.StatusBadRequest, "product_id, batch_no, and expiry_date are required")
		return
	}
	if body.PurchaseQty <= 0 {
		writeError(w, http.StatusBadRequest, "purchase_qty must be greater than 0")
		return
	}

	// Compute landing price if GST rate is provided
	var landingPrice *float64
	if body.PurchaseGSTRate != nil && *body.PurchaseGSTRate > 0 {
		lp := body.BuyingPrice * (1 + *body.PurchaseGSTRate/100)
		landingPrice = &lp
	}

	// Price validation: landing_price (or buying_price if no GST) < selling < mrp
	costPrice := body.BuyingPrice
	if landingPrice != nil {
		costPrice = *landingPrice
	}
	if costPrice >= body.SellingPrice {
		writeError(w, http.StatusBadRequest, "selling_price must be greater than landing_price" + map[bool]string{true: "", false: " (or buying_price)"}[landingPrice == nil])
		return
	}
	if body.SellingPrice >= body.MRP {
		writeError(w, http.StatusBadRequest, "mrp must be greater than selling_price")
		return
	}

	// Expiry must be in the future
	expiry, err := time.Parse("2006-01-02", body.ExpiryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "expiry_date must be in YYYY-MM-DD format")
		return
	}
	if !expiry.After(time.Now()) {
		writeError(w, http.StatusBadRequest, "expiry_date must be a future date")
		return
	}

	var pid pgtype.UUID
	if err := pid.Scan(body.ProductID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid product_id")
		return
	}

	var expiryDate pgtype.Date
	expiryDate.Time = expiry
	expiryDate.Valid = true

	mrp := numericFromFloat(body.MRP)
	buyingPrice := numericFromFloat(body.BuyingPrice)
	sellingPrice := numericFromFloat(body.SellingPrice)

	// Convert landing price and GST rate to pgtype.Numeric
	var landingPriceNumeric pgtype.Numeric
	if landingPrice != nil {
		landingPriceNumeric = numericFromFloat(*landingPrice)
	}

	var purchaseGstRateNumeric pgtype.Numeric
	if body.PurchaseGSTRate != nil {
		purchaseGstRateNumeric = numericFromFloat(*body.PurchaseGSTRate)
	}

	var distributorID pgtype.UUID
	if body.DistributorID != nil && *body.DistributorID != "" {
		if err := distributorID.Scan(*body.DistributorID); err != nil {
			writeError(w, http.StatusBadRequest, "invalid distributor_id")
			return
		}
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	batch, err := queries.CreateBatch(r.Context(), generated.CreateBatchParams{
		ProductID:         pid,
		BatchNo:           body.BatchNo,
		ExpiryDate:        expiryDate,
		Mrp:               mrp,
		BuyingPrice:       buyingPrice,
		SellingPrice:      sellingPrice,
		PurchaseQty:       body.PurchaseQty,
		BoxNo:             body.BoxNo,
		PurchaseGstRate:   purchaseGstRateNumeric,
		LandingPrice:      landingPriceNumeric,
		DistributorID:     distributorID,
		PurchaseInvoiceNo: body.PurchaseInvoiceNo,
	})
	if err != nil {
		writeError(w, http.StatusConflict, "batch creation failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, batch)
}

func (h *InventoryHandler) ListInventory(w http.ResponseWriter, r *http.Request) {
	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	rows, err := queries.ListInventory(r.Context())
	if err != nil {
		// Log the actual error for debugging
		errMsg := fmt.Sprintf("ListInventory error: %v", err)
		log.Println(errMsg)
		writeError(w, http.StatusInternalServerError, "could not fetch inventory: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *InventoryHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var pid pgtype.UUID
	if err := pid.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	var body struct {
		Name        string  `json:"name"`
		CompanyName string  `json:"company_name"`
		SKU         *string `json:"sku"`
		HSNCode     *string `json:"hsn_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" || body.CompanyName == "" {
		writeError(w, http.StatusBadRequest, "name and company_name are required")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	product, err := queries.UpdateProduct(r.Context(), generated.UpdateProductParams{
		ProductID:   pid,
		Name:        body.Name,
		CompanyName: body.CompanyName,
		Sku:         body.SKU,
		HsnCode:     body.HSNCode,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update product: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, product)
}

func (h *InventoryHandler) UpdateBatch(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var bid pgtype.UUID
	if err := bid.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid batch id")
		return
	}

	var body struct {
		BuyingPrice       float64  `json:"buying_price"`
		SellingPrice      float64  `json:"selling_price"`
		MRP               float64  `json:"mrp"`
		ExpiryDate        string   `json:"expiry_date"`
		PurchaseQty       int32    `json:"purchase_qty"`
		BoxNo             *string  `json:"box_no"`
		PurchaseGSTRate   *float64 `json:"purchase_gst_rate"`
		DistributorID     *string  `json:"distributor_id"`
		PurchaseInvoiceNo *string  `json:"purchase_invoice_no"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Compute landing price if GST rate is provided
	var landingPrice *float64
	if body.PurchaseGSTRate != nil && *body.PurchaseGSTRate > 0 {
		lp := body.BuyingPrice * (1 + *body.PurchaseGSTRate/100)
		landingPrice = &lp
	}

	// Price validation: landing_price (or buying_price if no GST) < selling < mrp
	costPrice := body.BuyingPrice
	if landingPrice != nil {
		costPrice = *landingPrice
	}
	if costPrice >= body.SellingPrice {
		msgSuffix := ""
		if landingPrice == nil {
			msgSuffix = " (or buying_price)"
		}
		writeError(w, http.StatusBadRequest, "selling_price must be greater than landing_price"+msgSuffix)
		return
	}
	if body.SellingPrice >= body.MRP {
		writeError(w, http.StatusBadRequest, "mrp must be greater than selling_price")
		return
	}

	// Expiry date
	expiry, err := time.Parse("2006-01-02", body.ExpiryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "expiry_date must be in YYYY-MM-DD format")
		return
	}

	// Fetch current batch to check sold_qty
	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	current, err := queries.GetBatch(r.Context(), bid)
	if err != nil {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	}

	// Cannot reduce purchase_qty below what's already been sold
	if body.PurchaseQty < current.SoldQty {
		writeError(w, http.StatusBadRequest, "purchase_qty cannot be less than sold_qty ("+strconv.Itoa(int(current.SoldQty))+")")
		return
	}

	var expiryDate pgtype.Date
	expiryDate.Time = expiry
	expiryDate.Valid = true

	// Convert landing price and GST rate to pgtype.Numeric
	var landingPriceNumeric pgtype.Numeric
	if landingPrice != nil {
		landingPriceNumeric = numericFromFloat(*landingPrice)
	}

	var purchaseGstRateNumeric pgtype.Numeric
	if body.PurchaseGSTRate != nil {
		purchaseGstRateNumeric = numericFromFloat(*body.PurchaseGSTRate)
	}

	var distributorID pgtype.UUID
	if body.DistributorID != nil && *body.DistributorID != "" {
		if err := distributorID.Scan(*body.DistributorID); err != nil {
			writeError(w, http.StatusBadRequest, "invalid distributor_id")
			return
		}
	}

	batch, err := queries.UpdateBatch(r.Context(), generated.UpdateBatchParams{
		BatchID:           bid,
		BuyingPrice:       numericFromFloat(body.BuyingPrice),
		SellingPrice:      numericFromFloat(body.SellingPrice),
		Mrp:               numericFromFloat(body.MRP),
		ExpiryDate:        expiryDate,
		PurchaseQty:       body.PurchaseQty,
		BoxNo:             body.BoxNo,
		PurchaseGstRate:   purchaseGstRateNumeric,
		LandingPrice:      landingPriceNumeric,
		DistributorID:     distributorID,
		PurchaseInvoiceNo: body.PurchaseInvoiceNo,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update batch: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, batch)
}
