package main

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "database/sql"
    _ "github.com/lib/pq"
    "github.com/google/uuid"
    "cloud.google.com/go/firestore"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "strings"
    "strconv"
    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/batchopen/internal/oapi"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
    "net/url"
    "sync"
    "github.com/prometheus/client_golang/prometheus"
    "sync/atomic"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
)

type createTaskRequest struct {
    OfferID          string                 `json:"offerId"`
    SimulationConfig map[string]interface{} `json:"simulationConfig"`
}

type createTaskResponse struct {
    TaskID    string    `json:"taskId"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"createdAt"`
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

func health(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK); _, _ = w.Write([]byte("OK")) }
func ready(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK); _, _ = w.Write([]byte("ready")) }
func stats(w http.ResponseWriter, r *http.Request) {
    hit := atomic.LoadInt64(&cacheHits)
    miss := atomic.LoadInt64(&cacheMiss)
    total := hit + miss
    var hitRate int
    if total > 0 { hitRate = int((hit * 100) / total) }
    // request/error counters are Prometheus-only here; keep JSON minimal
    writeJSON(w, http.StatusOK, map[string]any{
        "inflight": atomic.LoadInt32(&inflightCur),
        "cacheHits": hit,
        "cacheMiss": miss,
        "cacheHitRate": hitRate, // percent
    })
}

