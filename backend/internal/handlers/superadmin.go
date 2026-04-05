package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/retail-os/backend/internal/email"
	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type SuperAdminHandler struct {
	pool      *pgxpool.Pool
	jwtSecret string
	smtp      email.SMTPConfig
}

func NewSuperAdminHandler(pool *pgxpool.Pool, jwtSecret string, smtp email.SMTPConfig) *SuperAdminHandler {
	return &SuperAdminHandler{pool: pool, jwtSecret: jwtSecret, smtp: smtp}
}

type saLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type saLoginResponse struct {
	Message   string `json:"message"`
	SessionID string `json:"session_id"`
}

func (h *SuperAdminHandler) Login(w http.ResponseWriter, r *http.Request) {
	if !h.smtp.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "SMTP is not configured")
		return
	}

	var req saLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	q := generated.New(h.pool)
	admin, err := q.GetSuperAdminByUsername(r.Context(), req.Username)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.HashedPassword), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	otp := generateOTP()

	otpRecord, err := q.CreateSuperAdminOTP(r.Context(), generated.CreateSuperAdminOTPParams{
		AdminID: admin.ID,
		OtpCode: otp,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create OTP")
		return
	}

	if err := email.SendOTP(h.smtp, admin.Email, otp); err != nil {
		writeError(w, http.StatusInternalServerError, "could not send OTP email")
		return
	}

	writeJSON(w, http.StatusOK, saLoginResponse{
		Message:   "OTP sent to registered email",
		SessionID: otpRecord.ID.String(),
	})
}

type verifyOTPRequest struct {
	SessionID string `json:"session_id"`
	OTP       string `json:"otp"`
}

type verifyOTPResponse struct {
	Token string `json:"token"`
}

func (h *SuperAdminHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req verifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SessionID == "" || req.OTP == "" {
		writeError(w, http.StatusBadRequest, "session_id and otp are required")
		return
	}

	var sessionID pgtype.UUID
	if err := sessionID.Scan(req.SessionID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid session_id")
		return
	}

	q := generated.New(h.pool)
	otpRow, err := q.GetOTPByID(r.Context(), sessionID, req.OTP)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired OTP")
		return
	}

	if err := q.MarkOTPUsed(r.Context(), otpRow.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not verify OTP")
		return
	}

	claims := &middleware.SuperAdminClaims{
		AdminID:  otpRow.AdminID.String(),
		Username: otpRow.Username,
		Role:     "super_admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(4 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate token")
		return
	}

	writeJSON(w, http.StatusOK, verifyOTPResponse{Token: signed})
}

func generateOTP() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", n.Int64())
}