package main

import (
    "bytes"
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "math"
    "net/http"
    "net/url"
    "os"
    "sort"
    "sync"
    "strings"
    "strconv"
    "time"

    "cloud.google.com/go/firestore"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
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
    // Optional fields if available from endpoint or alternate sources
    TopCountries []string `json:"top_countries,omitempty"`
    CountryShares []struct{
        Country string  `json:"country"`
        Share   float64 `json:"share"`
    } `json:"country_shares,omitempty"`
}

// ResolveOfferResult is returned by browser-exec /resolve-offer
type ResolveOfferResult struct {
    Ok             bool    `json:"ok"`
    Status         int     `json:"status"`
    FinalUrl       string  `json:"finalUrl"`
    FinalUrlSuffix string  `json:"finalUrlSuffix"`
    Domain         string  `json:"domain"`
    Brand          string  `json:"brand"`
    Via            string  `json:"via"`
    ChainLength    int     `json:"chainLength"`
    Timings        *struct {
        NavMs       int `json:"navMs"`
        StabilizeMs int `json:"stabilizeMs"`
    } `json:"timings,omitempty"`
}

type PageSignals struct {
    Status  int    `json:"status"`
    Title   string `json:"title"`
    SiteName string `json:"siteName"`
}

type AIScoreResp struct {
    Score      float64                `json:"score"`
    Confidence float64                `json:"confidence,omitempty"`
    Factors    []map[string]any       `json:"factors,omitempty"`
}

type Server struct {
    db          *sql.DB
    httpClient  *httpclient.Client
    publisher   *ev.Publisher
    cacheMu     sync.RWMutex
    cache       map[string]cacheEntry
}

type cacheEntry struct{ val string; exp time.Time }

// --- Service-level SLO metrics (H1.0: 阶段性指标) ---
var (
    metricResolveNavMs = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "siterank_resolve_nav_ms",
        Help:    "Time spent navigating to landing (ms)",
        Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000},
    })
    metricResolveStabilizeMs = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "siterank_resolve_stabilize_ms",
        Help:    "Time spent stabilizing final URL (ms)",
        Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000},
    })
    metricSwFetchMs = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "siterank_sw_fetch_ms",
        Help:    "Time spent fetching SimilarWeb metrics (ms)",
        Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000},
    })
    metricAiScoreMs = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "siterank_ai_score_ms",
        Help:    "Time spent calling AI scoring endpoint (ms)",
        Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000},
    })
)

func init() {
    // Register custom histograms with the default Prometheus registry
    // Metrics are exposed on /metrics via pkg/telemetry
    _ = prometheus.Register(metricResolveNavMs)
    _ = prometheus.Register(metricResolveStabilizeMs)
    _ = prometheus.Register(metricSwFetchMs)
    _ = prometheus.Register(metricAiScoreMs)
}

// --- HTTP Handlers ---

func (s *Server) analysesHandler(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodPost:
        s.createAnalysisHandler(w, r)
    case http.MethodGet:
        s.getAnalysisHandler(w, r)
    default:
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
    }
}