func createTaskHandler(pub *ev.Publisher) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    var req createTaskRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil)
        return
    }
    if req.OfferID == "" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "offerId is required", nil)
        return
    }
    resp := createTaskResponse{
        TaskID:    uuid.New().String(),
        Status:    "queued",
        CreatedAt: time.Now(),
    }
    // Publish event (best-effort)
    if pub != nil {
        _ = pub.Publish(r.Context(), ev.EventBatchOpsTaskQueued, map[string]any{
            "taskId":   resp.TaskID,
            "offerId":  req.OfferID,
            "userId":   uid,
            "queuedAt": resp.CreatedAt.UTC().Format(time.RFC3339),
        }, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
    }
    // Firestore UI cache (best-effort)
    _ = writeTaskUI(r.Context(), uid, resp.TaskID, req.OfferID, resp.Status, resp.CreatedAt)
    writeJSON(w, http.StatusAccepted, resp)

    // Background execution via Browser-Exec (best-effort)
    go func() {
        ctx := context.Background()
        // 1) reserve tokens
        _ = billingAction(ctx, uid, "reserve", resp.TaskID)
        // 2) fetch offer url
        url := fetchOfferURL(ctx, req.OfferID, uid)
        if url == "" {
            _ = updateTaskUI(ctx, uid, resp.TaskID, map[string]any{"status": "failed", "error": "offer_url_not_found"})
            if pub != nil { _ = pub.Publish(ctx, ev.EventBatchOpsTaskFailed, map[string]any{"taskId": resp.TaskID, "userId": uid, "failedAt": time.Now().UTC().Format(time.RFC3339), "reason": "offer_url_not_found"}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID)) }
            _ = billingAction(ctx, uid, "release", resp.TaskID)
            return
        }
        // 3) call browser-exec
        // announce browser exec request
        if pub != nil {
            _ = pub.Publish(ctx, ev.EventBrowserExecRequested, map[string]any{"taskId": resp.TaskID, "userId": uid, "url": url, "requestedAt": time.Now().UTC().Format(time.RFC3339)}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
        }
        ok, beRes := browserExecCheckWithRetry(ctx, url)
        if ok {
            // compute simple quality score
            qScore, qFactors := computeQuality(beRes)
            _ = updateTaskUI(ctx, uid, resp.TaskID, map[string]any{"status": "completed", "result": beRes, "quality": map[string]any{"score": qScore, "factors": qFactors}})
            if pub != nil {
                _ = pub.Publish(ctx, ev.EventBrowserExecCompleted, map[string]any{"taskId": resp.TaskID, "userId": uid, "completedAt": time.Now().UTC().Format(time.RFC3339), "ok": true, "quality": qScore}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
                _ = pub.Publish(ctx, ev.EventBatchOpsTaskCompleted, map[string]any{"taskId": resp.TaskID, "userId": uid, "completedAt": time.Now().UTC().Format(time.RFC3339), "result": beRes, "quality": qScore}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
            }
            _ = billingAction(ctx, uid, "commit", resp.TaskID)
        } else {
            qScore, qFactors := computeQuality(beRes)
            _ = updateTaskUI(ctx, uid, resp.TaskID, map[string]any{"status": "failed", "result": beRes, "quality": map[string]any{"score": qScore, "factors": qFactors}})
            if pub != nil {
                _ = pub.Publish(ctx, ev.EventBrowserExecCompleted, map[string]any{"taskId": resp.TaskID, "userId": uid, "completedAt": time.Now().UTC().Format(time.RFC3339), "ok": false, "quality": qScore}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
                _ = pub.Publish(ctx, ev.EventBatchOpsTaskFailed, map[string]any{"taskId": resp.TaskID, "userId": uid, "failedAt": time.Now().UTC().Format(time.RFC3339), "reason": beRes["error"]}, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
            }
            _ = billingAction(ctx, uid, "release", resp.TaskID)
        }
    }()
  }
}

// taskActionHandler supports /api/v1/batchopen/tasks/{id}/start|complete|fail
func taskActionHandler(pub *ev.Publisher) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
        uid, _ := r.Context().Value(middleware.UserIDKey).(string)
        // path parsing
        p := strings.TrimPrefix(r.URL.Path, "/api/v1/batchopen/tasks/")
        seg := strings.Split(p, "/")
        if len(seg) < 2 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "taskId and action required", nil); return }
        taskID, action := strings.TrimSpace(seg[0]), strings.TrimSpace(seg[1])
        if taskID == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "taskId required", nil); return }
        now := time.Now().UTC()
        switch action {
        case "start":
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventBatchOpsTaskStarted, map[string]any{"taskId": taskID, "userId": uid, "startedAt": now.Format(time.RFC3339)}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventWorkflowStarted, map[string]any{"workflow": "batchopen", "taskId": taskID, "userId": uid, "startedAt": now.Format(time.RFC3339)}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            _ = writeTaskUI(r.Context(), uid, taskID, "", "running", now)
            _ = billingAction(r.Context(), uid, "reserve", taskID)
            writeJSON(w, http.StatusOK, map[string]any{"taskId": taskID, "status": "running"})
        case "complete":
            var body map[string]any; _ = json.NewDecoder(r.Body).Decode(&body)
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventBatchOpsTaskCompleted, map[string]any{"taskId": taskID, "userId": uid, "completedAt": now.Format(time.RFC3339), "result": body}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventWorkflowCompleted, map[string]any{"workflow": "batchopen", "taskId": taskID, "userId": uid, "completedAt": now.Format(time.RFC3339)}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            _ = writeTaskUI(r.Context(), uid, taskID, "", "completed", now)
            _ = billingAction(r.Context(), uid, "commit", taskID)
            writeJSON(w, http.StatusOK, map[string]any{"taskId": taskID, "status": "completed"})
        case "fail":
            var body struct{ Reason string `json:"reason"` }; _ = json.NewDecoder(r.Body).Decode(&body)
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventBatchOpsTaskFailed, map[string]any{"taskId": taskID, "userId": uid, "failedAt": now.Format(time.RFC3339), "reason": body.Reason}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            if pub != nil { _ = pub.Publish(r.Context(), ev.EventWorkflowStepCompleted, map[string]any{"workflow": "batchopen", "taskId": taskID, "userId": uid, "step": "fail", "time": now.Format(time.RFC3339), "status": "failed"}, ev.WithSource("batchopen"), ev.WithSubject(taskID)) }
            _ = writeTaskUI(r.Context(), uid, taskID, "", "failed", now)
            _ = billingAction(r.Context(), uid, "release", taskID)
            writeJSON(w, http.StatusOK, map[string]any{"taskId": taskID, "status": "failed"})
        default:
            errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "unknown action", map[string]string{"action": action})
        }
    }
}

func main() {
    log.Println("Starting Batchopen service...")
    ctx := context.Background()
    // unified auth via pkg/middleware.AuthMiddleware
    var pub *ev.Publisher
    if p, err := ev.NewPublisher(ctx); err == nil { pub = p; defer p.Close() }

    r := chi.NewRouter()
    telemetry.RegisterDefaultMetrics("batchopen")
    // Middlewares must be defined before routes
    r.Use(telemetry.ChiMiddleware("batchopen"))
    r.Use(middleware.LoggingMiddleware("batchopen"))
    r.Handle("/metrics", telemetry.MetricsHandler())
    r.Get("/health", health)
    r.Get("/readyz", ready)
    r.Get("/api/v1/batchopen/stats", stats)
    // OpenAPI chi server mount with auth middleware
    oas := &oasImpl{pub: pub}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/api/v1",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
        ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
            errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", err.Error(), nil)
        },
    })
    r.Mount("/", oapiHandler)

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, r); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// oasImpl implements OpenAPI server interface and delegates to existing logic
type oasImpl struct{ pub *ev.Publisher }

