package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type StockAdjustmentHandler struct{ pool *pgxpool.Pool }

func NewStockAdjustmentHandler(pool *pgxpool.Pool) *StockAdjustmentHandler {
	return &StockAdjustmentHandler{pool: pool}
}

var validReasons = map[string]bool{
	"damage":         true,
	"theft":          true,
	"miscount":       true,
	"physical_count": true,
	"other":          true,
}

func (h *StockAdjustmentHandler) CreateAdjustment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BatchID   string  `json:"batch_id"`
		QtyChange int32   `json:"qty_change"`
		Reason    string  `json:"reason"`
		Notes     *string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.BatchID == "" {
		writeError(w, http.StatusBadRequest, "batch_id is required")
		return
	}
	if body.QtyChange == 0 {
		writeError(w, http.StatusBadRequest, "qty_change cannot be zero")
		return
	}
	if !validReasons[body.Reason] {
		writeError(w, http.StatusBadRequest, "reason must be one of: damage, theft, miscount, physical_count, other")
		return
	}

	var bid pgtype.UUID
	if err := bid.Scan(body.BatchID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid batch_id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	tx, err := conn.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	q := generated.New(tx)

	// Lock the batch
	batch, err := q.LockBatchForUpdate(r.Context(), bid)
	if err != nil {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	}

	// Validate: purchase_qty + qty_change >= sold_qty
	newPurchaseQty := batch.PurchaseQty + body.QtyChange
	if newPurchaseQty < batch.SoldQty {
		writeError(w, http.StatusBadRequest, "adjustment would make available stock negative (sold: "+strconv.Itoa(int(batch.SoldQty))+")")
		return
	}
	if newPurchaseQty < 0 {
		writeError(w, http.StatusBadRequest, "adjustment would make purchase_qty negative")
		return
	}

	// Insert adjustment record
	adjustment, err := q.CreateStockAdjustment(r.Context(), generated.CreateStockAdjustmentParams{
		BatchID:   bid,
		QtyChange: body.QtyChange,
		Reason:    body.Reason,
		Notes:     body.Notes,
	})
	if err != nil {
		log.Printf("CreateStockAdjustment error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not create adjustment")
		return
	}

	// Update batch purchase_qty
	if err := q.AdjustBatchPurchaseQty(r.Context(), generated.AdjustBatchPurchaseQtyParams{
		BatchID:     bid,
		PurchaseQty: body.QtyChange,
	}); err != nil {
		log.Printf("AdjustBatchPurchaseQty error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not adjust batch stock")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit adjustment")
		return
	}

	writeJSON(w, http.StatusCreated, adjustment)
}

func (h *StockAdjustmentHandler) ListAdjustments(w http.ResponseWriter, r *http.Request) {
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
	q := generated.New(conn)

	total, err := q.CountStockAdjustments(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count adjustments")
		return
	}

	adjustments, err := q.ListStockAdjustments(r.Context(), generated.ListStockAdjustmentsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch adjustments")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"adjustments": adjustments,
		"total":       total,
		"page":        page,
		"limit":       limit,
	})
}