func (s *Server) createAnalysisHandler(w http.ResponseWriter, r *http.Request) {
    userID, errAuth := auth.ExtractUserID(r)
    if userID == "" {
        _ = errAuth
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
        return
    }
    // Lazy user registration: ensure User read model row and publish UserRegistered once
    if info, _ := auth.ExtractInfo(r); info.UserID != "" {
        _ = s.ensureUserRegistered(r.Context(), info.UserID, info.Email)
    } else {
        _ = s.ensureUserRegistered(r.Context(), userID, "")
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
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "analysisId missing in path", nil)
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
    err = s.db.QueryRowContext(ctx, `SELECT o."originalUrl" FROM "Offer" o JOIN "SiterankAnalysis" sa ON o.id = sa."offer_id" WHERE sa.id = $1`, analysisID).Scan(&originalUrl)
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

    host := domain.Hostname()
    country := strings.TrimSpace(os.Getenv("SITERANK_COUNTRY"))

    // New flow: resolve final landing + compute AI评分（可超过10s）。受开关控制 ANALYZE_WITH_RESOLVE=1
    if strings.TrimSpace(os.Getenv("ANALYZE_WITH_RESOLVE")) == "1" {
        s.analyzeWithResolveAndAI(ctx, analysisID, originalUrl, country)
        return
    }

    // 4. Call SimilarWeb API (configurable base URL) with hedged parallel fetch (direct + browser)
    base := os.Getenv("SIMILARWEB_BASE_URL")
    if base == "" {
        // Default to public endpoint, no API key required per environment note
        base = "https://data.similarweb.com/api/v1/data?domain=%s"
    }
    // cache lookup by host(+country) (5 min TTL)
    localKey := host + "|" + country
    s.cacheMu.RLock()
    if ce, ok := s.cache[localKey]; ok && time.Now().Before(ce.exp) {
        s.cacheMu.RUnlock()
        s.updateAnalysisStatus(ctx, analysisID, "completed", ce.val)
        log.Printf("Siterank cache hit for %s", host)
        return
    }
    s.cacheMu.RUnlock()

    apiURL := fmt.Sprintf(base, host)

    // Build headers and retries for SimilarWeb
    headers := map[string]string{"User-Agent": defaultUA()}
    if h := strings.TrimSpace(os.Getenv("SIMILARWEB_USER_AGENT")); h != "" { headers["User-Agent"] = h }
    retries := 3
    if v := strings.TrimSpace(os.Getenv("SIMILARWEB_RETRIES")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 { retries = n } }

    ctxAll, cancel := context.WithTimeout(ctx, 9500*time.Millisecond)
    defer cancel()
    type fetchRes struct{ ok bool; result string; via string; err error }
    resCh := make(chan fetchRes, 2)
    // direct fetch
    go func() {
        var apiResponse SimilarWebResponse
        err := s.httpClient.GetJSONWithHeaders(ctxAll, apiURL, headers, retries, &apiResponse)
        if err != nil { resCh <- fetchRes{ok: false, err: err, via: "direct"}; return }
        b, _ := json.Marshal(apiResponse)
        resCh <- fetchRes{ok: true, result: string(b), via: "direct"}
    }()
    // browser hedge
    beURL := strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL"))
    if beURL != "" {
        go func() {
            time.Sleep(300 * time.Millisecond)
            if j, ok := fetchBrowserJSON(ctxAll, apiURL, headers); ok { resCh <- fetchRes{ok: true, result: j, via: "browser"}; return }
            resCh <- fetchRes{ok: false, err: fmt.Errorf("browser-exec fetch failed"), via: "browser"}
        }()
    }
    first := <-resCh
    if first.ok {
        s.updateAnalysisStatus(ctx, analysisID, "completed", first.result)
        _ = s.maybeWriteFirestoreUI(ctx, analysisID, first.result)
        _ = s.projectHistory(ctx, analysisID, first.result)
        _ = s.upsertDomainCountryCache(ctx, host, country, first.result, true, 7*24*time.Hour)
        // fill local in-memory cache (short TTL) with country in key
        key := host + "|" + country
        s.cacheMu.Lock(); if s.cache == nil { s.cache = map[string]cacheEntry{} }; s.cache[key] = cacheEntry{val: first.result, exp: time.Now().Add(5 * time.Minute)}; s.cacheMu.Unlock()
        if s.publisher != nil {
            var offID, uid string
            _ = s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offID, &uid)
            _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{"analysisId": analysisID, "offerId": offID, "userId": uid, "completedAt": time.Now().UTC().Format(time.RFC3339), "via": first.via, "country": country}, ev.WithSource("siterank"))
        }
        log.Printf("Successfully completed analysis for %s via %s", analysisID, first.via)
        return
    }
    if beURL == "" {
        failPayload := fmt.Sprintf(`{"error": "SimilarWeb API failed: %v"}`, first.err)
        _ = s.upsertDomainCountryCache(ctx, host, country, failPayload, false, 24*time.Hour)
        s.updateAnalysisStatus(ctx, analysisID, "failed", failPayload)
        return
    }
    second := <-resCh
    if second.ok {
        s.updateAnalysisStatus(ctx, analysisID, "completed", second.result)
        _ = s.maybeWriteFirestoreUI(ctx, analysisID, second.result)
        _ = s.projectHistory(ctx, analysisID, second.result)
        _ = s.upsertDomainCountryCache(ctx, host, country, second.result, true, 7*24*time.Hour)
        key := host + "|" + country
        s.cacheMu.Lock(); if s.cache == nil { s.cache = map[string]cacheEntry{} }; s.cache[key] = cacheEntry{val: second.result, exp: time.Now().Add(5 * time.Minute)}; s.cacheMu.Unlock()
        if s.publisher != nil {
            var offID, uid string
            _ = s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offID, &uid)
            _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{"analysisId": analysisID, "offerId": offID, "userId": uid, "completedAt": time.Now().UTC().Format(time.RFC3339), "via": second.via, "country": country}, ev.WithSource("siterank"))
        }
        log.Printf("Successfully completed analysis for %s via %s", analysisID, second.via)
        return
    }
    // both failed
    log.Printf("Failed to get data from SimilarWeb for analysis %s: %v | %v", analysisID, first.err, second.err)
    failPayload := fmt.Sprintf(`{"error": "SimilarWeb API failed: %v; %v"}`, first.err, second.err)
    _ = s.upsertDomainCountryCache(ctx, host, country, failPayload, false, 24*time.Hour)
    s.updateAnalysisStatus(ctx, analysisID, "failed", failPayload)
    return
}