func (h *oasImpl) CreateBatchopenTask(w http.ResponseWriter, r *http.Request) {
    // reuse existing logic
    createTaskHandler(h.pub)(w, r)
}
func (h *oasImpl) ListBatchopenTasks(w http.ResponseWriter, r *http.Request) {
    // Minimal SQL read from BatchopenTask when DATABASE_URL is set; fallback 200 empty
    dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if dsn == "" || uid == "" {
        writeJSON(w, http.StatusOK, map[string]any{"items": []any{}})
        return
    }
    db, err := sql.Open("postgres", dsn)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "db open failed", nil); return }
    defer db.Close()
    rows, err := db.QueryContext(r.Context(), `SELECT id, "userId", "offerId", status, created_at, updated_at, COALESCE(result::text,'null') FROM "BatchopenTask" WHERE "userId"=$1 ORDER BY updated_at DESC LIMIT 50`, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil); return }
    defer rows.Close()
    type item struct{ ID, UserID, OfferID, Status, CreatedAt, UpdatedAt string; Result json.RawMessage }
    var items []item
    for rows.Next() {
        var it item
        var created, updated sql.NullTime
        var resultText string
        if err := rows.Scan(&it.ID, &it.UserID, &it.OfferID, &it.Status, &created, &updated, &resultText); err != nil { continue }
        if created.Valid { it.CreatedAt = created.Time.UTC().Format(time.RFC3339) }
        if updated.Valid { it.UpdatedAt = updated.Time.UTC().Format(time.RFC3339) }
        if resultText != "" && resultText != "null" { it.Result = json.RawMessage(resultText) }
        items = append(items, it)
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (h *oasImpl) StartBatchopenTask(w http.ResponseWriter, r *http.Request, id string) {
    // synthesize path and call handler
    r = r.Clone(r.Context())
    r.URL.Path = "/api/v1/batchopen/tasks/" + id + "/start"
    taskActionHandler(h.pub)(w, r)
}
func (h *oasImpl) CompleteBatchopenTask(w http.ResponseWriter, r *http.Request, id string) {
    r = r.Clone(r.Context())
    r.URL.Path = "/api/v1/batchopen/tasks/" + id + "/complete"
    taskActionHandler(h.pub)(w, r)
}
func (h *oasImpl) FailBatchopenTask(w http.ResponseWriter, r *http.Request, id string) {
    r = r.Clone(r.Context())
    r.URL.Path = "/api/v1/batchopen/tasks/" + id + "/fail"
    taskActionHandler(h.pub)(w, r)
}
// GET /batchopen/templates
func (h *oasImpl) ListSimulationTemplates(w http.ResponseWriter, r *http.Request) {
    // minimal built-in templates
    resp := map[string]any{
        "countries": []string{"US", "GB", "DE", "FR", "JP", "SG"},
        "userAgents": []string{
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        },
        "referrers": []string{"https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/"},
        "timezones": []string{"America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore"},
    }
    writeJSON(w, http.StatusOK, resp)
}

func writeTaskUI(ctx context.Context, userID, taskID, offerID, status string, createdAt time.Time) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    projectID := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if projectID == "" { projectID = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if projectID == "" || userID == "" || taskID == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, projectID)
    if err != nil { return err }
    defer cli.Close()
    doc := map[string]any{"taskId": taskID, "offerId": offerID, "status": status, "createdAt": createdAt.UTC()}
    _, err = cli.Collection("users/"+userID+"/batchopen/tasks").Doc(taskID).Set(cctx, doc)
    return err
}

func updateTaskUI(ctx context.Context, userID, taskID string, patch map[string]any) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    projectID := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if projectID == "" { projectID = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if projectID == "" || userID == "" || taskID == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, projectID)
    if err != nil { return err }
    defer cli.Close()
    patch["updatedAt"] = time.Now().UTC()
    _, err = cli.Collection("users/"+userID+"/batchopen/tasks").Doc(taskID).Set(cctx, patch)
    return err
}

