package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"reflect"
	"time"

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

// ist is India Standard Time. Every shop is in India, so "today", report date
// ranges, the financial year and expiry are IST dates whatever zone the server
// runs in (Render is UTC). India has no daylight saving, so a fixed offset is exact.
var ist = time.FixedZone("IST", 5*60*60+30*60)

// todayIST is today's IST date at 00:00 UTC, the same form time.Parse gives a
// YYYY-MM-DD string, so the two compare as plain dates.
func todayIST() time.Time {
	y, m, d := time.Now().In(ist).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
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