// analyze-url: ad-hoc endpoint to analyze a raw Offer URL without requiring an Offer record. For preview/smoke use.
func (s *Server) analyzeURLHandler(w http.ResponseWriter, r *http.Request) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" { userID = "smoke-user" }
    var body struct{
        URL string `json:"url"`
        OfferID string `json:"offerId"`
        Country string `json:"country"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.URL)=="" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "url required", nil); return
    }
    if strings.TrimSpace(body.OfferID)=="" { body.OfferID = "adhoc-"+uuid.New().String() }
    analysis := SiterankAnalysis{ID: uuid.New().String(), UserID: userID, OfferID: body.OfferID, Status: "running", CreatedAt: time.Now(), UpdatedAt: time.Now()}
    // create analysis row
    if _, err := s.db.ExecContext(r.Context(), `
        INSERT INTO "SiterankAnalysis"(id, user_id, offer_id, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
    `, analysis.ID, analysis.UserID, analysis.OfferID, analysis.Status, analysis.CreatedAt, analysis.UpdatedAt); err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "insert failed", map[string]string{"error": err.Error()}); return
    }
    // async analysis based on provided URL
    go s.analyzeWithResolveAndAI(context.Background(), analysis.ID, body.URL, strings.TrimSpace(body.Country))
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusAccepted)
    _ = json.NewEncoder(w).Encode(analysis)
}
// analyzeWithResolveAndAI resolves landing, fetches SimilarWeb by final domain, gets page signals, and computes a 0-100 score using AI (fallback: rule-based).
func (s *Server) analyzeWithResolveAndAI(ctx context.Context, analysisID, offerURL, country string) {
    // Resolve landing via browser-exec
    be := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    var rr ResolveOfferResult
    var resolveErr error
    if be != "" {
        ctxRes, cancel := context.WithTimeout(ctx, 65*time.Second)
        defer cancel()
        body := map[string]any{
            "url": offerURL,
            "waitUntil": "domcontentloaded",
            "timeoutMs": 60000,
            "stabilizeMs": 1200,
        }
        b, _ := json.Marshal(body)
        req, _ := http.NewRequestWithContext(ctxRes, "POST", be+"/api/v1/browser/resolve-offer", bytes.NewReader(b))
        req.Header.Set("Content-Type", "application/json")
        resp, err := http.DefaultClient.Do(req)
        if err != nil { resolveErr = err }
        if resp != nil {
            defer resp.Body.Close()
            _ = json.NewDecoder(resp.Body).Decode(&rr)
        }
    } else {
        resolveErr = fmt.Errorf("BROWSER_EXEC_URL not configured")
    }

    // Determine target domain/brand/final url
    finalDomain := ""
    brand := ""
    finalUrl := offerURL
    finalSuffix := ""
    if rr.Domain != "" { finalDomain = rr.Domain; brand = rr.Brand; if rr.FinalUrl != "" { finalUrl = rr.FinalUrl }; finalSuffix = rr.FinalUrlSuffix }
    if strings.HasPrefix(finalDomain, "www.") { finalDomain = strings.TrimPrefix(finalDomain, "www.") }
    if finalDomain == "" {
        // fallback: use offerURL host
        if u, err := url.Parse(offerURL); err == nil { finalDomain = u.Hostname(); if brand == "" { parts := strings.Split(finalDomain, "."); if len(parts)>=2 { brand = parts[len(parts)-2] } } }
    }

    // Fetch SimilarWeb metrics by finalDomain (measure duration)
    tSw := time.Now()
    sw, _ := s.fetchSimilarWebMetricsRelaxed(ctx, finalDomain, country)
    metricSwFetchMs.Observe(float64(time.Since(tSw).Milliseconds()))
    // Page signals (best-effort)
    var ps PageSignals
    if be != "" && finalUrl != "" {
        ctxPg, cancel := context.WithTimeout(ctx, 12*time.Second)
        defer cancel()
        pb, _ := json.Marshal(map[string]any{"url": finalUrl, "timeoutMs": 8000})
        req, _ := http.NewRequestWithContext(ctxPg, "POST", be+"/api/v1/browser/page-signals", bytes.NewReader(pb))
        req.Header.Set("Content-Type", "application/json")
        if resp, err := http.DefaultClient.Do(req); err == nil && resp != nil {
            defer resp.Body.Close()
            _ = json.NewDecoder(resp.Body).Decode(&ps)
        }
    }

    // Score with AI
    score := 0.0
    usedAI := false
    ai := strings.TrimSpace(os.Getenv("AI_SCORING_URL"))
    var aiResp *AIScoreResp
    if ai != "" {
        tAi := time.Now()
        if sc, out, err := s.scoreWithAI(ctx, ai, offerURL, finalUrl, finalSuffix, finalDomain, brand, country, sw, &ps); err == nil {
            score = sc; aiResp = out; usedAI = true
        }
        metricAiScoreMs.Observe(float64(time.Since(tAi).Milliseconds()))
    }
    if !usedAI {
        score = s.computeScoreManual(finalDomain, sw, &ps)
    }
    if score < 0 { score = 0 }; if score > 100 { score = 100 }

    // Observe resolve timings if present
    if rr.Timings != nil {
        if rr.Timings.NavMs > 0 { metricResolveNavMs.Observe(float64(rr.Timings.NavMs)) }
        if rr.Timings.StabilizeMs > 0 { metricResolveStabilizeMs.Observe(float64(rr.Timings.StabilizeMs)) }
    }

    // Build result payload
    payload := map[string]any{
        "offerUrl": offerURL,
        "resolve": map[string]any{
            "ok": rr.Ok,
            "status": rr.Status,
            "finalUrl": finalUrl,
            "finalUrlSuffix": finalSuffix,
            "domain": finalDomain,
            "brand": brand,
            "via": rr.Via,
            "chainLength": rr.ChainLength,
            "timings": rr.Timings,
            "error": func() string { if resolveErr!=nil { return resolveErr.Error() }; return "" }(),
        },
        "similarweb": sw,
        "pageSignals": ps,
        "score": score,
        "degraded": (sw == nil),
        "usedAI": usedAI,
        "ai": aiResp,
        "country": country,
        "createdAt": time.Now().UTC().Format(time.RFC3339),
    }
    bres, _ := json.Marshal(payload)
    result := string(bres)

    // Persist
    s.updateAnalysisStatus(ctx, analysisID, "completed", result)
    _ = s.maybeWriteFirestoreUI(ctx, analysisID, result)
    if sw == nil {
        _ = s.maybeWriteDegradedNotification(ctx, analysisID, finalDomain, finalUrl)
        _ = s.maybePublishDegradedNotification(ctx, analysisID, finalDomain, finalUrl)
    }
    _ = s.projectHistory(ctx, analysisID, result)
    if s.publisher != nil {
        // enrich event with basic fields for notifications
        var offID, uid string
        _ = s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offID, &uid)
        _ = s.publisher.Publish(ctx, ev.EventSiterankCompleted, map[string]any{
            "analysisId": analysisID,
            "offerId":    offID,
            "userId":     uid,
            "completedAt": time.Now().UTC().Format(time.RFC3339),
            "via":        "resolve+ai",
            "degraded":   sw == nil,
            "score":      score,
            "domain":     finalDomain,
            "finalUrl":   finalUrl,
        }, ev.WithSource("siterank"))
    }
}

// fetchSimilarWebMetricsRelaxed increases time budgets and adds stronger browser-exec fallback.
func (s *Server) fetchSimilarWebMetricsRelaxed(ctx context.Context, host, country string) (*SimilarWebResponse, bool) {
    if strings.TrimSpace(host) == "" { return nil, false }
    // country-aware cache first
    if payload, ok, found := s.lookupDomainCountryCache(ctx, host, country); found {
        if ok { var sw SimilarWebResponse; if json.Unmarshal([]byte(payload), &sw) == nil { return &sw, true } }
    }
    base := os.Getenv("SIMILARWEB_BASE_URL")
    if base == "" { base = "https://data.similarweb.com/api/v1/data?domain=%s" }
    apiURL := fmt.Sprintf(base, host)
    headers := map[string]string{"User-Agent": defaultUA(), "Accept": "application/json"}
    if h := strings.TrimSpace(os.Getenv("SIMILARWEB_USER_AGENT")); h != "" { headers["User-Agent"] = h }
    // Allow longer budgets: direct 10s, browser 30s, hedge delay 200ms
    ctxAll, cancel := context.WithTimeout(ctx, 35*time.Second)
    defer cancel()
    type res struct{ ok bool; via string; sw *SimilarWebResponse }
    ch := make(chan res, 2)
    // direct HTTP JSON (shorter timeout, small retries)
    go func() {
        sub, c := context.WithTimeout(ctxAll, 10*time.Second); defer c()
        var sw SimilarWebResponse
        err := s.httpClient.GetJSONWithHeaders(sub, apiURL, headers, 2, &sw)
        if err != nil { ch <- res{ok: false}; return }
        ch <- res{ok: true, via: "direct", sw: &sw}
    }()
    // browser-exec fallback with generous timeout and networkidle
    beURL := strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL"))
    if beURL != "" {
        go func() {
            time.Sleep(200 * time.Millisecond)
            // assemble body
            body := map[string]any{"url": apiURL, "headers": headers, "waitUntil": "networkidle", "timeoutMs": 30000}
            b, _ := json.Marshal(body)
            sub, c := context.WithTimeout(ctxAll, 32*time.Second); defer c()
            req, _ := http.NewRequestWithContext(sub, "POST", strings.TrimRight(beURL, "/")+"/api/v1/browser/json-fetch", bytes.NewReader(b))
            req.Header.Set("Content-Type", "application/json")
            resp, err := http.DefaultClient.Do(req)
            if err != nil || resp == nil { ch <- res{ok: false}; return }
            defer resp.Body.Close()
            var out struct{ Status int `json:"status"`; Json map[string]any `json:"json"` }
            if json.NewDecoder(resp.Body).Decode(&out) == nil && out.Status >= 200 && out.Status < 300 && out.Json != nil {
                var sw SimilarWebResponse
                if b, err := json.Marshal(out.Json); err == nil && json.Unmarshal(b, &sw) == nil {
                    ch <- res{ok: true, via: "browser", sw: &sw}; return
                }
            }
            ch <- res{ok: false}
        }()
    }
    r1 := <-ch
    if r1.ok && r1.sw != nil { return r1.sw, true }
    if beURL == "" { return nil, false }
    r2 := <-ch
    if r2.ok && r2.sw != nil { return r2.sw, true }
    return nil, false
}

func (s *Server) scoreWithAI(ctx context.Context, endpoint, offerURL, finalUrl, suffix, domain, brand, country string, sw *SimilarWebResponse, ps *PageSignals) (float64, *AIScoreResp, error) {
    ctxAi, cancel := context.WithTimeout(ctx, 8*time.Second)
    defer cancel()
    payload := map[string]any{
        "offerUrl": offerURL,
        "finalUrl": finalUrl,
        "finalUrlSuffix": suffix,
        "domain": domain,
        "brand": brand,
        "country": country,
        "similarweb": sw,
        "pageSignals": ps,
    }
    b, _ := json.Marshal(payload)
    req, _ := http.NewRequestWithContext(ctxAi, "POST", endpoint, bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return 0, nil, err }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 300 { return 0, nil, fmt.Errorf("ai status=%d", resp.StatusCode) }
    var out AIScoreResp
    if err := json.NewDecoder(resp.Body).Decode(&out); err != nil { return 0, nil, err }
    return out.Score, &out, nil
}

// computeScoreManual builds a simple KISS score (0..100) from SW metrics + page signals.
func (s *Server) computeScoreManual(domain string, sw *SimilarWebResponse, ps *PageSignals) float64 {
    total := 0.0
    if sw != nil {
        // 流量规模（40%）
        // map TotalVisits to 0..40 using log scale
        v := sw.TotalVisits
        if v < 0 { v = 0 }
        l := math.Log10(v + 1)
        total += (math.Min(l/6.0, 1.0)) * 40.0
        // 参与质量（20%） — 近似以 CategoryRank/GlobalRank 非0作为质量信号
        q := 0.0
        if sw.CategoryRank > 0 { q += 0.6 }
        if sw.GlobalRank > 0 { q += 0.4 }
        total += q * 20.0
    } else {
        // SW 不可用给保底 10 分
        total += 10.0
    }
    // 品牌/落地体验（30%）
    if ps != nil {
        if strings.TrimSpace(ps.Title) != "" { total += 10 }
        if strings.TrimSpace(ps.SiteName) != "" { total += 8 }
        if ps.Status >= 200 && ps.Status < 400 { total += 12 } else { total -= 8 }
    } else {
        total += 10 // 保底
    }
    // 基本信任（10%）：https + 域名长度
    if strings.HasSuffix(strings.ToLower(domain), ".com") { total += 3 }
    if len(domain) >= 4 && len(domain) <= 18 { total += 4 } else { total += 2 }
    total += 3 // https 近似（缺少scheme时给基准）
    if total < 0 { total = 0 }
    if total > 100 { total = 100 }
    return total
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
    if s.publisher != nil {
        _ = s.publisher.Publish(ctx, ev.EventBrowserExecRequested, map[string]any{
            "analysisId": analysisID,
            "url": apiURL,
            "host": host,
            "requestedAt": time.Now().UTC().Format(time.RFC3339),
        }, ev.WithSource("siterank"))
    }
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
            _ = s.publisher.Publish(ctx, ev.EventBrowserExecCompleted, map[string]any{"analysisId": analysisID, "completedAt": time.Now().UTC().Format(time.RFC3339), "via": "browser-exec"}, ev.WithSource("siterank"))
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

// lookupDomainCountryCache tries country-aware table first, falling back to host-only cache for compatibility.
func (s *Server) lookupDomainCountryCache(ctx context.Context, host, country string) (string, bool, bool) {
    var payload sql.NullString
    var ok sql.NullBool
    err := s.db.QueryRowContext(ctx, `SELECT payload::text, ok FROM domain_country_cache WHERE host=$1 AND country=$2 AND expires_at > NOW()`, host, country).Scan(&payload, &ok)
    if err != nil {
        if err == sql.ErrNoRows {
            return s.lookupDomainCache(ctx, host)
        }
        log.Printf("domain country cache query failed for %s/%s: %v", host, country, err)
        return "", false, false
    }
    if !payload.Valid || !ok.Valid { return "", false, false }
    return payload.String, ok.Bool, true
}

// upsertDomainCountryCache writes cache keyed by (host,country) with TTL.
func (s *Server) upsertDomainCountryCache(ctx context.Context, host, country, payload string, ok bool, ttl time.Duration) error {
    expires := time.Now().Add(ttl)
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO domain_country_cache (host, country, payload, ok, updated_at, expires_at)
        VALUES ($1, $2, $3::jsonb, $4, NOW(), $5)
        ON CONFLICT (host, country) DO UPDATE SET payload=EXCLUDED.payload, ok=EXCLUDED.ok, updated_at=NOW(), expires_at=EXCLUDED.expires_at
    `, host, country, payload, ok, expires)
    if err != nil {
        log.Printf("domain country cache upsert failed for %s/%s: %v", host, country, err)
    }
    return err
}

