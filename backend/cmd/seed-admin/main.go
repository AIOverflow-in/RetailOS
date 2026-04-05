package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

	"github.com/retail-os/backend/internal/config"
	"github.com/retail-os/backend/internal/db"
	"github.com/retail-os/backend/internal/generated"
)

func main() {
	username := flag.String("username", "", "Super admin username (required)")
	email := flag.String("email", "", "Super admin email for 2FA (required)")
	password := flag.String("password", "", "Super admin password (required)")
	flag.Parse()

	if *username == "" || *email == "" || *password == "" {
		log.Fatal("Usage: go run ./cmd/seed-admin --username=admin --email=you@example.com --password=secret")
	}

	godotenv.Load()
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer pool.Close()

	hashed, err := bcrypt.GenerateFromPassword([]byte(*password), 12)
	if err != nil {
		log.Fatalf("could not hash password: %v", err)
	}

	_, err = pool.Exec(ctx,
		"INSERT INTO super_admins (username, email, hashed_password) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING",
		*username, *email, string(hashed),
	)
	if err != nil {
		log.Fatalf("could not insert super admin: %v", err)
	}

	// Verify it was created
	q := generated.New(pool)
	admin, err := q.GetSuperAdminByUsername(ctx, *username)
	if err != nil {
		log.Fatalf("could not verify super admin: %v", err)
	}

	fmt.Printf("Super admin seeded successfully:\n  Username: %s\n  Email:    %s\n  ID:       %s\n", admin.Username, admin.Email, admin.ID.String())
}
