package testutil

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// MockDBTX implements the generated.DBTX interface for testing handlers
// without a real database connection.
type MockDBTX struct {
	ExecFunc     func(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
	QueryFunc    func(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRowFunc func(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func (m *MockDBTX) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	if m.ExecFunc != nil {
		return m.ExecFunc(ctx, sql, args...)
	}
	return pgconn.NewCommandTag(""), nil
}

func (m *MockDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if m.QueryFunc != nil {
		return m.QueryFunc(ctx, sql, args...)
	}
	return nil, fmt.Errorf("Query not mocked")
}

func (m *MockDBTX) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	if m.QueryRowFunc != nil {
		return m.QueryRowFunc(ctx, sql, args...)
	}
	return &MockRow{err: fmt.Errorf("QueryRow not mocked")}
}

// MockRow implements pgx.Row for testing.
type MockRow struct {
	scanFunc func(dest ...interface{}) error
	err      error
}

func (r *MockRow) Scan(dest ...interface{}) error {
	if r.scanFunc != nil {
		return r.scanFunc(dest...)
	}
	return r.err
}

// NewMockRow creates a MockRow that calls the given scan function.
func NewMockRow(fn func(dest ...interface{}) error) *MockRow {
	return &MockRow{scanFunc: fn}
}

// NewErrorRow creates a MockRow that returns an error on Scan.
func NewErrorRow(err error) *MockRow {
	return &MockRow{err: err}
}