// fetchBrowserJSON performs a browser-exec json-fetch without side effects; returns JSON text and ok flag.
func fetchBrowserJSON(ctx context.Context, apiURL string, headers map[string]string) (string, bool) {
    beURL := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    if beURL == "" { return "", false }
    provider := os.Getenv("PROXY_URL_US")
    body := map[string]any{"url": apiURL, "headers": headers}
    if provider != "" { body["proxyProviderURL"] = provider }
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, "POST", beURL+"/api/v1/browser/json-fetch", strings.NewReader(string(b)))
    req.Header.Set("Content-Type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return "", false }
    defer resp.Body.Close()
    var out struct{ Status int `json:"status"`; Json map[string]any `json:"json"`; Text string `json:"text"` }
    if err := json.NewDecoder(resp.Body).Decode(&out); err != nil { return "", false }
    if out.Status >= 200 && out.Status < 300 && out.Json != nil {
        resultBytes, _ := json.Marshal(out.Json)
        return string(resultBytes), true
    }
    return "", false
}

// fetchSimilarWebMetrics returns SimilarWebResponse by host, using cache then hedged fetch.
func (s *Server) fetchSimilarWebMetrics(ctx context.Context, host, country string) (*SimilarWebResponse, bool) {
    // cache: country-aware first
    if payload, ok, found := s.lookupDomainCountryCache(ctx, host, country); found {
        if ok {
            var sw SimilarWebResponse
            if json.Unmarshal([]byte(payload), &sw) == nil { return &sw, true }
        }
    }
    base := os.Getenv("SIMILARWEB_BASE_URL")
    if base == "" { base = "https://data.similarweb.com/api/v1/data?domain=%s" }
    apiURL := fmt.Sprintf(base, host)
    headers := map[string]string{"User-Agent": defaultUA()}
    if h := strings.TrimSpace(os.Getenv("SIMILARWEB_USER_AGENT")); h != "" { headers["User-Agent"] = h }
    retries := 2
    if v := strings.TrimSpace(os.Getenv("SIMILARWEB_RETRIES")); v != "" { if n, e := strconv.Atoi(v); e == nil && n >= 0 { retries = n } }
    ctxAll, cancel := context.WithTimeout(ctx, 6000*time.Millisecond)
    defer cancel()
    type res struct{ ok bool; via string; sw *SimilarWebResponse }
    ch := make(chan res, 2)
    go func() {
        var sw SimilarWebResponse
        err := s.httpClient.GetJSONWithHeaders(ctxAll, apiURL, headers, retries, &sw)
        if err != nil { ch <- res{ok: false} ; return }
        ch <- res{ok: true, via: "direct", sw: &sw}
    }()
    beURL := strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL"))
    if beURL != "" {
        go func() {
            time.Sleep(200 * time.Millisecond)
            if txt, ok := fetchBrowserJSON(ctxAll, apiURL, headers); ok {
                var sw SimilarWebResponse
                if json.Unmarshal([]byte(txt), &sw) == nil { ch <- res{ok: true, via: "browser", sw: &sw}; return }
            }
            ch <- res{ok: false}
        }()
    }
    r1 := <-ch
    if r1.ok && r1.sw != nil {
        s.tryAugmentCountry(ctx, host, r1.sw)
        return r1.sw, true
    }
    if beURL == "" { return nil, false }
    r2 := <-ch
    if r2.ok && r2.sw != nil {
        s.tryAugmentCountry(ctx, host, r2.sw)
        return r2.sw, true
    }
    return nil, false
}

