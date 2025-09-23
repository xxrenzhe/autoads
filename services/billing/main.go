package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/xxrenzhe/autoads/services/billing/internal/auth"
	"github.com/xxrenzhe/autoads/services/billing/internal/config"


	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	log.Println("Running database migrations...")
	if err := runMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}
	defer dbpool.Close()

    // Omit Pub/Sub subscriber in minimal deployment; projections run via CFs in prod.
    log.Println("Billing: skipping in-process Pub/Sub subscriber (use CFs in prod)")

	authClient := auth.NewClient(ctx)
	apiHandler := NewHandler(dbpool)
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Billing service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

// runMigrations remains the same...
// HTTP Handler and DTOs remain the same...

// The rest of the file (runMigrations, Handlers, DTOs, etc.) is unchanged.
// For brevity, it's omitted here but should be considered part of the file.
func runMigrations(databaseURL string) error {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil { return err }
	defer db.Close()
	if err = db.Ping(); err != nil { return err }
	tx, err := db.Begin()
	if err != nil { return err }
	defer tx.Rollback()
	migrationsDir := "internal/migrations"
    files, err := os.ReadDir(migrationsDir)
    if err != nil {
        if os.IsNotExist(err) {
            log.Printf("No migrations directory found (%s); skipping DB migrations.", migrationsDir)
            return tx.Commit()
        }
        return err
    }
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			log.Printf("Applying migration: %s", file.Name())
			content, err := os.ReadFile(filepath.Join(migrationsDir, file.Name()))
			if err != nil { return err }
			statements := strings.Split(string(content), ";")
			for _, stmt := range statements {
				if strings.TrimSpace(stmt) != "" {
					if _, err := tx.Exec(stmt); err != nil { return err }
				}
			}
		}
	}
	return tx.Commit()
}
type Handler struct { DB *pgxpool.Pool }
func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.Handle("/api/v1/billing/subscriptions/me", authMiddleware(http.HandlerFunc(h.getSubscription)))
	mux.Handle("/api/v1/billing/tokens/me", authMiddleware(http.HandlerFunc(h.getTokenBalance)))
	mux.Handle("/api/v1/billing/tokens/transactions", authMiddleware(http.HandlerFunc(h.getTokenTransactions)))
}
func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }
type Subscription struct {
	ID string `json:"id"`; PlanName string `json:"planName"`; Status string `json:"status"`; CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}
type TokenBalance struct {
	Balance int64 `json:"balance"`; UpdatedAt time.Time `json:"updatedAt"`
}
type TokenTransaction struct {
	ID string `json:"id"`; Type string `json:"type"`; Amount int `json:"amount"`; Description string `json:"description"`; CreatedAt time.Time `json:"createdAt"`
}
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
	respondWithJSON(w, http.StatusOK, []TokenTransaction{})
}
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
