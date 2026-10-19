package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type OrderHandler struct{ pool *pgxpool.Pool }

func NewOrderHandler(pool *pgxpool.Pool) *OrderHandler {
	return &OrderHandler{pool: pool}
}

type orderItemRequest struct {
	BatchID     string  `json:"batch_id"`
	ProductName string  `json:"product_name"`
	BatchNo     string  `json:"batch_no"`
	Qty         int32   `json:"qty"`
	SalePrice   float64 `json:"sale_price"`
	GSTRate     float64 `json:"gst_rate"`
	CGSTAmount  float64 `json:"cgst_amount"`
	SGSTAmount  float64 `json:"sgst_amount"`
	IGSTAmount  float64 `json:"igst_amount"`
	LineTotal   float64 `json:"line_total"`
}

type createOrderRequest struct {
	Phone       string             `json:"phone"`
	Name        string             `json:"name"`
	Age         *int32             `json:"age"`
	IsInState   bool               `json:"is_in_state"`
	Items       []orderItemRequest `json:"items"`
	CGSTTotal   float64            `json:"cgst_total"`
	SGSTTotal   float64            `json:"sgst_total"`
	IGSTTotal   float64            `json:"igst_total"`
	TotalAmount float64            `json:"total_amount"`
	PaymentMode string             `json:"payment_mode"`
	// ClientRef identifies one bill attempt. A retry with the same ref (after a
	// timeout or dropped connection) returns the bill already saved.
	ClientRef string `json:"client_ref"`
}