func fetchOfferURL(ctx context.Context, offerID, userID string) string {
    base := strings.TrimRight(os.Getenv("OFFER_SERVICE_URL"), "/")
    if base == "" || offerID == "" || userID == "" { return "" }
    hdr := map[string]string{"X-User-Id": userID, "Accept": "application/json"}
    var out struct{ OriginalUrl string `json:"originalUrl"` }
    if err := httpx.New(2*time.Second).DoJSON(ctx, http.MethodGet, base+"/api/v1/offers/"+offerID, nil, hdr, 1, &out); err != nil { return "" }
    return strings.TrimSpace(out.OriginalUrl)
}

// --- Concurrency & host-level cache ---
var (
    inflightOnce  sync.Once
    inflightSem   chan struct{}
    hostCache     = map[string]hostCacheEntry{}
    hostCacheMu   sync.RWMutex
    sfMu          sync.Mutex
    sfWaiters     = map[string][]chan singleflightRes{}
    inflightCur   int32
    cacheHits     int64
    cacheMiss     int64
)
type hostCacheEntry struct{ ok bool; res map[string]any; exp time.Time }
type singleflightRes struct{ ok bool; res map[string]any }

// metrics
var (
    metricInflight = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "batchopen_inflight_current",
        Help: "Current in-flight browser-exec checks",
    })
    metricCacheHits = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "batchopen_host_cache_hits_total",
        Help: "Total host-level cache hits",
    })
    metricCacheMiss = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "batchopen_host_cache_miss_total",
        Help: "Total host-level cache misses",
    })
    metricRequests = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "batchopen_requests_total",
        Help: "Total availability requests via Browser-Exec",
    })
    metricErrors = prometheus.NewCounter(prometheus.CounterOpts{
        Name: "batchopen_errors_total",
        Help: "Total failed availability checks",
    })
)

func init() {
    _ = prometheus.Register(metricInflight)
    _ = prometheus.Register(metricCacheHits)
    _ = prometheus.Register(metricCacheMiss)
    _ = prometheus.Register(metricRequests)
    _ = prometheus.Register(metricErrors)
}

func initInflight() {
    inflightOnce.Do(func() {
        max := 8
        if v := strings.TrimSpace(os.Getenv("BATCHOPEN_MAX_INFLIGHT")); v != "" {
            if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 64 { max = n }
        }
        inflightSem = make(chan struct{}, max)
    })
}

func acquire() { initInflight(); inflightSem <- struct{}{} }
func release() { <-inflightSem }

func browserExecCheck(ctx context.Context, url string) (bool, map[string]any) {
    be := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    if be == "" || url == "" { return false, map[string]any{"error": "missing_browser_exec_or_url"} }
    // Host-level short cache to reduce duplicate checks
    host := hostOf(url)
    if host != "" {
        if ok, res, hit := lookupHostCache(host); hit {
            atomic.AddInt64(&cacheHits, 1)
            metricCacheHits.Inc()
            return ok, res
        }
        atomic.AddInt64(&cacheMiss, 1)
        metricCacheMiss.Inc()
        // Singleflight: coalesce parallel checks for same host
        if ch := joinSingleflight(host); ch != nil {
            r := <-ch
            return r.ok, r.res
        }
        // mark as leader; ensure notify on return
        defer func() { leaveSingleflight(host) }()
    }
    // Concurrency guard
    acquire()
    atomic.AddInt32(&inflightCur, 1)
    metricInflight.Inc()
    defer release()
    defer metricInflight.Dec()
    defer atomic.AddInt32(&inflightCur, -1)
    body := map[string]any{"url": url, "timeoutMs": 8000}
    hdr := map[string]string{"Content-Type": "application/json"}
    var out map[string]any
    if err := httpx.New(5*time.Second).DoJSON(ctx, http.MethodPost, be+"/api/v1/browser/check-availability", body, hdr, 1, &out); err != nil {
        return false, map[string]any{"error": err.Error()}
    }
    ok := false
    if v, ok2 := out["ok"].(bool); ok2 { ok = v }
    // if 'ok' not provided, consider http-level 2xx success path already implied by DoJSON
    // fill cache
    if host != "" {
        ttlMs := 120000
        if !ok { ttlMs = 30000 }
        if v := strings.TrimSpace(os.Getenv("BATCHOPEN_DOMAIN_CACHE_MS")); v != "" {
            if n, err := strconv.Atoi(v); err == nil && n >= 1000 && n <= 600000 { ttlMs = n }
        }
        saveHostCache(host, ok, out, time.Duration(ttlMs)*time.Millisecond)
    }
    return ok, out
}

