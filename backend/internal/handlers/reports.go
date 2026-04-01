package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type ReportHandler struct{ pool *pgxpool.Pool }

func NewReportHandler(pool *pgxpool.Pool) *ReportHandler {
	return &ReportHandler{pool: pool}
}

func (h *ReportHandler) GSTReport(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRange(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	summary, err := queries.GSTReportSummary(r.Context(), generated.GSTReportSummaryParams{
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate report")
		return
	}

	slabs, err := queries.GSTSlabBreakdown(r.Context(), generated.GSTSlabBreakdownParams{
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate slab breakdown")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"summary": summary,
		"slabs":   slabs,
	})
}

func (h *ReportHandler) GSTReportCSV(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRange(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	conn := middleware.ConnFromCtx(r.Context())
	queries := generated.New(conn)

	slabs, err := queries.GSTSlabBreakdown(r.Context(), generated.GSTSlabBreakdownParams{
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate report")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf(
		`attachment; filename="gst_report_%s_%s.csv"`,
		from.Time.Format("2006-01-02"),
		to.Time.Format("2006-01-02"),
	))

	cw := csv.NewWriter(w)
	cw.Write([]string{"GST Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total"})
	for _, s := range slabs {
		cw.Write([]string{
			fmt.Sprintf("%.0f%%", mustFloat(s.GstRate)),
			fmt.Sprintf("%.2f", mustFloat(s.TaxableValue)),
			fmt.Sprintf("%.2f", mustFloat(s.Cgst)),
			fmt.Sprintf("%.2f", mustFloat(s.Sgst)),
			fmt.Sprintf("%.2f", mustFloat(s.Igst)),
			fmt.Sprintf("%.2f", mustFloat(s.Total)),
		})
	}
	cw.Flush()
}

func parseDateRange(r *http.Request) (pgtype.Timestamptz, pgtype.Timestamptz, error) {
	var from, to pgtype.Timestamptz

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	if fromStr == "" || toStr == "" {
		return from, to, fmt.Errorf("from and to query params are required (YYYY-MM-DD)")
	}

	fromT, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		return from, to, fmt.Errorf("invalid from date format, use YYYY-MM-DD")
	}
	toT, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		return from, to, fmt.Errorf("invalid to date format, use YYYY-MM-DD")
	}

	// End of day for 'to'
	toT = toT.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	from.Time = fromT
	from.Valid = true
	to.Time = toT
	to.Valid = true

	return from, to, nil
}

func mustFloat(n pgtype.Numeric) float64 {
	f, _ := n.Float64Value()
	return f.Float64
}