func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req createOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "order must have at least one item")
		return
	}

	// Default and validate payment mode
	if req.PaymentMode == "" {
		req.PaymentMode = "cash"
	}
	switch req.PaymentMode {
	case "cash", "upi", "card", "mixed":
	default:
		writeError(w, http.StatusBadRequest, "payment_mode must be cash, upi, card, or mixed")
		return
	}

	for _, item := range req.Items {
		if msg := validateBillLine(item.ProductName, item.Qty, item.SalePrice, item.GSTRate); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
	}

	claims := middleware.ClaimsFromCtx(r.Context())
	conn := middleware.ConnFromCtx(r.Context())

	var clientRef pgtype.UUID
	if req.ClientRef != "" {
		if err := clientRef.Scan(req.ClientRef); err != nil {
			writeError(w, http.StatusBadRequest, "invalid client_ref")
			return
		}
		// Already saved by an earlier attempt: hand back that bill, don't bill again.
		existing, err := generated.New(conn).GetOrderByClientRef(r.Context(), clientRef)
		if err == nil {
			writeJSON(w, http.StatusOK, existing)
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("CreateOrder client_ref lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "Could not save the bill. Please try again.")
			return
		}
	}

	// Begin ACID transaction
	tx, err := conn.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Could not save the bill. Please try again.")
		return
	}
	defer tx.Rollback(r.Context()) // no-op if committed

	q := generated.New(tx)

	// Step 1: Lock batches and validate stock. The same batch can be on more than
	// one line, so stock is checked against its total across the bill. Batches
	// are locked in a fixed order so two bills sharing batches can't deadlock.
	need := map[string]int32{}
	lines := map[string]int{}
	first := map[string]orderItemRequest{}
	for _, item := range req.Items {
		if _, seen := first[item.BatchID]; !seen {
			first[item.BatchID] = item
		}
		need[item.BatchID] += item.Qty
		lines[item.BatchID]++
	}
	batchIDs := make([]string, 0, len(need))
	for id := range need {
		batchIDs = append(batchIDs, id)
	}
	sort.Strings(batchIDs)
	for _, id := range batchIDs {
		item, qty := first[id], need[id]
		var batchID pgtype.UUID
		if err := batchID.Scan(id); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("%s: the selected batch is invalid. Re-select the batch and try again.", item.ProductName))
			return
		}

		batch, err := q.LockBatchForUpdate(r.Context(), batchID)
		if err != nil {
			log.Printf("CreateOrder lock batch %s: %v", id, err)
			writeError(w, http.StatusBadRequest, fmt.Sprintf("%s: batch %s is no longer available. Re-select the batch and try again.", item.ProductName, item.BatchNo))
			return
		}
		if msg := expiredBatchMessage(item.ProductName, item.BatchNo, batch.ExpiryDate); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}

		available := batch.PurchaseQty - batch.SoldQty
		if available < qty {
			// A retry that waited on this lock behind its own first attempt: that
			// attempt has now committed and used the stock, so return its bill.
			if clientRef.Valid {
				if existing, findErr := q.GetOrderByClientRef(r.Context(), clientRef); findErr == nil {
					writeJSON(w, http.StatusOK, existing)
					return
				}
			}
			onLines := ""
			if lines[id] > 1 {
				onLines = fmt.Sprintf(" across %d lines", lines[id])
			}
			writeError(w, http.StatusBadRequest,
				fmt.Sprintf("Not enough stock for %s (batch %s): %d requested%s, only %d available.",
					item.ProductName, item.BatchNo, qty, onLines, available))
			return
		}
	}

	// Step 2: Upsert customer
	var customerID pgtype.UUID
	if req.Phone != "" {
		customer, err := q.GetCustomerByPhone(r.Context(), req.Phone)
		if errors.Is(err, pgx.ErrNoRows) {
			// New customer
			customer, err = q.CreateCustomer(r.Context(), generated.CreateCustomerParams{
				Phone: req.Phone,
				Name:  req.Name,
				Age:   req.Age,
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "could not create customer")
				return
			}
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, "could not lookup customer")
			return
		}
		customerID = customer.CustomerID
	}

	// Step 3: Generate order number
	orderNumber, err := generateOrderNum(r.Context(), q, claims.OrderPrefix)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate order number")
		return
	}

	// Step 4: Compute GST totals from items.
	// SalePrice is GST-inclusive (matches the inventory selling_price convention),
	// so tax is extracted from the line total rather than added on top.
	var cgstTotal, sgstTotal, igstTotal, totalAmount float64
	for _, item := range req.Items {
		lineTotal, cgst, sgst, igst := lineAmounts(item.SalePrice, item.Qty, item.GSTRate, req.IsInState)
		totalAmount += lineTotal
		cgstTotal += cgst
		sgstTotal += sgst
		igstTotal += igst
	}
	cgstTotal = round2(cgstTotal)
	sgstTotal = round2(sgstTotal)
	igstTotal = round2(igstTotal)
	totalAmount = round2(totalAmount)

	// Insert order
	order, err := q.CreateOrder(r.Context(), generated.CreateOrderParams{
		OrderNumber: orderNumber,
		CustomerID:  customerID,
		CgstTotal:   numericFromFloat(cgstTotal),
		SgstTotal:   numericFromFloat(sgstTotal),
		IgstTotal:   numericFromFloat(igstTotal),
		TotalAmount: numericFromFloat(totalAmount),
		PaymentMode: req.PaymentMode,
		ClientRef:   clientRef,
	})
	if isUniqueViolation(err) {
		tx.Rollback(r.Context())
		// Same bill submitted twice at once: the other request saved it.
		if clientRef.Valid {
			if existing, findErr := generated.New(conn).GetOrderByClientRef(r.Context(), clientRef); findErr == nil {
				writeJSON(w, http.StatusOK, existing)
				return
			}
		}
		// Otherwise another bill took the same bill number at the same moment.
		log.Printf("CreateOrder unique violation: %v", err)
		writeError(w, http.StatusConflict, "Another bill was saved at the same moment. Please press Place Order again.")
		return
	}
	if err != nil {
		log.Printf("CreateOrder error: %v", err)
		writeError(w, http.StatusInternalServerError, "Could not save the bill. Please try again.")
		return
	}

	// Step 5: Insert order items + deduct stock
	for _, item := range req.Items {
		var batchID pgtype.UUID
		batchID.Scan(item.BatchID)

		lineTotal, cgst, sgst, igst := lineAmounts(item.SalePrice, item.Qty, item.GSTRate, req.IsInState)

		if _, err := q.CreateOrderItem(r.Context(), generated.CreateOrderItemParams{
			OrderID:     order.OrderID,
			BatchID:     batchID,
			ProductName: item.ProductName,
			BatchNo:     item.BatchNo,
			Qty:         item.Qty,
			SalePrice:   numericFromFloat(item.SalePrice),
			GstRate:     numericFromFloat(item.GSTRate),
			CgstAmount:  numericFromFloat(cgst),
			SgstAmount:  numericFromFloat(sgst),
			IgstAmount:  numericFromFloat(igst),
			LineTotal:   numericFromFloat(lineTotal),
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not insert order item")
			return
		}

		var batchID2 pgtype.UUID
		batchID2.Scan(item.BatchID)
		if err := q.DeductBatchStock(r.Context(), generated.DeductBatchStockParams{
			BatchID: batchID2,
			SoldQty: item.Qty,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not deduct stock")
			return
		}
	}

	// Step 6: Increment visit count
	if customerID.Valid {
		q.IncrementVisitCount(r.Context(), customerID)
	}

	// Commit
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "transaction commit failed")
		return
	}

	writeJSON(w, http.StatusCreated, order)
}