// tryAugmentCountry attempts to fill TopCountries/CountryShares if SIMILARWEB_GEO_URL is configured.
func (s *Server) tryAugmentCountry(ctx context.Context, host string, sw *SimilarWebResponse) {
    if sw == nil { return }
    if len(sw.TopCountries) > 0 || len(sw.CountryShares) > 0 { return }
    geoTpl := strings.TrimSpace(os.Getenv("SIMILARWEB_GEO_URL"))
    if geoTpl == "" { return }
    geoURL := fmt.Sprintf(geoTpl, host)
    headers := map[string]string{"User-Agent": defaultUA()}
    if h := strings.TrimSpace(os.Getenv("SIMILARWEB_USER_AGENT")); h != "" { headers["User-Agent"] = h }
    // Try direct first, then browser as fallback
    var body string
    var ok bool
    // small timeout for geo fetch
    ctx2, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
    defer cancel()
    var tmp map[string]any
    // direct
    if err := s.httpClient.GetJSONWithHeaders(ctx2, geoURL, headers, 1, &tmp); err == nil {
        body = mustJSON(tmp); ok = true
    } else if strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")) != "" {
        if txt, good := fetchBrowserJSON(ctx2, geoURL, headers); good { body = txt; ok = true }
    }
    if !ok || strings.TrimSpace(body) == "" { return }
    // Parse flexible shapes
    type share struct{ Country string `json:"country"`; Share float64 `json:"share"` }
    var parsed map[string]any
    if json.Unmarshal([]byte(body), &parsed) != nil { return }
    // country_shares: prefer explicit array of {country,share}
    if v, ok := parsed["country_shares"]; ok {
        if arr, ok2 := v.([]any); ok2 {
            out := make([]struct{ Country string `json:"country"`; Share float64 `json:"share"` }, 0, len(arr))
            tops := make([]string, 0, 5)
            for _, it := range arr {
                if m, ok3 := it.(map[string]any); ok3 {
                    c, _ := m["country"].(string)
                    sh, _ := m["share"].(float64)
                    if c != "" { out = append(out, struct{ Country string `json:"country"`; Share float64 `json:"share"` }{Country: strings.ToUpper(c), Share: sh}) }
                }
            }
            // build top list by share desc (best-effort)
            // simple selection up to 5 without sorting fully
            for i := 0; i < 5 && i < len(out); i++ { tops = append(tops, out[i].Country) }
            if len(out) > 0 {
                sw.CountryShares = out
                if len(sw.TopCountries) == 0 { sw.TopCountries = tops }
                return
            }
        }
    }
    // top_countries as []string
    if v, ok := parsed["top_countries"]; ok {
        if arr, ok2 := v.([]any); ok2 {
            tops := make([]string, 0, len(arr))
            for _, it := range arr { if s, ok3 := it.(string); ok3 && s != "" { tops = append(tops, strings.ToUpper(s)) } }
            if len(tops) > 0 { sw.TopCountries = tops }
        }
    }
}

