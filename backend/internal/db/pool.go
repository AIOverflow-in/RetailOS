package db

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New creates and validates a pgxpool connection to NeonDB.
// Uses PgBouncer-compatible settings (statement cache disabled).
func New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	// Disable prepared statement cache — required for PgBouncer (transaction pooling mode)
	config.ConnConfig.DefaultQueryExecMode = 4 // pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	log.Println("Connected to NeonDB")
	return pool, nil
}
