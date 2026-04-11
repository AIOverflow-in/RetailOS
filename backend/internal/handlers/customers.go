package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type CustomerHandler struct{ pool *pgxpool.Pool }

func NewCustomerHandler(pool *pgxpool.Pool) *CustomerHandler {
	return &CustomerHandler{pool: pool}
}

// LookupCustomer handles GET /customers
// If ?phone= is provided (10 digits), do a single-customer lookup.
// Otherwise, list customers with optional ?q=, ?page=, ?limit= params.
func (h *CustomerHandler) LookupCustomer(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")

	// Phone lookup mode (used by billing page)
	if phone != "" {
		if len(phone) != 10 {
			writeError(w, http.StatusBadRequest, "phone must be exactly 10 digits")
			return
		}

		conn := middleware.ConnFromCtx(r.Context())
		queries := generated.New(conn)

		customer, err := queries.GetCustomerByPhone(r.Context(), phone)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSON(w, http.StatusOK, nil)
				return
			}
			writeError(w, http.StatusInternalServerError, "could not lookup customer")
			return
		}
		writeJSON(w, http.StatusOK, customer)
		return
	}

	// List mode
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

	total, err := queries.CountCustomers(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count customers")
		return
	}

	customers, err := queries.ListCustomers(r.Context(), generated.ListCustomersParams{
		Column1: q,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch customers")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"customers": customers,
		"total":     total,
		"page":      page,
		"limit":     limit,
	})
}

func (h *CustomerHandler) UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var cid pgtype.UUID
	if err := cid.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid customer id")
		return
	}

	var body struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Age   *int32 `json:"age"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(body.Phone) != 10 {
		writeError(w, http.StatusBadRequest, "phone must be exactly 10 digits")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	customer, err := queries.UpdateCustomer(r.Context(), generated.UpdateCustomerParams{
		CustomerID: cid,
		Name:       body.Name,
		Phone:      body.Phone,
		Age:        body.Age,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update customer: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, customer)
}