func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }

// computeSimilarity calculates score (0..100) per simplified rules.
func computeSimilarity(seed, cand string, s1, s2 *SimilarWebResponse, country string) (float64, map[string]any) {
    // 1) Domain keyword match (30%)
    kwScore := func(a, b string) float64 {
        split := func(s string) []string {
            s = strings.ToLower(s)
            s = strings.TrimSuffix(s, ".com")
            s = strings.TrimSuffix(s, ".net")
            s = strings.TrimSuffix(s, ".org")
            parts := strings.FieldsFunc(s, func(r rune) bool { return r == '.' || r == '-' || r == '_' })
            return parts
        }
        A := map[string]struct{}{}
        for _, p := range split(a) { if p != "" { A[p] = struct{}{} } }
        B := map[string]struct{}{}
        for _, p := range split(b) { if p != "" { B[p] = struct{}{} } }
        inter := 0
        for k := range A { if _, ok := B[k]; ok { inter++ } }
        denom := float64(len(A) + len(B) - inter)
        if denom <= 0 { return 0 }
        return (float64(inter) / denom) * 30.0
    }(seed, cand)

    // 2) Traffic scale similarity (25%) using total_visits
    traffic := func(a, b *SimilarWebResponse) float64 {
        if a == nil || b == nil { return 0 }
        v1 := a.TotalVisits; v2 := b.TotalVisits
        if v1 <= 0 || v2 <= 0 { return 0 }
        // log-scale closeness
        l1 := math.Log10(v1 + 1); l2 := math.Log10(v2 + 1)
        diff := math.Abs(l1 - l2)
        // max diff assumed ~6 (1 to 1e6)
        score := (1.0 - math.Min(diff/6.0, 1.0)) * 25.0
        return score
    }(s1, s2)

    // 3) Country overlap (20%) — prefer overlap via SimilarWeb metrics; fallback: provided country implies full score
    countryScore, countryDetail := func(c string, a, b *SimilarWebResponse) (score float64, detail any) {
        // Build sets
        setFrom := func(sw *SimilarWebResponse) map[string]struct{} {
            m := map[string]struct{}{}
            if sw == nil { return m }
            for _, cc := range sw.TopCountries { if cc != "" { m[strings.ToUpper(cc)] = struct{}{} } }
            for _, kv := range sw.CountryShares { if kv.Country != "" { m[strings.ToUpper(kv.Country)] = struct{}{} } }
            return m
        }
        A := setFrom(a)
        B := setFrom(b)
        // If both have distributions, compute Jaccard*20
        if len(A) > 0 && len(B) > 0 {
            inter := 0
            uni := map[string]struct{}{}
            for k := range A { uni[k] = struct{}{} }
            for k := range B { uni[k] = struct{}{} }
            for k := range A { if _, ok := B[k]; ok { inter++ } }
            if len(uni) == 0 { return 0, map[string]any{"overlap": []string{}} }
            // collect overlap list (up to 5)
            ol := []string{}
            for k := range A { if _, ok := B[k]; ok { if len(ol) < 5 { ol = append(ol, k) } } }
            s := (float64(inter) / float64(len(uni))) * 20.0
            return s, map[string]any{"overlap": ol}
        }
        // Fallback: if request specifies a country, award full score (keeps previous behavior)
        if strings.TrimSpace(c) != "" { return 20.0, map[string]any{"hint": strings.ToUpper(c)} }
        return 0, nil
    }(country, s1, s2)

    // 4) Category match (25%) — simplified: both have category_rank > 0
    cat := func(a, b *SimilarWebResponse) float64 {
        if a != nil && b != nil && a.CategoryRank > 0 && b.CategoryRank > 0 { return 25.0 }
        return 0
    }(s1, s2)

    total := kwScore + traffic + countryScore + cat
    if total > 100 { total = 100 }
    // Build a short human-readable reason for UI display (fits D1.4 需求：评分详情与推荐理由)
    reasons := make([]string, 0, 4)
    if kwScore > 0 { reasons = append(reasons, "域名关键词匹配") }
    if traffic > 0 { reasons = append(reasons, "流量规模相近") }
    if cat > 0 { reasons = append(reasons, "行业分类相近") }
    if countryScore > 0 {
        if strings.TrimSpace(country) != "" { reasons = append(reasons, "目标国家一致/覆盖") } else { reasons = append(reasons, "国家分布有重叠") }
    }
    reason := strings.Join(reasons, " · ")
    if reason == "" { reason = "基础条件较弱，建议人工复核" }
    out := map[string]any{
        "keyword":  kwScore,
        "traffic":  traffic,
        "country":  countryScore,
        "category": cat,
        "reason":   reason,
    }
    if countryDetail != nil { out["countryDetail"] = countryDetail }
    return total, out
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
    // Country-aware cache table (host+country composite key)
    if err := ensureDomainCountryCacheDDL(db); err != nil {
        log.Printf("WARN: ensure domain_country_cache ddl failed: %v", err)
    }

    server := &Server{db: db, httpClient: httpClient, publisher: pub, cache: map[string]cacheEntry{}}

    // --- Router (chi) + OAS routes ---
    r := chi.NewRouter()
    telemetry.RegisterDefaultMetrics("siterank")
    r.Use(telemetry.ChiMiddleware("siterank"))
    r.Use(middleware.LoggingMiddleware("siterank"))
    r.Get("/health", healthHandler)
    r.Get("/healthz", healthHandler)
    r.Get("/readyz", server.readyHandler)
    r.Handle("/metrics", telemetry.MetricsHandler())
    // smoke endpoint for direct URL analysis (preview only)
    r.Post("/api/v1/siterank/analyze-url", server.analyzeURLHandler)

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
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
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

// GET /siterank/{offerId}/history
func (h *oasImpl) GetSiterankHistory(w http.ResponseWriter, r *http.Request, offerId string, params api.GetSiterankHistoryParams) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    days := 30
    if params.Days != nil && *params.Days > 0 { days = int(*params.Days) }
    rows, err := h.srv.db.QueryContext(r.Context(), `
        SELECT analysis_id, offer_id, user_id, score, result::text, created_at
        FROM "SiterankHistory"
        WHERE offer_id=$1 AND user_id=$2 AND created_at > NOW() - ($3 || ' days')::interval
        ORDER BY created_at DESC LIMIT 200
    `, offerId, userID, days)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    items := make([]api.HistoryItem, 0, 50)
    for rows.Next() {
        var id, off, uid, payload string
        var score int
        var created time.Time
        if err := rows.Scan(&id, &off, &uid, &score, &payload, &created); err != nil { continue }
        var res map[string]any
        _ = json.Unmarshal([]byte(payload), &res)
        items = append(items, api.HistoryItem{AnalysisId: id, OfferId: off, UserId: uid, Score: score, CreatedAt: created, Result: &res})
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []api.HistoryItem `json:"items"` }{Items: items})
}