func browserExecCheckWithRetry(ctx context.Context, url string) (bool, map[string]any) {
    maxRetries := 2
    if v := strings.TrimSpace(os.Getenv("BATCHOPEN_RETRIES")); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 0 && n <= 5 { maxRetries = n }
    }
    backoff := 300
    if v := strings.TrimSpace(os.Getenv("BATCHOPEN_BACKOFF_MS")); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 50 && n <= 5000 { backoff = n }
    }
    var last map[string]any
    for attempt := 0; ; attempt++ {
        ok, out := browserExecCheck(ctx, url)
        metricRequests.Inc()
        last = out
        if ok { return true, out }
        // decide retry by status
        status := 0
        if v, ok := out["status"].(float64); ok { status = int(v) }
        transient := status == 0 || status >= 500 || status == 429
        if !transient || attempt >= maxRetries {
            metricErrors.Inc()
            return false, out
        }
        wait := time.Duration(backoff*(1<<attempt)) * time.Millisecond
        if wait > 2*time.Second { wait = 2 * time.Second }
        select { case <-time.After(wait): case <-ctx.Done(): return false, last }
    }
}

func computeQuality(res map[string]any) (int, map[string]any) {
    status := 0
    if v, ok := res["status"].(float64); ok { status = int(v) }
    engine := ""
    if v, ok := res["engine"].(string); ok { engine = v }
    score := 0
    switch {
    case status >= 200 && status < 300:
        score = 90
    case status >= 300 && status < 400:
        score = 70
    case status >= 400 && status < 500:
        score = 30
    case status >= 500:
        score = 15
    default:
        score = 10
    }
    if engine == "playwright" { score += 5 }
    if score > 100 { score = 100 }
    if score < 0 { score = 0 }
    factors := map[string]any{"status": status, "engine": engine}
    return score, factors
}

// billingAction calls billing service reserve/commit/release for the task (best-effort, 2s timeout).
func billingAction(ctx context.Context, userID, action, taskID string) error {
    base := strings.TrimRight(os.Getenv("BILLING_URL"), "/")
    if base == "" || userID == "" || taskID == "" { return nil }
    amount := 1
    if v := strings.TrimSpace(os.Getenv("BATCHOPEN_TOKENS_PER_TASK")); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 { amount = n }
    }
    body := map[string]any{"amount": amount, "taskId": taskID}
    // For commit/release, allow idempotent txId to be taskID
    if action == "commit" || action == "release" { body["txId"] = taskID }
    cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()
    hdr := map[string]string{"Content-Type": "application/json", "X-User-Id": userID, "X-Idempotency-Key": "batchopen:"+action+":"+userID+":"+taskID}
    _ = httpx.New(2*time.Second).DoJSON(cctx, http.MethodPost, base+"/api/v1/billing/tokens/"+action, body, hdr, 1, nil)
    return nil
}

// helpers for host cache and singleflight
func hostOf(raw string) string {
    if u, err := url.Parse(raw); err == nil {
        h := strings.ToLower(u.Hostname())
        if h == "" { return "" }
        if strings.HasPrefix(h, "www.") { h = h[4:] }
        return h
    }
    return ""
}
func lookupHostCache(host string) (bool, map[string]any, bool) {
    hostCacheMu.RLock(); e, ok := hostCache[host]; hostCacheMu.RUnlock()
    if !ok || time.Now().After(e.exp) { return false, nil, false }
    return e.ok, e.res, true
}
func saveHostCache(host string, ok bool, res map[string]any, ttl time.Duration) {
    hostCacheMu.Lock(); hostCache[host] = hostCacheEntry{ok: ok, res: res, exp: time.Now().Add(ttl)}; hostCacheMu.Unlock()
}
func joinSingleflight(host string) <-chan singleflightRes {
    sfMu.Lock(); defer sfMu.Unlock()
    if chs, ok := sfWaiters[host]; ok {
        ch := make(chan singleflightRes, 1)
        sfWaiters[host] = append(chs, ch)
        return ch
    }
    // mark leader by creating empty slice
    sfWaiters[host] = []chan singleflightRes{}
    return nil
}
func leaveSingleflight(host string) {
    sfMu.Lock(); chs, ok := sfWaiters[host]; if ok { delete(sfWaiters, host) }; sfMu.Unlock()
    if !ok || len(chs) == 0 { return }
    // read from cache (which leader should have saved), otherwise send failure
    ok2, res, hit := lookupHostCache(host)
    r := singleflightRes{ok: ok2, res: res}
    if !hit { r = singleflightRes{ok: false, res: map[string]any{"error": "singleflight_miss"}} }
    for _, ch := range chs { ch <- r; close(ch) }
}
