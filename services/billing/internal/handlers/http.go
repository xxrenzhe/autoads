package handlers

import (
    "encoding/json"
    "log"
    "net/http"
    "github.com/xxrenzhe/autoads/services/billing/internal/auth"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

// ... (Handler struct and NewHandler function are the same) ...
type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{DB: db}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.Handle("/api/v1/billing/subscriptions/me", authMiddleware(http.HandlerFunc(h.getSubscription)))
	mux.Handle("/api/v1/billing/tokens/me", authMiddleware(http.HandlerFunc(h.getTokenBalance)))
	mux.Handle("/api/v1/billing/tokens/transactions", authMiddleware(http.HandlerFunc(h.getTokenTransactions)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// --- DTOs ---
type Subscription struct {
	ID               string    `json:"id"`
	PlanName         string    `json:"planName"`
	Status           string    `json:"status"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}
type TokenBalance struct {
	Balance   int64     `json:"balance"`
	UpdatedAt time.Time `json:"updatedAt"`
}
type TokenTransaction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Amount      int       `json:"amount"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

// --- Route Handlers ---
func (h *Handler) getSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok { http.Error(w, "Unauthorized", http.StatusUnauthorized); return }
	var sub Subscription
	err := h.DB.QueryRow(r.Context(), `SELECT id, "planName", status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1`, userID).Scan(&sub.ID, &sub.PlanName, &sub.Status, &sub.CurrentPeriodEnd)
	if err != nil { http.Error(w, "Not found", http.StatusNotFound); return }
	respondWithJSON(w, http.StatusOK, sub)
}
func (h *Handler) getTokenBalance(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok { http.Error(w, "Unauthorized", http.StatusUnauthorized); return }
	var balance TokenBalance
	err := h.DB.QueryRow(r.Context(), `SELECT balance, "updatedAt" FROM "UserToken" WHERE "userId" = $1`, userID).Scan(&balance.Balance, &balance.UpdatedAt)
	if err != nil { http.Error(w, "Not found", http.StatusNotFound); return }
	respondWithJSON(w, http.StatusOK, balance)
}

func (h *Handler) getTokenTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	// For simplicity, we'll fetch the last 50 transactions without pagination.
	// A production implementation should include limit/offset query parameters.
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, type, amount, description, "createdAt" 
		FROM "TokenTransaction" 
		WHERE "userId" = $1 
		ORDER BY "createdAt" DESC
		LIMIT 50`, userID)
	if err != nil {
		log.Printf("Error querying token transactions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []TokenTransaction
	for rows.Next() {
		var t TokenTransaction
		if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.Description, &t.CreatedAt); err != nil {
			log.Printf("Error scanning transaction row: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

	respondWithJSON(w, http.StatusOK, transactions)
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
