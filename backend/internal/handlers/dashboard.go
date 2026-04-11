package handlers

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type DashboardHandler struct{ pool *pgxpool.Pool }

func NewDashboardHandler(pool *pgxpool.Pool) *DashboardHandler {
	return &DashboardHandler{pool: pool}
}

func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	conn := middleware.ConnFromCtx(r.Context())
	q := generated.New(conn)

	// Today at 00:00 in local time
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	var todayTs pgtype.Timestamptz
	todayTs.Time = todayStart
	todayTs.Valid = true

	// Today's sales
	sales, err := q.DashboardTodaySales(r.Context(), todayTs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch today's sales")
		return
	}

	// Low stock count
	lowStock, err := q.DashboardLowStockCount(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch low stock count")
		return
	}

	// Expiring soon count
	expiring, err := q.DashboardExpiringCount(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch expiring count")
		return
	}

	// Payment mode split
	split, err := q.DashboardPaymentModeSplit(r.Context(), todayTs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch payment split")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total_sales":   sales.TotalSales,
		"order_count":   sales.OrderCount,
		"low_stock":     lowStock,
		"expiring_soon": expiring,
		"payment_split": split,
	})
}
