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
    "strconv"
    "time"

    "cloud.google.com/go/firestore"
    "github.com/google/uuid"
    _ "github.com/lib/pq"
    "github.com/go-chi/chi/v5"
    "github.com/xxrenzhe/autoads/pkg/httpclient"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/auth"
    "github.com/xxrenzhe/autoads/services/siterank/internal/pkg/database"
    "github.com/xxrenzhe/autoads/services/siterank/internal/pkg/secrets"
    ev "github.com/xxrenzhe/autoads/pkg/events"
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
    publisher   *ev.Publisher
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

    // Try insert; if exists, return existing row via ON CONFLICT ... RETURNING
    analysis := SiterankAnalysis{ID: uuid.New().String(), UserID: userID, OfferID: req.OfferID, Status: "pending", CreatedAt: time.Now(), UpdatedAt: time.Now()}
    var result sql.NullString
    err := s.db.QueryRowContext(r.Context(), `
        INSERT INTO "SiterankAnalysis"(id, user_id, offer_id, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (offer_id, user_id)
        DO UPDATE SET updated_at = GREATEST("SiterankAnalysis".updated_at, EXCLUDED.updated_at)
        RETURNING id, user_id, offer_id, status, result, created_at, updated_at
    `, analysis.ID, analysis.UserID, analysis.OfferID, analysis.Status, analysis.CreatedAt, analysis.UpdatedAt).Scan(
        &analysis.ID, &analysis.UserID, &analysis.OfferID, &analysis.Status, &result, &analysis.CreatedAt, &analysis.UpdatedAt,
    )
    if err != nil {
        log.Printf("Error upserting siterank analysis: %v", err)
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
    }
    if result.Valid { analysis.Result = &result.String }

    // Publish requested event (best-effort)
    if s.publisher != nil {
        _ = s.publisher.Publish(r.Context(), ev.EventSiterankRequested, map[string]any{
            "analysisId": analysis.ID,
            "offerId":    analysis.OfferID,
            "userId":     analysis.UserID,
            "requestedAt": time.Now().UTC().Format(time.RFC3339),
        }, ev.WithSource("siterank"), ev.WithSubject(analysis.OfferID))
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
    err = s.db.QueryRowContext(ctx, `SELECT o.originalurl FROM "Offer" o JOIN "SiterankAnalysis" sa ON o.id = sa.offer_id WHERE sa.id = $1`, analysisID).Scan(&originalUrl)
    if err != nil {
        // Fallback: try Offer API if configured
        log.Printf("WARN: DB join failed to get offer URL for %s: %v; trying Offer API fallback", analysisID, err)
        // read offer id and user id
        var offID, uid string
        _ = s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offID, &uid)
        if offID != "" && uid != "" {
            if base := os.Getenv("OFFER_SERVICE_URL"); base != "" {
                type offerResp struct{ OriginalUrl string `json:"originalUrl"` }
                var or offerResp
                url := strings.TrimRight(base, "/") + "/api/v1/offers/" + offID
                // clone ctx with small timeout
                cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
                defer cancel()
                // set idempotency header via ctx already; add user id header via client wrapper here
                req, _ := http.NewRequestWithContext(cctx, "GET", url, nil)
                req.Header.Set("X-User-Id", uid)
                req.Header.Set("Accept", "application/json")
                resp, herr := s.httpClient.Do(req)
                if herr == nil && resp != nil && resp.StatusCode == 200 {
                    _ = json.NewDecoder(resp.Body).Decode(&or)
                    resp.Body.Close()
                    if or.OriginalUrl != "" { originalUrl = or.OriginalUrl }
                } else if resp != nil { if resp.Body != nil { resp.Body.Close() } }
            }
        }
        if originalUrl == "" {
            s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "offer URL not found: %v"}`, err))
            return
        }
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
            _ = s.maybeWriteFirestoreUI(ctx, analysisID, payload)
            if s.publisher != nil {
                _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{
                    "analysisId":  analysisID,
                    "completedAt": time.Now().UTC().Format(time.RFC3339),
                    "cacheHit":    true,
                }, ev.WithSource("siterank"))
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
	
    // Build headers and retries for SimilarWeb
    headers := map[string]string{ "User-Agent": defaultUA() }
    if h := strings.TrimSpace(os.Getenv("SIMILARWEB_USER_AGENT")); h != "" { headers["User-Agent"] = h }
    retries := 3
    if v := strings.TrimSpace(os.Getenv("SIMILARWEB_RETRIES")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 { retries = n } }
    err = s.httpClient.GetJSONWithHeaders(ctx, apiURL, headers, retries, &apiResponse)
    if err != nil {
        log.Printf("WARN: SimilarWeb direct failed for %s: %v; trying browser-exec via proxy", analysisID, err)
        if tryBrowserJSON(ctx, s, apiURL, headers, host, analysisID) { return }
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
    _ = s.maybeWriteFirestoreUI(ctx, analysisID, result)
    // Global cache success for 7 days
    _ = s.upsertDomainCache(ctx, host, result, true, 7*24*time.Hour)
    // fill local in-memory cache (short TTL)
    s.cacheMu.Lock(); if s.cache == nil { s.cache = map[string]cacheEntry{} }; s.cache[host] = cacheEntry{val: result, exp: time.Now().Add(5 * time.Minute)}; s.cacheMu.Unlock()
    if s.publisher != nil {
        _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{
            "analysisId":  analysisID,
            "completedAt": time.Now().UTC().Format(time.RFC3339),
        }, ev.WithSource("siterank"))
    }
    log.Printf("Successfully completed analysis for %s", analysisID)
}

func (s *Server) updateAnalysisStatus(ctx context.Context, analysisID, status, result string) {
    _, err := s.db.ExecContext(ctx, `UPDATE "SiterankAnalysis" SET status = $1, result = $2, updated_at = $3 WHERE id = $4`, status, result, time.Now(), analysisID)
    if err != nil {
        log.Printf("Failed to update analysis %s to %s: %v", analysisID, status, err)
    }
}

// tryBrowserJSON calls browser-exec /json-fetch with optional proxy provider to fetch SimilarWeb JSON.
func tryBrowserJSON(ctx context.Context, s *Server, apiURL string, headers map[string]string, host, analysisID string) bool {
    beURL := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    if beURL == "" { return false }
    provider := os.Getenv("PROXY_URL_US")
    body := map[string]any{
        "url": apiURL,
        "headers": headers,
    }
    if provider != "" { body["proxyProviderURL"] = provider }
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, "POST", beURL+"/api/v1/browser/json-fetch", strings.NewReader(string(b)))
    req.Header.Set("Content-Type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return false }
    defer resp.Body.Close()
    var out struct{ Status int `json:"status"`; Json map[string]any `json:"json"`; Text string `json:"text"` }
    if err := json.NewDecoder(resp.Body).Decode(&out); err != nil { return false }
    if out.Status >= 200 && out.Status < 300 && out.Json != nil {
        // success: write completed and cache 7 days
        resultBytes, _ := json.Marshal(out.Json)
        result := string(resultBytes)
        s.updateAnalysisStatus(ctx, analysisID, "completed", result)
        _ = s.maybeWriteFirestoreUI(ctx, analysisID, result)
        _ = s.upsertDomainCache(ctx, host, result, true, 7*24*time.Hour)
        if s.publisher != nil {
            _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{"analysisId": analysisID, "completedAt": time.Now().UTC().Format(time.RFC3339), "via": "browser-exec"}, ev.WithSource("siterank"))
        }
        log.Printf("SimilarWeb fetched via browser-exec: %s", apiURL)
        return true
    }
    return false
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

func defaultUA() string {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
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
    var pub *ev.Publisher
    if p, err := ev.NewPublisher(context.Background()); err != nil {
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

// maybeWriteFirestoreUI writes the latest analysis result to Firestore as a UI cache layer.
// Controlled by FIRESTORE_ENABLED=1; best-effort and non-blocking.
func (s *Server) maybeWriteFirestoreUI(ctx context.Context, analysisID string, payload string) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    // resolve offer_id and user_id
    var offerID, userID string
    if err := s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offerID, &userID); err != nil {
        return err
    }
    if offerID == "" || userID == "" { return nil }
    ctx2, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
    defer cancel()
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    if projectID == "" { projectID = os.Getenv("PROJECT_ID") }
    if projectID == "" { return fmt.Errorf("missing GOOGLE_CLOUD_PROJECT for firestore") }
    cli, err := firestore.NewClient(ctx2, projectID)
    if err != nil { return err }
    defer cli.Close()
    // users/{uid}/siterank/{offerId}
    doc := map[string]any{"analysisId": analysisID, "updatedAt": time.Now().UTC(), "payload": payload}
    if _, err := cli.Collection(fmt.Sprintf("users/%s/siterank", userID)).Doc(offerID).Set(ctx2, doc); err != nil {
        return err
    }
    return nil
}
