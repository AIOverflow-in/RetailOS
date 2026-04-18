package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type DistributorHandler struct{ pool *pgxpool.Pool }

func NewDistributorHandler(pool *pgxpool.Pool) *DistributorHandler {
	return &DistributorHandler{pool: pool}
}

func (h *DistributorHandler) ListDistributors(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	distributors, err := queries.ListDistributors(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch distributors")
		return
	}
	writeJSON(w, http.StatusOK, distributors)
}

func (h *DistributorHandler) CreateDistributor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string  `json:"name"`
		Phone   *string `json:"phone"`
		Address *string `json:"address"`
		Email   *string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	distributor, err := queries.CreateDistributor(r.Context(), generated.CreateDistributorParams{
		Name:    body.Name,
		Phone:   body.Phone,
		Address: body.Address,
		Email:   body.Email,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create distributor: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, distributor)
}

func (h *DistributorHandler) UpdateDistributor(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var did pgtype.UUID
	if err := did.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid distributor id")
		return
	}

	var body struct {
		Name     string  `json:"name"`
		Phone    *string `json:"phone"`
		Address  *string `json:"address"`
		Email    *string `json:"email"`
		IsActive bool    `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	distributor, err := queries.UpdateDistributor(r.Context(), generated.UpdateDistributorParams{
		DistributorID: did,
		Name:          body.Name,
		Phone:         body.Phone,
		Address:       body.Address,
		Email:         body.Email,
		IsActive:      body.IsActive,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update distributor: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, distributor)
}

func (h *DistributorHandler) DeleteDistributor(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var did pgtype.UUID
	if err := did.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid distributor id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	count, err := queries.CountBatchesByDistributor(r.Context(), did)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not check linked batches")
		return
	}
	if count > 0 {
		writeError(w, http.StatusBadRequest, "cannot delete distributor with linked batches — reassign batches first")
		return
	}

	if err := queries.DeleteDistributor(r.Context(), did); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete distributor: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *DistributorHandler) ListBatchesByDistributor(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var did pgtype.UUID
	if err := did.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid distributor id")
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	batches, err := queries.ListBatchesByDistributor(r.Context(), did)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch batches")
		return
	}
	writeJSON(w, http.StatusOK, batches)
}
