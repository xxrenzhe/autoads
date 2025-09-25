package main

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "net/url"
    "os"
    "sync"
    "strings"
    "time"

    "github.com/google/uuid"
    "github.com/lib/pq"
    "github.com/go-chi/chi/v5"
    "github.com/xxrenzhe/autoads/pkg/httpclient"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/auth"
    "github.com/xxrenzhe/autoads/services/siterank/internal/pkg/database"
    "github.com/xxrenzhe/autoads/services/siterank/internal/pkg/secrets"
    "github.com/xxrenzhe/autoads/services/siterank/internal/events"
    api "github.com/xxrenzhe/autoads/services/siterank/internal/oapi"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

// --- Data Structures ---

type SiterankAnalysis struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	OfferID   string         `json:"offerId"`
	Status    string         `json:"status"`
	Result    *string        `json:"result,omitempty"` // JSON stored as a string
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type AnalysisRequest struct {
    OfferID string `json:"offerId"`
}

// SimilarWeb API response structure (simplified)
type SimilarWebResponse struct {
	GlobalRank int `json:"global_rank"`
	CountryRank int `json:"country_rank"`
	CategoryRank int `json:"category_rank"`
	TotalVisits float64 `json:"total_visits"`
}

type Server struct {
    db          *sql.DB
    httpClient  *httpclient.Client
    publisher   *events.Publisher
    cacheMu     sync.RWMutex
    cache       map[string]cacheEntry
}

type cacheEntry struct{ val string; exp time.Time }

// --- HTTP Handlers ---

func (s *Server) analysesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		s.createAnalysisHandler(w, r)
	case http.MethodGet:
		s.getAnalysisHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) createAnalysisHandler(w http.ResponseWriter, r *http.Request) {
    userID, errAuth := auth.ExtractUserID(r)
    if userID == "" {
        _ = errAuth
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
        return
    }
    idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))

    var req AnalysisRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil)
        return
    }
	if req.OfferID == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "OfferID is required", nil)
		return
	}

    // Handle idempotency: return existing mapping if key exists
    if idemKey != "" {
        if existingID, ok := s.lookupIdempotency(r.Context(), idemKey, userID, "siterank.analyze"); ok {
            if a, ok := s.getAnalysisByID(r.Context(), existingID, userID); ok {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusAccepted)
                _ = json.NewEncoder(w).Encode(a)
                return
            }
        }
    }

    analysis := SiterankAnalysis{
        ID:        uuid.New().String(),
        UserID:    userID,
        OfferID:   req.OfferID,
        Status:    "pending",
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

	query := `INSERT INTO "SiterankAnalysis" (id, user_id, offer_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`
    _, err := s.db.Exec(query, analysis.ID, analysis.UserID, analysis.OfferID, analysis.Status, analysis.CreatedAt, analysis.UpdatedAt)
    if err != nil {
        if pqErr, ok := err.(*pq.Error); ok && pqErr.Code.Name() == "unique_violation" {
            // If idempotency key is present, map it to the latest analysis for this offer/user and return it.
            if idemKey != "" {
                if latest, ok := s.getLatestAnalysisByOffer(r.Context(), req.OfferID, userID); ok {
                    _ = s.upsertIdempotency(r.Context(), idemKey, userID, "siterank.analyze", latest.ID, 24*time.Hour)
                    w.Header().Set("Content-Type", "application/json")
                    w.WriteHeader(http.StatusAccepted)
                    _ = json.NewEncoder(w).Encode(latest)
                    return
                }
            }
            errors.Write(w, r, http.StatusConflict, "ALREADY_EXISTS", "An analysis for this offer already exists.", nil)
            return
        }
        log.Printf("Error inserting new siterank analysis: %v", err)
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
    }

    // Publish requested event (best-effort)
    if s.publisher != nil {
        _ = s.publisher.Publish(r.Context(), "SiterankRequested", map[string]any{
            "analysisId": analysis.ID,
            "offerId":    analysis.OfferID,
            "userId":     analysis.UserID,
            "requestedAt": time.Now().UTC().Format(time.RFC3339),
        })
    }

    // Persist idempotency map (best-effort)
    if idemKey != "" { _ = s.upsertIdempotency(r.Context(), idemKey, userID, "siterank.analyze", analysis.ID, 24*time.Hour) }

    // Launch the analysis in the background
    go s.performAnalysis(context.Background(), analysis.ID)

	log.Printf("Accepted siterank analysis request %s for offer %s", analysis.ID, analysis.OfferID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 Accepted
	json.NewEncoder(w).Encode(analysis)
}

func (s *Server) getAnalysisHandler(w http.ResponseWriter, r *http.Request) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" {
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
        return
    }

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 || parts[2] == "" {
		http.Error(w, "Analysis ID is missing in URL path", http.StatusBadRequest)
		return
	}
	analysisID := parts[2]

	var analysis SiterankAnalysis
	var result sql.NullString
	query := `SELECT id, user_id, offer_id, status, result, created_at, updated_at FROM "SiterankAnalysis" WHERE id = $1 AND user_id = $2`
	err := s.db.QueryRow(query, analysisID, userID).Scan(
		&analysis.ID, &analysis.UserID, &analysis.OfferID, &analysis.Status, &result, &analysis.CreatedAt, &analysis.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Analysis not found", nil)
			return
		}
		log.Printf("Error getting siterank analysis: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}
	
	if result.Valid {
		analysis.Result = &result.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// getLatestAnalysisByOfferHandler returns the latest analysis record by offerId for the current user.
func (s *Server) getLatestAnalysisByOfferHandler(w http.ResponseWriter, r *http.Request) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" {
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
        return
    }

    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/siterank/"), "/")
    if len(parts) < 1 || parts[0] == "" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "offerId is required in path", nil)
        return
    }
    offerID := parts[0]

    var analysis SiterankAnalysis
    var result sql.NullString
    query := `SELECT id, user_id, offer_id, status, result, created_at, updated_at FROM "SiterankAnalysis" WHERE offer_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT 1`
    err := s.db.QueryRowContext(r.Context(), query, offerID, userID).Scan(
        &analysis.ID, &analysis.UserID, &analysis.OfferID, &analysis.Status, &result, &analysis.CreatedAt, &analysis.UpdatedAt,
    )
    if err != nil {
        if err == sql.ErrNoRows {
            errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Latest analysis not found", nil)
            return
        }
        log.Printf("Error getting latest siterank analysis by offer: %v", err)
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
    }
    if result.Valid { analysis.Result = &result.String }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(analysis)
}

