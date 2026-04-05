package email

import (
	"fmt"
	"net/smtp"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

func (c *SMTPConfig) IsConfigured() bool {
	return c.Host != "" && c.Username != "" && c.Password != "" && c.From != ""
}

func SendOTP(cfg SMTPConfig, to string, otp string) error {
	subject := "RetailOS Super Admin Login OTP"
	body := fmt.Sprintf(
		"Your one-time password for RetailOS Super Admin login is:\n\n%s\n\nThis code expires in 5 minutes. If you did not request this, ignore this email.",
		otp,
	)

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s",
		cfg.From, to, subject, body,
	)

	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	return smtp.SendMail(addr, auth, cfg.Username, []string{to}, []byte(msg))
}
