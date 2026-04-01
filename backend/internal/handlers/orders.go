package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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

	claims := middleware.ClaimsFromCtx(r.Context())
	conn := middleware.ConnFromCtx(r.Context())

	// Begin ACID transaction
	tx, err := conn.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context()) // no-op if committed

	q := generated.New(tx)

	// Step 1: Lock batches and validate stock
	for _, item := range req.Items {
		var batchID pgtype.UUID
		if err := batchID.Scan(item.BatchID); err != nil {
			writeError(w, http.StatusBadRequest, "invalid batch_id: "+item.BatchID)
			return
		}

		batch, err := q.LockBatchForUpdate(r.Context(), batchID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "batch not found: "+item.BatchID)
			return
		}

		available := batch.PurchaseQty - batch.SoldQty
		if available < item.Qty {
			writeError(w, http.StatusBadRequest,
				fmt.Sprintf("insufficient stock for %s: requested %d, available %d",
					item.ProductName, item.Qty, available))
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

	// Step 4: Compute GST totals from items
	var cgstTotal, sgstTotal, igstTotal, totalAmount float64
	for _, item := range req.Items {
		taxable := item.SalePrice * float64(item.Qty)
		totalTax := round2(taxable * (item.GSTRate / 100))
		lineTotal := round2(taxable + totalTax)
		totalAmount += lineTotal
		if req.IsInState {
			cgstTotal += round2(totalTax / 2)
			sgstTotal += round2(totalTax / 2)
		} else {
			igstTotal += totalTax
		}
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
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create order")
		return
	}

	// Step 5: Insert order items + deduct stock
	for _, item := range req.Items {
		var batchID pgtype.UUID
		batchID.Scan(item.BatchID)

		taxable := item.SalePrice * float64(item.Qty)
		totalTax := round2(taxable * (item.GSTRate / 100))
		lineTotal := round2(taxable + totalTax)
		var cgst, sgst, igst float64
		if req.IsInState {
			cgst = round2(totalTax / 2)
			sgst = round2(totalTax / 2)
		} else {
			igst = totalTax
		}

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

func (h *OrderHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limitVal, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limitVal < 1 || limitVal > 200 {
		limitVal = 50
	}
	limit := int32(limitVal)
	offset := int32((page - 1) * int(limit))

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	total, err := queries.CountOrdersFiltered(r.Context(), search)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count orders")
		return
	}

	orders, err := queries.ListOrders(r.Context(), generated.ListOrdersParams{
		Column1: search,
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
	queries := generated.New(conn)

	if err := queries.SoftDeleteOrder(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete order")
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
	now := time.Now()
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