// GET /siterank/{offerId}/trend
func (h *oasImpl) GetSiterankTrend(w http.ResponseWriter, r *http.Request, offerId string, params api.GetSiterankTrendParams) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    days := 30
    if params.Days != nil && *params.Days > 0 { days = int(*params.Days) }
    rows, err := h.srv.db.QueryContext(r.Context(), `
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS d, AVG(score)::float8 AS avg, COUNT(*) AS cnt
        FROM "SiterankHistory"
        WHERE offer_id=$1 AND user_id=$2 AND created_at > NOW() - ($3 || ' days')::interval
        GROUP BY d ORDER BY d
    `, offerId, userID, days)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    points := make([]api.TrendPoint, 0, days)
    for rows.Next() {
        var d string
        var avg float64
        var cnt int
        if err := rows.Scan(&d, &avg, &cnt); err != nil { continue }
        points = append(points, api.TrendPoint{Date: d, AvgScore: float32(avg), Count: cnt})
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Points []api.TrendPoint `json:"points"` }{Points: points})
}

// POST /siterank/similar
func (h *oasImpl) ComputeSimilarOffers(w http.ResponseWriter, r *http.Request) {
    userID, _ := auth.ExtractUserID(r)
    if userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    var body api.ComputeSimilarOffersJSONRequestBody
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid body", nil); return }
    seed := strings.TrimSpace(body.SeedDomain)
    if seed == "" || len(body.Candidates) == 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain and candidates are required", nil); return }
    country := ""
    if body.Country != nil { country = strings.TrimSpace(*body.Country) }
    // fetch seed metrics
    seedSW, _ := h.srv.fetchSimilarWebMetrics(r.Context(), seed, country)
    // compute for each candidate
    out := make([]api.SimilarityItem, 0, len(body.Candidates))
    for _, c := range body.Candidates {
        cand := strings.TrimSpace(c)
        if cand == "" || strings.EqualFold(cand, seed) { continue }
        sw, _ := h.srv.fetchSimilarWebMetrics(r.Context(), cand, country)
        score, factors := computeSimilarity(seed, cand, seedSW, sw, country)
        out = append(out, api.SimilarityItem{Domain: cand, Score: float32(score), Factors: &factors})
    }
    // sort desc by score
    sort.Slice(out, func(i, j int) bool { return out[i].Score > out[j].Score })
    if len(out) > 50 { out = out[:50] }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []api.SimilarityItem `json:"items"` }{Items: out})
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

// ensureDomainCountryCacheDDL creates domain_country_cache with composite PK (host,country).
func ensureDomainCountryCacheDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS domain_country_cache (
  host       TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT '',
  payload    JSONB NOT NULL,
  ok         BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (host, country)
);
CREATE INDEX IF NOT EXISTS ix_domain_country_cache_expires ON domain_country_cache(expires_at);
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

