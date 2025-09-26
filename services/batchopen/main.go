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
    r.Use(telemetry.ChiMiddleware("batchopen"))
    r.Handle("/metrics", telemetry.MetricsHandler())
    r.Use(middleware.LoggingMiddleware("batchopen"))
    r.Get("/health", health)
    r.Get("/readyz", ready)
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
    req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/v1/offers/"+offerID, nil)
    req.Header.Set("X-User-Id", userID)
    req.Header.Set("Accept", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return "" }
    defer resp.Body.Close()
    var out struct{ OriginalUrl string `json:"originalUrl"` }
    if resp.StatusCode == 200 { _ = json.NewDecoder(resp.Body).Decode(&out) }
    return strings.TrimSpace(out.OriginalUrl)
}

func browserExecCheck(ctx context.Context, url string) (bool, map[string]any) {
    be := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    if be == "" || url == "" { return false, map[string]any{"error": "missing_browser_exec_or_url"} }
    body := map[string]any{"url": url, "timeoutMs": 8000}
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, http.MethodPost, be+"/api/v1/browser/check-availability", strings.NewReader(string(b)))
    req.Header.Set("Content-Type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return false, map[string]any{"error": err.Error()} }
    defer resp.Body.Close()
    var out map[string]any
    _ = json.NewDecoder(resp.Body).Decode(&out)
    ok := false
    if v, ok2 := out["ok"].(bool); ok2 { ok = v }
    if !ok && resp.StatusCode >= 200 && resp.StatusCode < 300 {
        // if field missing, treat 2xx as ok
        ok = true
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
        last = out
        if ok { return true, out }
        // decide retry by status
        status := 0
        if v, ok := out["status"].(float64); ok { status = int(v) }
        transient := status == 0 || status >= 500 || status == 429
        if !transient || attempt >= maxRetries { return false, out }
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
    b, _ := json.Marshal(body)
    cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(cctx, http.MethodPost, base+"/api/v1/billing/tokens/"+action, strings.NewReader(string(b)))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-User-Id", userID)
    resp, err := http.DefaultClient.Do(req)
    if err == nil && resp != nil { _ = resp.Body.Close() }
    return nil
}