func (s *Server) performAnalysis(ctx context.Context, analysisID string) {
    log.Printf("Starting analysis for %s...", analysisID)

	// 1. Set status to "running"
	_, err := s.db.ExecContext(ctx, `UPDATE "SiterankAnalysis" SET status = 'running', updated_at = $1 WHERE id = $2`, time.Now(), analysisID)
	if err != nil {
		log.Printf("Failed to update analysis %s to running: %v", analysisID, err)
		return
	}

	// 2. Get the offer URL from the database
	var originalUrl string
    err = s.db.QueryRowContext(ctx, `SELECT o.originalUrl FROM "Offer" o JOIN "SiterankAnalysis" sa ON o.id = sa.offer_id WHERE sa.id = $1`, analysisID).Scan(&originalUrl)
	if err != nil {
		log.Printf("Failed to get offer URL for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "offer URL not found: %v"}`, err))
		return
	}

	domain, err := url.Parse(originalUrl)
	if err != nil {
		log.Printf("Failed to parse offer URL for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "invalid offer URL: %v"}`, err))
		return
	}

    // 3. Global cache lookup by host (DB-backed)
    host := domain.Hostname()
    if payload, ok, found := s.lookupDomainCache(ctx, host); found {
        if ok {
            s.updateAnalysisStatus(ctx, analysisID, "completed", payload)
            if s.publisher != nil {
                _ = s.publisher.Publish(ctx, "SiterankCompleted", map[string]any{
                    "analysisId":  analysisID,
                    "completedAt": time.Now().UTC().Format(time.RFC3339),
                    "cacheHit":    true,
                })
            }
            log.Printf("Siterank global cache hit for %s", host)
            return
        }
        // cached failure
        s.updateAnalysisStatus(ctx, analysisID, "failed", payload)
        log.Printf("Siterank global cache hit (failure) for %s", host)
        return
    }

    // 4. Call SimilarWeb API (configurable base URL)
    base := os.Getenv("SIMILARWEB_BASE_URL")
    if base == "" {
        // Default to public endpoint, no API key required per environment note
        base = "https://data.similarweb.com/api/v1/data?domain=%s"
    }
    // cache lookup by host (5 min TTL)
    s.cacheMu.RLock()
    if ce, ok := s.cache[host]; ok && time.Now().Before(ce.exp) {
        s.cacheMu.RUnlock()
        s.updateAnalysisStatus(ctx, analysisID, "completed", ce.val)
        log.Printf("Siterank cache hit for %s", host)
        return
    }
    s.cacheMu.RUnlock()

    apiURL := fmt.Sprintf(base, host)
	var apiResponse SimilarWebResponse
	
    err = s.httpClient.GetJSON(ctx, apiURL, &apiResponse)
    if err != nil {
        log.Printf("Failed to get data from SimilarWeb for analysis %s: %v", analysisID, err)
        // Cache failure for 1 day (global)
        failPayload := fmt.Sprintf(`{"error": "SimilarWeb API failed: %v"}`, err)
        _ = s.upsertDomainCache(ctx, host, failPayload, false, 24*time.Hour)
        s.updateAnalysisStatus(ctx, analysisID, "failed", failPayload)
        return
    }
	
	// 4. Marshal result and update DB
	resultBytes, err := json.Marshal(apiResponse)
	if err != nil {
		log.Printf("Failed to marshal SimilarWeb response for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "failed to process API response: %v"}`, err))
		return
	}
	
    result := string(resultBytes)
    s.updateAnalysisStatus(ctx, analysisID, "completed", result)
    // Global cache success for 7 days
    _ = s.upsertDomainCache(ctx, host, result, true, 7*24*time.Hour)
    // fill local in-memory cache (short TTL)
    s.cacheMu.Lock(); if s.cache == nil { s.cache = map[string]cacheEntry{} }; s.cache[host] = cacheEntry{val: result, exp: time.Now().Add(5 * time.Minute)}; s.cacheMu.Unlock()
    if s.publisher != nil {
        _ = s.publisher.Publish(ctx, "SiterankCompleted", map[string]any{
            "analysisId":  analysisID,
            "completedAt": time.Now().UTC().Format(time.RFC3339),
        })
    }
    log.Printf("Successfully completed analysis for %s", analysisID)
}

func (s *Server) updateAnalysisStatus(ctx context.Context, analysisID, status, result string) {
    _, err := s.db.ExecContext(ctx, `UPDATE "SiterankAnalysis" SET status = $1, result = $2, updated_at = $3 WHERE id = $4`, status, result, time.Now(), analysisID)
    if err != nil {
        log.Printf("Failed to update analysis %s to %s: %v", analysisID, status, err)
    }
}

// --- Idempotency helpers ---
func (s *Server) lookupIdempotency(ctx context.Context, key, userID, scope string) (string, bool) {
    var id string
    err := s.db.QueryRowContext(ctx, `SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, key, userID, scope).Scan(&id)
    if err != nil {
        return "", false
    }
    return id, id != ""
}

func (s *Server) upsertIdempotency(ctx context.Context, key, userID, scope, targetID string, ttl time.Duration) error {
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
        VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
        ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at
    `, key, userID, scope, targetID, fmt.Sprintf("%d hours", int(ttl.Hours())))
    if err != nil {
        log.Printf("idempotency upsert failed: %v", err)
    }
    return err
}

func (s *Server) getAnalysisByID(ctx context.Context, id, userID string) (*SiterankAnalysis, bool) {
    var a SiterankAnalysis
    var result sql.NullString
    err := s.db.QueryRowContext(ctx, `SELECT id, user_id, offer_id, status, result, created_at, updated_at FROM "SiterankAnalysis" WHERE id=$1 AND user_id=$2`, id, userID).Scan(
        &a.ID, &a.UserID, &a.OfferID, &a.Status, &result, &a.CreatedAt, &a.UpdatedAt,
    )
    if err != nil { return nil, false }
    if result.Valid { a.Result = &result.String }
    return &a, true
}

func (s *Server) getLatestAnalysisByOffer(ctx context.Context, offerID, userID string) (*SiterankAnalysis, bool) {
    var a SiterankAnalysis
    var result sql.NullString
    err := s.db.QueryRowContext(ctx, `SELECT id, user_id, offer_id, status, result, created_at, updated_at FROM "SiterankAnalysis" WHERE offer_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 1`, offerID, userID).Scan(
        &a.ID, &a.UserID, &a.OfferID, &a.Status, &result, &a.CreatedAt, &a.UpdatedAt,
    )
    if err != nil { return nil, false }
    if result.Valid { a.Result = &result.String }
    return &a, true
}

// lookupDomainCache tries to get a non-expired cache entry for host from DB.
// returns (payload, okFlag, found)
func (s *Server) lookupDomainCache(ctx context.Context, host string) (string, bool, bool) {
    var payload sql.NullString
    var ok sql.NullBool
    err := s.db.QueryRowContext(ctx, `SELECT payload::text, ok FROM domain_cache WHERE host=$1 AND expires_at > NOW()`, host).Scan(&payload, &ok)
    if err != nil {
        if err == sql.ErrNoRows { return "", false, false }
        log.Printf("domain cache query failed for %s: %v", host, err)
        return "", false, false
    }
    if !payload.Valid || !ok.Valid { return "", false, false }
    return payload.String, ok.Bool, true
}

// upsertDomainCache writes cache for host with TTL; payload must be JSON string.
func (s *Server) upsertDomainCache(ctx context.Context, host, payload string, ok bool, ttl time.Duration) error {
    expires := time.Now().Add(ttl)
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO domain_cache (host, payload, ok, updated_at, expires_at)
        VALUES ($1, $2::jsonb, $3, NOW(), $4)
        ON CONFLICT (host) DO UPDATE SET payload=EXCLUDED.payload, ok=EXCLUDED.ok, updated_at=NOW(), expires_at=EXCLUDED.expires_at
    `, host, payload, ok, expires)
    if err != nil {
        log.Printf("domain cache upsert failed for %s: %v", host, err)
    }
    return err
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    fmt.Fprint(w, "ok")
}

func (s *Server) readyHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
    defer cancel()
    if err := s.db.PingContext(ctx); err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
        return
    }
    w.WriteHeader(http.StatusOK)
    fmt.Fprint(w, "ready")
}

// --- Main Function ---

func main() {
    log.Println("Starting Siterank service...")

    // Prefer standard name; fall back to legacy
    dbSecretName := os.Getenv("DATABASE_URL_SECRET_NAME")
    if dbSecretName == "" {
        dbSecretName = os.Getenv("DB_SECRET_NAME")
    }
    var dsn string
    var err error
    if dbSecretName != "" {
        dsn, err = secrets.GetSecret(dbSecretName)
        if err != nil {
            log.Fatalf("Failed to get database secret: %v", err)
        }
    } else {
        dsn = os.Getenv("DATABASE_URL")
        if dsn == "" {
            log.Fatalf("DATABASE_URL or DATABASE_URL_SECRET_NAME must be set")
        }
    }

	db, err := database.NewConnection(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection successful.")

    httpClient := httpclient.New(15 * time.Second)

    // Init publisher (best-effort)
    var pub *events.Publisher
    if p, err := events.NewPublisher(context.Background()); err != nil {
        log.Printf("WARN: siterank publisher init failed: %v", err)
    } else { pub = p; defer pub.Close() }

    // Ensure domain cache table exists (idempotent)
    if err := ensureDomainCacheDDL(db); err != nil {
        log.Printf("WARN: ensure domain_cache ddl failed: %v", err)
    }

    server := &Server{db: db, httpClient: httpClient, publisher: pub, cache: map[string]cacheEntry{}}

    // --- Router (chi) + OAS routes ---
    r := chi.NewRouter()
    r.Get("/health", healthHandler)
    r.Get("/healthz", healthHandler)
    r.Get("/readyz", server.readyHandler)

    // Bind OpenAPI routes under /api/v1 via generated chi server
    // Wrap with auth middleware to enforce Firebase/Gateway identity
    oas := &oasImpl{srv: server}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/api/v1",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
    })
    r.Mount("/", oapiHandler)

    port := os.Getenv("PORT")
    if port == "" {
        // Standardize on 8080 to match docker-compose container mapping
        port = "8080"
    }

    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, r); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// oasImpl implements the generated OpenAPI server interface and forwards to Server methods
type oasImpl struct{ srv *Server }

// POST /siterank/analyze
func (h *oasImpl) RequestSiterankAnalysis(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { http.Error(w, "Method not allowed", http.StatusMethodNotAllowed); return }
    h.srv.createAnalysisHandler(w, r)
}

// GET /siterank/{offerId}
func (h *oasImpl) GetLatestSiterankByOffer(w http.ResponseWriter, r *http.Request, offerId string) {
    // Directly use internal accessor to avoid path parsing
    userID, _ := auth.ExtractUserID(r)
    if userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    if a, ok := h.srv.getLatestAnalysisByOffer(r.Context(), offerId, userID); ok {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(a)
        return
    }
    errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Latest analysis not found", nil)
}

// ensureDomainCacheDDL creates domain_cache table/index if not exists.
func ensureDomainCacheDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS domain_cache (
  host       TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  ok         BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_domain_cache_expires ON domain_cache(expires_at);
`
    _, err := db.Exec(ddl)
    return err
}