var (
	allowedOrderStatuses = map[string]bool{"active": true, "returned": true, "partially_returned": true, "deleted": true}
	allowedPaymentModes  = map[string]bool{"cash": true, "upi": true, "card": true, "mixed": true}
	allowedOrderSorts    = map[string]bool{"date_asc": true, "date_desc": true, "total_asc": true, "total_desc": true}
)

func (h *OrderHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("q")
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limitVal, _ := strconv.Atoi(q.Get("limit"))
	if limitVal < 1 || limitVal > 200 {
		limitVal = 50
	}
	limit := int32(limitVal)
	offset := int32((page - 1) * int(limit))

	statuses, err := parseEnumList(q["status"], allowedOrderStatuses)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid status: "+err.Error())
		return
	}
	// Default (no chips selected) shows every order, deleted ones included, so the
	// history is complete. Deleted orders never count in sales or reports.

	payments, err := parseEnumList(q["payment"], allowedPaymentModes)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment: "+err.Error())
		return
	}

	dateFrom, err := parseOptionalDate(q.Get("date_from"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "date_from must be YYYY-MM-DD")
		return
	}
	dateTo, err := parseOptionalDate(q.Get("date_to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "date_to must be YYYY-MM-DD")
		return
	}

	sortKey := q.Get("sort")
	if sortKey == "" {
		sortKey = "date_desc"
	} else if !allowedOrderSorts[sortKey] {
		writeError(w, http.StatusBadRequest, "invalid sort key")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	total, err := queries.CountOrdersFiltered(r.Context(), generated.CountOrdersFilteredParams{
		Column1: search,
		Column2: statuses,
		Column3: payments,
		Column4: dateFrom,
		Column5: dateTo,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count orders")
		return
	}

	orders, err := queries.ListOrders(r.Context(), generated.ListOrdersParams{
		Column1: search,
		Column2: statuses,
		Column3: payments,
		Column4: dateFrom,
		Column5: dateTo,
		Column6: sortKey,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch orders")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"orders": orders,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

// parseEnumList expands repeated query values (and comma-separated forms) and validates
// each entry against the allowed set. Returns nil for "no filter" so the SQL `IS NULL` branch fires.
func parseEnumList(raw []string, allowed map[string]bool) ([]string, error) {
	out := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, entry := range raw {
		for _, v := range splitCSV(entry) {
			if !allowed[v] {
				return nil, fmt.Errorf("%q", v)
			}
			if seen[v] {
				continue
			}
			seen[v] = true
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	out := []string{}
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}

func parseOptionalDate(s string) (pgtype.Date, error) {
	var d pgtype.Date
	if s == "" {
		return d, nil // Valid=false → SQL receives NULL
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return d, err
	}
	d.Time = t
	d.Valid = true
	return d, nil
}

func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	order, err := queries.GetOrderByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "order not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not fetch order")
		return
	}

	items, err := queries.GetOrderItems(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch order items")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"order": order,
		"items": items,
	})
}

func (h *OrderHandler) SoftDeleteOrder(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())

	// Verify order is active
	q := generated.New(conn)
	order, err := q.GetOrderByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	if order.Status != "active" {
		writeError(w, http.StatusBadRequest, "only active orders can be deleted")
		return
	}

	// Restore stock in a transaction
	if err := restoreOrderStock(r.Context(), conn, q, id); err != nil {
		log.Printf("SoftDeleteOrder restore stock error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not delete order")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *OrderHandler) ReturnOrder(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())

	// Verify order is active
	q := generated.New(conn)
	order, err := q.GetOrderByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	if order.Status != "active" {
		writeError(w, http.StatusBadRequest, "only active orders can be returned")
		return
	}

	// Restore stock and mark as returned
	tx, err := conn.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	txq := generated.New(tx)

	items, err := txq.GetOrderItems(r.Context(), id)
	if err != nil {
		log.Printf("ReturnOrder get items error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not fetch order items")
		return
	}

	for _, item := range items {
		if _, err := txq.LockBatchForUpdate(r.Context(), item.BatchID); err != nil {
			log.Printf("ReturnOrder lock batch error: %v", err)
			writeError(w, http.StatusInternalServerError, "could not lock batch")
			return
		}
		if err := txq.RestoreBatchStock(r.Context(), generated.RestoreBatchStockParams{
			BatchID: item.BatchID,
			SoldQty: item.Qty,
		}); err != nil {
			log.Printf("ReturnOrder restore stock error: %v", err)
			writeError(w, http.StatusInternalServerError, "could not restore stock")
			return
		}
	}

	if err := txq.MarkOrderReturned(r.Context(), id); err != nil {
		log.Printf("ReturnOrder mark returned error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not mark order as returned")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit return")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "returned"})
}

type editItemRequest struct {
	ItemID string `json:"item_id"`
	NewQty int32  `json:"new_qty"`
}

type editAdditionRequest struct {
	BatchID     string  `json:"batch_id"`
	ProductName string  `json:"product_name"`
	BatchNo     string  `json:"batch_no"`
	Qty         int32   `json:"qty"`
	SalePrice   float64 `json:"sale_price"`
	GSTRate     float64 `json:"gst_rate"`
}

type editOrderRequest struct {
	Edits     []editItemRequest     `json:"edits"`
	Additions []editAdditionRequest `json:"additions"`
	Comment   string                `json:"comment"`
}

func numericToFloat(n pgtype.Numeric) float64 {
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func (h *OrderHandler) EditOrder(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var req editOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Edits) == 0 && len(req.Additions) == 0 {
		writeError(w, http.StatusBadRequest, "no changes provided")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	q := generated.New(conn)

	order, err := q.GetOrderByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "order not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not fetch order")
		return
	}
	if order.Status != "active" && order.Status != "partially_returned" {
		writeError(w, http.StatusBadRequest, "only active or partially_returned orders can be edited")
		return
	}

	// Determine GST mode of the existing order (in-state vs out-of-state).
	// in-state ⇒ cgst/sgst split; out-of-state ⇒ igst.
	isInState := numericToFloat(order.CgstTotal) > 0 || numericToFloat(order.SgstTotal) > 0
	if !isInState && numericToFloat(order.IgstTotal) == 0 {
		// Totals all zero (e.g., 0% GST items) — fall back to per-item lookup.
		existingItems, err := q.GetOrderItems(r.Context(), id)
		if err == nil {
			for _, it := range existingItems {
				if numericToFloat(it.CgstAmount) > 0 || numericToFloat(it.SgstAmount) > 0 {
					isInState = true
					break
				}
				if numericToFloat(it.IgstAmount) > 0 {
					isInState = false
					break
				}
			}
			// If still ambiguous (all 0% GST), default to in-state.
			if !isInState {
				// Heuristic: assume in-state for 0% GST orders.
				isInState = true
			}
		}
	}

	tx, err := conn.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())
	txq := generated.New(tx)

	// Process edits (returns).
	for _, edit := range req.Edits {
		var itemID pgtype.UUID
		if err := itemID.Scan(edit.ItemID); err != nil {
			writeError(w, http.StatusBadRequest, "One of the bill lines is invalid. Reload the order and try again.")
			return
		}
		item, err := txq.GetOrderItemByID(r.Context(), itemID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "One of the bill lines no longer exists. Reload the order and try again.")
			return
		}
		if item.OrderID != order.OrderID {
			writeError(w, http.StatusBadRequest, "item does not belong to this order")
			return
		}
		if edit.NewQty < 0 {
			writeError(w, http.StatusBadRequest,
				fmt.Sprintf("invalid new_qty for %s: must be >= 0", item.ProductName))
			return
		}
		active := item.Qty - item.ReturnedQty
		delta := edit.NewQty - active
		if delta == 0 {
			continue
		}
		if delta < 0 {
			// Decrease — partial / full return for this line.
			returnDelta := -delta
			if _, err := txq.LockBatchForUpdate(r.Context(), item.BatchID); err != nil {
				writeError(w, http.StatusInternalServerError, "could not lock batch")
				return
			}
			if err := txq.RestoreBatchStock(r.Context(), generated.RestoreBatchStockParams{
				BatchID: item.BatchID,
				SoldQty: returnDelta,
			}); err != nil {
				writeError(w, http.StatusInternalServerError, "could not restore stock")
				return
			}
			if err := txq.UpdateOrderItemReturnedQty(r.Context(), generated.UpdateOrderItemReturnedQtyParams{
				ItemID:      itemID,
				ReturnedQty: returnDelta,
			}); err != nil {
				writeError(w, http.StatusInternalServerError, "could not update returned_qty")
				return
			}
			continue
		}
		// Increase — additional units sold under the same line.
		batch, err := txq.LockBatchForUpdate(r.Context(), item.BatchID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not lock batch")
			return
		}
		available := batch.PurchaseQty - batch.SoldQty
		if available < delta {
			writeError(w, http.StatusBadRequest,
				fmt.Sprintf("insufficient stock for %s: requested %d, available %d",
					item.ProductName, delta, available))
			return
		}
		if err := txq.DeductBatchStock(r.Context(), generated.DeductBatchStockParams{
			BatchID: item.BatchID,
			SoldQty: delta,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not deduct stock")
			return
		}
		// Recompute the line's GST + total for the new qty using the order's GST mode.
		newQty := item.Qty + delta
		lineTotal, cgst, sgst, igst := lineAmounts(numericToFloat(item.SalePrice), newQty, numericToFloat(item.GstRate), isInState)
		if err := txq.UpdateOrderItemQuantity(r.Context(), generated.UpdateOrderItemQuantityParams{
			ItemID:     itemID,
			Qty:        newQty,
			CgstAmount: numericFromFloat(cgst),
			SgstAmount: numericFromFloat(sgst),
			IgstAmount: numericFromFloat(igst),
			LineTotal:  numericFromFloat(lineTotal),
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update item qty")
			return
		}
	}

	// Process additions.
	for _, add := range req.Additions {
		if msg := validateBillLine(add.ProductName, add.Qty, add.SalePrice, add.GSTRate); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		var batchID pgtype.UUID
		if err := batchID.Scan(add.BatchID); err != nil {
			writeError(w, http.StatusBadRequest, "The selected batch is invalid. Re-select the batch and try again.")
			return
		}
		batch, err := txq.LockBatchForUpdate(r.Context(), batchID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "The selected batch is no longer available. Re-select the batch and try again.")
			return
		}
		if msg := expiredBatchMessage(add.ProductName, add.BatchNo, batch.ExpiryDate); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		available := batch.PurchaseQty - batch.SoldQty
		if available < add.Qty {
			writeError(w, http.StatusBadRequest,
				fmt.Sprintf("Not enough stock for %s (batch %s): %d requested, only %d available.",
					add.ProductName, add.BatchNo, add.Qty, available))
			return
		}
		lineTotal, cgst, sgst, igst := lineAmounts(add.SalePrice, add.Qty, add.GSTRate, isInState)
		if _, err := txq.CreateOrderItem(r.Context(), generated.CreateOrderItemParams{
			OrderID:     order.OrderID,
			BatchID:     batchID,
			ProductName: add.ProductName,
			BatchNo:     add.BatchNo,
			Qty:         add.Qty,
			SalePrice:   numericFromFloat(add.SalePrice),
			GstRate:     numericFromFloat(add.GSTRate),
			CgstAmount:  numericFromFloat(cgst),
			SgstAmount:  numericFromFloat(sgst),
			IgstAmount:  numericFromFloat(igst),
			LineTotal:   numericFromFloat(lineTotal),
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not insert added item")
			return
		}
		if err := txq.DeductBatchStock(r.Context(), generated.DeductBatchStockParams{
			BatchID: batchID,
			SoldQty: add.Qty,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "could not deduct stock")
			return
		}
	}

	// Recalculate order totals from current state of all items.
	updatedItems, err := txq.GetOrderItems(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch updated items")
		return
	}
	var cgstTotal, sgstTotal, igstTotal, totalAmount float64
	anyReturn, allReturned := false, true
	totalActive := int32(0)
	for _, it := range updatedItems {
		active := it.Qty - it.ReturnedQty
		totalActive += active
		if it.ReturnedQty > 0 {
			anyReturn = true
		}
		if active > 0 {
			allReturned = false
		}
		if it.Qty == 0 {
			continue
		}
		ratio := float64(active) / float64(it.Qty)
		cgstTotal += round2(numericToFloat(it.CgstAmount) * ratio)
		sgstTotal += round2(numericToFloat(it.SgstAmount) * ratio)
		igstTotal += round2(numericToFloat(it.IgstAmount) * ratio)
		totalAmount += round2(numericToFloat(it.LineTotal) * ratio)
	}
	cgstTotal = round2(cgstTotal)
	sgstTotal = round2(sgstTotal)
	igstTotal = round2(igstTotal)
	totalAmount = round2(totalAmount)

	newStatus := "active"
	if totalActive == 0 && allReturned {
		newStatus = "returned"
	} else if anyReturn {
		newStatus = "partially_returned"
	}

	var commentPtr *string
	trimmed := req.Comment
	if trimmed != "" {
		commentPtr = &trimmed
	} else if order.ReturnComment != nil {
		commentPtr = order.ReturnComment
	}

	if err := txq.UpdateOrderAfterEdit(r.Context(), generated.UpdateOrderAfterEditParams{
		OrderID:       id,
		Status:        newStatus,
		ReturnComment: commentPtr,
		CgstTotal:     numericFromFloat(cgstTotal),
		SgstTotal:     numericFromFloat(sgstTotal),
		IgstTotal:     numericFromFloat(igstTotal),
		TotalAmount:   numericFromFloat(totalAmount),
	}); err != nil {
		log.Printf("EditOrder update error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not update order")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit edit")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": newStatus})
}

// restoreOrderStock restores sold_qty for all items in an order, then soft-deletes it.
var validGSTRates = map[float64]bool{0: true, 5: true, 12: true, 18: true, 28: true}

// validateBillLine checks a line's quantity, price and GST rate before any stock
// is touched, and returns a message for the shop owner ("" when fine). A price
// above MRP is allowed on purpose.
func validateBillLine(name string, qty int32, salePrice, gstRate float64) string {
	switch {
	case qty <= 0:
		return fmt.Sprintf("%s: quantity must be at least 1.", name)
	case salePrice <= 0:
		return fmt.Sprintf("%s: enter a selling price above ₹0.", name)
	case !validGSTRates[gstRate]:
		return fmt.Sprintf("%s: GST must be 0%%, 5%%, 12%%, 18%% or 28%%.", name)
	}
	return ""
}

// expiredBatchMessage returns a message if the batch has expired (its expiry date
// is today or earlier, IST), matching the batches offered for billing.
func expiredBatchMessage(name, batchNo string, expiry pgtype.Date) string {
	if expiry.Valid && !expiry.Time.After(todayIST()) {
		return fmt.Sprintf("%s (batch %s) expired on %s. Remove it from the bill.", name, batchNo, expiry.Time.Format("02 Jan 2006"))
	}
	return ""
}

// lineAmounts prices one bill line. salePrice is GST-inclusive (the MRP-based
// price the customer pays), so the tax is extracted from the line total, never
// added on top. Used for new bills and for lines added or increased on edit.
func lineAmounts(salePrice float64, qty int32, gstRate float64, inState bool) (lineTotal, cgst, sgst, igst float64) {
	lineTotal = round2(salePrice * float64(qty))
	taxable := lineTotal
	if gstRate > 0 {
		taxable = lineTotal / (1 + gstRate/100)
	}
	tax := round2(lineTotal - taxable)
	if inState {
		// Split in whole paise so CGST + SGST is the tax exactly; CGST takes
		// the odd paisa (₹5.33 → 2.67 + 2.66, not 2.67 + 2.67).
		paise := int64(math.Round(tax * 100))
		cgst = float64((paise+1)/2) / 100
		sgst = float64(paise/2) / 100
	} else {
		igst = tax
	}
	return
}

func restoreOrderStock(ctx interface {
	Deadline() (deadline time.Time, ok bool)
	Done() <-chan struct{}
	Err() error
	Value(key any) any
}, conn *pgxpool.Conn, _ *generated.Queries, orderID pgtype.UUID) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := generated.New(tx)

	items, err := q.GetOrderItems(ctx, orderID)
	if err != nil {
		return fmt.Errorf("get items: %w", err)
	}

	for _, item := range items {
		if _, err := q.LockBatchForUpdate(ctx, item.BatchID); err != nil {
			return fmt.Errorf("lock batch %v: %w", item.BatchID, err)
		}
		if err := q.RestoreBatchStock(ctx, generated.RestoreBatchStockParams{
			BatchID: item.BatchID,
			SoldQty: item.Qty,
		}); err != nil {
			return fmt.Errorf("restore batch %v: %w", item.BatchID, err)
		}
	}

	if err := q.SoftDeleteOrder(ctx, orderID); err != nil {
		return fmt.Errorf("soft delete: %w", err)
	}

	return tx.Commit(ctx)
}

// generateOrderNumber produces a sequential order number: PREFIX/NNNN/YY-YY
// e.g. INV/0042/25-26
func generateOrderNumberFromCtx(ctx interface{}, q *generated.Queries, prefix string) (string, error) {
	return "", nil // placeholder — replaced below
}

func generateOrderNum(ctx interface {
	Deadline() (deadline time.Time, ok bool)
	Done() <-chan struct{}
	Err() error
	Value(key any) any
}, q *generated.Queries, prefix string) (string, error) {
	// The financial year starts on 1 April IST, not at 05:30 IST.
	now := time.Now().In(ist)
	fyStart := financialYearStart(now)
	fyLabel := fmt.Sprintf("%02d-%02d", fyStart.Year()%100, (fyStart.Year()+1)%100)

	var ts pgtype.Timestamptz
	ts.Time = fyStart
	ts.Valid = true

	count, err := q.CountOrdersInFY(ctx, ts)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s/%04d/%s", prefix, count+1, fyLabel), nil
}

func financialYearStart(t time.Time) time.Time {
	year := t.Year()
	if t.Month() < time.April {
		year--
	}
	return time.Date(year, time.April, 1, 0, 0, 0, 0, t.Location())
}
