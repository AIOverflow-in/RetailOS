package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	JWTSecret    string
	Port         string
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
}

func Load() *Config {
	// Load .env in local dev; in production env vars are set by Cloud Run
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	cfg := &Config{
		DatabaseURL:  mustGet("DATABASE_URL"),
		JWTSecret:    mustGet("JWT_SECRET"),
		Port:         getOrDefault("PORT", "8080"),
		SMTPHost:     getOrDefault("SMTP_HOST", ""),
		SMTPPort:     getOrDefault("SMTP_PORT", "587"),
		SMTPUsername: getOrDefault("SMTP_USERNAME", ""),
		SMTPPassword: getOrDefault("SMTP_PASSWORD", ""),
		SMTPFrom:     getOrDefault("SMTP_FROM", ""),
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
