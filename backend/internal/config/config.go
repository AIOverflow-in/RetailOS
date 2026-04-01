package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	AdminSecretKey string
	Port           string
}

func Load() *Config {
	// Load .env in local dev; in production env vars are set by Cloud Run
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	cfg := &Config{
		DatabaseURL:    mustGet("DATABASE_URL"),
		JWTSecret:      mustGet("JWT_SECRET"),
		AdminSecretKey: mustGet("ADMIN_SECRET_KEY"),
		Port:           getOrDefault("PORT", "8080"),
	}

	return cfg
}

func mustGet(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %s is not set", key)
	}
	return v
}

func getOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
