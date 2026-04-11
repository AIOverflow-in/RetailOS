package email

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"time"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string

	ResendAPIKey string
	ResendFrom   string // From address for Resend (production)

	// Environment controls transport: "dev"/"development" = SMTP, anything else = Resend
	Environment string
}

func (c *SMTPConfig) IsConfigured() bool {
	if c.isDev() {
		return c.Host != "" && c.Username != "" && c.Password != "" && c.From != ""
	}
	return c.ResendAPIKey != "" && c.ResendFrom != ""
}

func (c *SMTPConfig) isDev() bool {
	return c.Environment == "dev" || c.Environment == "development"
}

func SendOTP(cfg SMTPConfig, to string, otp string) error {
	subject := "RetailOS Super Admin Login OTP"
	body := fmt.Sprintf(
		"Your one-time password for RetailOS Super Admin login is:\n\n%s\n\nThis code expires in 5 minutes. If you did not request this, ignore this email.",
		otp,
	)

	// dev/development → SMTP, production (or unset) → Resend
	if cfg.isDev() {
		return sendSMTP(cfg, to, subject, body)
	}
	return sendWithResend(cfg, to, subject, body)
}

func sendSMTP(cfg SMTPConfig, to string, subject string, body string) error {
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s",
		cfg.From, to, subject, body,
	)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	if cfg.Port == "465" {
		return sendWithTLS(cfg, addr, to, []byte(msg))
	}
	return sendWithSTARTTLS(cfg, addr, to, []byte(msg))
}

// sendWithResend sends email via Resend's HTTP API.
// Works on Render, Cloud Run, and any platform that blocks SMTP.
// Free tier: 3,000 emails/month.
func sendWithResend(cfg SMTPConfig, to string, subject string, body string) error {
	payload := map[string]interface{}{
		"from":    cfg.ResendFrom,
		"to":      []string{to},
		"subject": subject,
		"text":    body,
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal resend payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create resend request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("resend request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// sendWithTLS connects over implicit TLS (port 465).
func sendWithTLS(cfg SMTPConfig, addr string, to string, msg []byte) error {
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}

	tlsConn := tls.Client(conn, &tls.Config{ServerName: cfg.Host})
	if err := tlsConn.Handshake(); err != nil {
		conn.Close()
		return fmt.Errorf("tls handshake: %w", err)
	}

	client, err := smtp.NewClient(tlsConn, cfg.Host)
	if err != nil {
		tlsConn.Close()
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err := client.Mail(cfg.Username); err != nil {
		return fmt.Errorf("smtp MAIL FROM: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT TO: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}

	return client.Quit()
}

// sendWithSTARTTLS uses port 587 with STARTTLS upgrade, with a connection timeout.
func sendWithSTARTTLS(cfg SMTPConfig, addr string, to string, msg []byte) error {
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if err := client.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
		return fmt.Errorf("starttls: %w", err)
	}

	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err := client.Mail(cfg.Username); err != nil {
		return fmt.Errorf("smtp MAIL FROM: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT TO: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}

	return client.Quit()
}
