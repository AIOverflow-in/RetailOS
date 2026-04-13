package db

import (
	"log"
	"time"
)

// Retry runs fn with exponential backoff. Used to ride out transient DNS
// failures and Neon serverless cold-starts on boot (e.g. "no such host"
// NXDOMAIN during endpoint wake).
func Retry(label string, fn func() error) error {
	delays := []time.Duration{2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second}

	var err error
	for attempt := 0; attempt <= len(delays); attempt++ {
		if err = fn(); err == nil {
			if attempt > 0 {
				log.Printf("%s: succeeded on attempt %d", label, attempt+1)
			}
			return nil
		}
		if attempt == len(delays) {
			break
		}
		log.Printf("%s: attempt %d failed: %v (retrying in %s)", label, attempt+1, err, delays[attempt])
		time.Sleep(delays[attempt])
	}
	return err
}
