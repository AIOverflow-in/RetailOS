package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"reflect"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	// Never encode nil slices as JSON null — return [] instead.
	if v != nil {
		rv := reflect.ValueOf(v)
		if rv.Kind() == reflect.Slice && rv.IsNil() {
			v = []struct{}{}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// isUniqueViolation reports whether err is a Postgres unique-constraint violation.
func isUniqueViolation(err error) bool {
	return pgErrorCode(err) == "23505"
}

// pgErrorCode returns the Postgres SQLSTATE of err, or "" if it isn't a Postgres error.
// 23505 unique, 23503 foreign key, 23514 check constraint.
func pgErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// serverError logs the underlying error for us and sends the shop owner a plain
// message. Raw database text never reaches the screen.
func serverError(w http.ResponseWriter, status int, userMsg string, err error) {
	log.Printf("%s: %v", userMsg, err)
	writeError(w, status, userMsg)
}

// numericFromFloat converts a float64 to pgtype.Numeric via string scanning.
func numericFromFloat(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	n.Scan(fmt.Sprintf("%.4f", f))
	return n
}

// round2 rounds to 2 decimal places.
func round2(f float64) float64 {
	return math.Round(f*100) / 100
}
