package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/xxrenzhe/autoads/services/identity/internal/auth"
	"github.com/xxrenzhe/autoads/services/identity/internal/domain"
	"github.com/xxrenzhe/autoads/services/identity/internal/events"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	firebaseauth "firebase.google.com/go/v4/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the dependencies for the HTTP handlers.
type Handler struct {
	DB             *pgxpool.Pool
	AuthClient     *firebaseauth.Client
	EventPublisher events.Publisher
}

// NewHandler creates a new Handler with dependencies.
func NewHandler(db *pgxpool.Pool, authClient *firebaseauth.Client, publisher events.Publisher) *Handler {
	return &Handler{
		DB:             db,
		AuthClient:     authClient,
		EventPublisher: publisher,
	}
}

// RegisterRoutes sets up the routing for the service.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
    // Basic liveness
    mux.HandleFunc("/healthz", h.healthz)
    mux.HandleFunc("/health", h.healthz)
    // Global aggregate health (unauthenticated) for API Gateway
    mux.HandleFunc("/api/health", h.healthAggregate)
    // Identity-specific health alias
    mux.HandleFunc("/api/v1/identity/healthz", h.healthz)
    // Protected routes
    mux.Handle("/api/v1/identity/register", authMiddleware(http.HandlerFunc(h.registerUser)))
    mux.Handle("/api/v1/identity/me", authMiddleware(http.HandlerFunc(h.getCurrentUser)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// healthAggregate fans out to configured service health endpoints and aggregates status.
// Configure via env: HEALTH_TARGETS=name=url,name=url,... (e.g. adscenter=https://adscenter.../health)
func (h *Handler) healthAggregate(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    targetsEnv := os.Getenv("HEALTH_TARGETS")
    targets := map[string]string{}
    if targetsEnv != "" {
        targets = parseTargets(targetsEnv)
    }
    // If no targets configured, return own health
    if len(targets) == 0 {
        _ = json.NewEncoder(w).Encode(map[string]any{
            "status":   "ok",
            "services": map[string]any{"identity": map[string]any{"code": 200, "ok": true}},
            "message":  "No HEALTH_TARGETS configured; reporting identity only.",
            "timestamp": time.Now().UTC().Format(time.RFC3339),
        })
        return
    }
    client := &http.Client{Timeout: 2 * time.Second}
    allOK := true
    results := map[string]any{}
    for name, url := range targets {
        code := 0
        ok := false
        if req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, url, nil); err == nil {
            if resp, err := client.Do(req); err == nil {
                code = resp.StatusCode
                ok = code >= 200 && code < 300
                resp.Body.Close()
            } else {
                log.Printf("healthAggregate: %s error: %v", name, err)
            }
        }
        if !ok { allOK = false }
        results[name] = map[string]any{"code": code, "ok": ok}
    }
    status := "ok"
    if !allOK { status = "degraded" }
    _ = json.NewEncoder(w).Encode(map[string]any{
        "status":    status,
        "services":  results,
        "timestamp": time.Now().UTC().Format(time.RFC3339),
    })
}

func parseTargets(env string) map[string]string {
    out := map[string]string{}
    for _, p := range strings.Split(env, ",") {
        p = strings.TrimSpace(p)
        if p == "" { continue }
        kv := strings.SplitN(p, "=", 2)
        if len(kv) != 2 { continue }
        name := strings.TrimSpace(kv[0])
        url := strings.TrimSpace(kv[1])
        if name == "" || url == "" { continue }
        // normalize url missing scheme
        if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
            url = fmt.Sprintf("https://%s", url)
        }
        out[name] = url
    }
    return out
}

func (h *Handler) registerUser(w http.ResponseWriter, r *http.Request) {
	firebaseUID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || firebaseUID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	firebaseUser, err := h.AuthClient.GetUser(context.Background(), firebaseUID)
	if err != nil {
		log.Printf("Error getting user from Firebase: %v", err)
		http.Error(w, "Failed to retrieve user data", http.StatusInternalServerError)
		return
	}

	// Check if user already exists in our DB
	var existingUserID string
	err = h.DB.QueryRow(context.Background(), `SELECT id FROM "User" WHERE id = $1`, firebaseUID).Scan(&existingUserID)
	if err == nil {
		// User already exists
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"id": existingUserID, "status": "user already exists"})
		return
	}

	// User does not exist, publish a UserRegistered event.
	event := domain.UserRegisteredEvent{
		UserID:       firebaseUID,
		Email:        firebaseUser.Email,
		DisplayName:  firebaseUser.DisplayName,
		Role:         "USER", // Default role for new users
		RegisteredAt: time.Now(),
	}

	err = h.EventPublisher.Publish(r.Context(), event)
	if err != nil {
		log.Printf("Error publishing UserRegisteredEvent: %v", err)
		http.Error(w, "Failed to process registration", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 Accepted: The request has been accepted for processing
	json.NewEncoder(w).Encode(map[string]string{"id": firebaseUID, "status": "registration request accepted"})
}

func (h *Handler) getCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	var email, name, role string
	err := h.DB.QueryRow(context.Background(), `SELECT email, name, role FROM "User" WHERE id = $1`, userID).Scan(&email, &name, &role)
	if err != nil {
		log.Printf("Error fetching user %s: %v", userID, err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"id":    userID,
		"email": email,
		"name":  name,
		"role":  role,
	})
}