// maybeWriteDegradedNotification writes a warning notification to Firestore when analysis is degraded (SimilarWeb data missing).
// Best-effort; controlled by FIRESTORE_ENABLED=1.
func (s *Server) maybeWriteDegradedNotification(ctx context.Context, analysisID, domain, finalUrl string) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    var offerID, userID string
    if err := s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offerID, &userID); err != nil { return err }
    if offerID == "" || userID == "" { return nil }
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT"); if projectID == "" { projectID = os.Getenv("PROJECT_ID") }
    if projectID == "" { return fmt.Errorf("missing GOOGLE_CLOUD_PROJECT for firestore") }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, projectID)
    if err != nil { return err }
    defer cli.Close()
    doc := map[string]any{
        "type": "warning",
        "title": "SimilarWeb 数据获取失败，已降级评分",
        "data": map[string]any{"analysisId": analysisID, "offerId": offerID, "domain": domain, "finalUrl": finalUrl},
        "createdAt": time.Now().UTC(),
    }
    _, err = cli.Collection(fmt.Sprintf("users/%s/notifications", userID)).NewDoc().Set(cctx, doc)
    return err
}

// maybePublishDegradedNotification publishes a NotificationCreated event so that notifications service can store UI entries.
func (s *Server) maybePublishDegradedNotification(ctx context.Context, analysisID, domain, finalUrl string) error {
    if s.publisher == nil { return nil }
    var offerID, userID string
    if err := s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offerID, &userID); err != nil {
        return err
    }
    if offerID == "" || userID == "" { return nil }
    payload := map[string]any{
        "userId": userID,
        "type": "warning",
        "title": "SimilarWeb 数据获取失败，已降级评分",
        "data": map[string]any{"analysisId": analysisID, "offerId": offerID, "domain": domain, "finalUrl": finalUrl},
        "createdAt": time.Now().UTC().Format(time.RFC3339),
    }
    return s.publisher.Publish(ctx, ev.EventNotificationCreated, payload, ev.WithSource("siterank"), ev.WithSubject(analysisID))
}

// ensureUserRegistered creates a minimal User read model row if missing and publishes UserRegistered.
func (s *Server) ensureUserRegistered(ctx context.Context, uid, email string) error {
    if strings.TrimSpace(uid) == "" { return nil }
    if err := ensureUserDDL(s.db); err != nil { return err }
    // attempt insert with ON CONFLICT DO NOTHING
    res, err := s.db.ExecContext(ctx, `
        INSERT INTO "User"(id, email, name, role, "createdAt")
        VALUES ($1, $2, '', 'USER', NOW())
        ON CONFLICT (id) DO NOTHING
    `, uid, email)
    if err != nil { return err }
    // publish event only when actually inserted
    if s.publisher != nil {
        if rows, _ := res.RowsAffected(); rows > 0 {
            _ = s.publisher.Publish(ctx, ev.EventUserRegistered, map[string]any{
                "userId": uid,
                "email":  email,
                "time":   time.Now().UTC().Format(time.RFC3339),
            }, ev.WithSource("siterank"), ev.WithSubject(uid))
        }
    }
    return nil
}

func ensureUserDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS "User" (
  id         TEXT PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`
    _, err := db.Exec(ddl)
    return err
}

// projectHistory persists a history snapshot and UI history cache (best-effort).
func (s *Server) projectHistory(ctx context.Context, analysisID, payload string) error {
    var offerID, userID string
    if err := s.db.QueryRowContext(ctx, `SELECT offer_id, user_id FROM "SiterankAnalysis" WHERE id=$1`, analysisID).Scan(&offerID, &userID); err != nil {
        return err
    }
    score := computeScore(payload)
    if err := ensureSiterankHistoryDDL(s.db); err != nil { log.Printf("history ddl: %v", err) }
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO "SiterankHistory"(analysis_id, user_id, offer_id, score, result, created_at)
        VALUES ($1,$2,$3,$4,$5::jsonb, NOW())
        ON CONFLICT (analysis_id) DO NOTHING
    `, analysisID, userID, offerID, score, payload)
    if err != nil { log.Printf("history insert failed: %v", err) }
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) == "1" {
        pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
        if pid == "" { pid = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
        if pid != "" && userID != "" && offerID != "" {
            cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
            if cli, err := firestore.NewClient(cctx, pid); err == nil {
                doc := map[string]any{"analysisId": analysisID, "offerId": offerID, "score": score, "payload": payload, "createdAt": time.Now().UTC()}
                _, _ = cli.Collection("users/"+userID+"/siterank-history/"+offerID+"/items").Doc(analysisID).Set(cctx, doc)
                _ = cli.Close()
            }
        }
    }
    return nil
}

func computeScore(payload string) int {
    type sw struct { GlobalRank int `json:"global_rank"`; CountryRank int `json:"country_rank"`; CategoryRank int `json:"category_rank"`; TotalVisits float64 `json:"total_visits"` }
    var d sw
    if json.Unmarshal([]byte(payload), &d) != nil { return 0 }
    v := d.TotalVisits
    if v > 1_000_000 { v = 1_000_000 }
    vScore := (v / 1_000_000.0) * 40.0
    r := func(x int) float64 { if x <= 0 { return 0 }; if x > 1_000_000 { x = 1_000_000 }; return (1.0 - float64(x)/1_000_000.0) * 20.0 }
    score := int(vScore + r(d.GlobalRank) + r(d.CountryRank) + r(d.CategoryRank))
    if score < 0 { score = 0 }
    if score > 100 { score = 100 }
    return score
}

func ensureSiterankHistoryDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS "SiterankHistory" (
  analysis_id TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  offer_id    TEXT NOT NULL,
  score       INTEGER NOT NULL,
  result      JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_siterank_history_offer_user ON "SiterankHistory"(offer_id, user_id, created_at DESC);
`
    _, err := db.Exec(ddl)
    return err
}
