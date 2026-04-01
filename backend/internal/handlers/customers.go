package handlers

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type CustomerHandler struct{ pool *pgxpool.Pool }

func NewCustomerHandler(pool *pgxpool.Pool) *CustomerHandler {
	return &CustomerHandler{pool: pool}
}

// LookupCustomer handles GET /customers?phone=XXXXXXXXXX
func (h *CustomerHandler) LookupCustomer(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	if len(phone) != 10 {
		writeError(w, http.StatusBadRequest, "phone must be exactly 10 digits")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	customer, err := queries.GetCustomerByPhone(r.Context(), phone)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, nil) // Not found — caller creates new customer
			return
		}
		writeError(w, http.StatusInternalServerError, "could not lookup customer")
		return
	}

	writeJSON(w, http.StatusOK, customer)
}
