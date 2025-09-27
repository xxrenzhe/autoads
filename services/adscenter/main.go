package main

import (
    "encoding/json"
    "context"
    "log"
    "net/http"
    "os"
    "time"
    "strings"
    "sort"

    // unified auth via pkg/middleware.AuthMiddleware
    adscfg "github.com/xxrenzhe/autoads/services/adscenter/internal/config"
    "github.com/xxrenzhe/autoads/services/adscenter/internal/preflight"
    exectr "github.com/xxrenzhe/autoads/services/adscenter/internal/executor"
    adsstub "github.com/xxrenzhe/autoads/services/adscenter/internal/ads"
    "github.com/xxrenzhe/autoads/services/adscenter/internal/storage"
    adsconfig "github.com/xxrenzhe/autoads/services/adscenter/internal/config"
    "database/sql"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "sync"
    "strconv"
    "hash/fnv"
    "io"
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
    tokencrypto "github.com/xxrenzhe/autoads/services/adscenter/internal/crypto"
    ratelimit "github.com/xxrenzhe/autoads/services/adscenter/internal/ratelimit"
    "cloud.google.com/go/firestore"
    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/adscenter/internal/oapi"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    apperr "github.com/xxrenzhe/autoads/pkg/errors"
    "fmt"
    neturl "net/url"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
    ev "github.com/xxrenzhe/autoads/pkg/events"
)

type PreflightRequest struct {
    AccountID    string `json:"accountId"`
    ValidateOnly bool   `json:"validateOnly"`
    LandingURL   string `json:"landingUrl"`
}

type PreflightCheck struct { // backward-compatible alias for response
    Name   string `json:"name"`
    Status string `json:"status"`
    Detail string `json:"detail,omitempty"`
}
type PreflightResponse struct { // backward-compatible
    Summary string           `json:"summary"`
    Checks  []PreflightCheck `json:"checks"`
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

// --- Global limiters for execute paths (mutate) ---
var (
    execKeyedOnce sync.Once
    execKeyedMgr *ratelimit.KeyedManager
    execGlobalOnce sync.Once
    execGlobalLimiter *ratelimit.Limiter
)

func getExecKeyedMgr(ctx context.Context) *ratelimit.KeyedManager {
    execKeyedOnce.Do(func(){
        pol := ratelimit.LoadPolicy(ctx)
        ttl := time.Duration(pol.KeyTTLSeconds) * time.Second
        if ttl <= 0 { ttl = time.Hour }
        if pol.MaxKeys <= 0 { pol.MaxKeys = 1000 }
        execKeyedMgr = ratelimit.NewKeyedManager(ttl, pol.MaxKeys)
    })
    return execKeyedMgr
}

func getExecGlobalLimiter() *ratelimit.Limiter {
    execGlobalOnce.Do(func(){
        rpm := getEnvInt("ADS_RATE_LIMIT_RPM", 60)
        conc := getEnvInt("ADS_CONCURRENCY_MAX", 4)
        l := ratelimit.NewLimiter(rpm, conc)
        l.Start()
        execGlobalLimiter = l
    })
    return execGlobalLimiter
}

func getEnvInt(k string, def int) int {
    v := strings.TrimSpace(os.Getenv(k))
    if v == "" { return def }
    if n, err := strconv.Atoi(v); err == nil { return n }
    return def
}

// accountsHandler returns the list of accessible customer resource names for the current user.
func (s *Server) accountsHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    ctx := r.Context()
    // Load platform-level Ads config (developer token + oauth client)
    cfgAds, _ := adscfg.LoadAdsCreds(ctx)
    // Fetch user-level refresh token
    tokenEnc, _, _, err := storage.GetUserRefreshToken(ctx, s.db, uid)
    if err != nil || strings.TrimSpace(tokenEnc) == "" {
        apperr.Write(w, r, http.StatusBadRequest, "MISSING_REFRESH_TOKEN", "Missing user refresh token. Connect Google Ads first.", nil); return
    }
    // Decrypt (with rotation)
    var userRT string
    if pt, ok := decryptWithRotation(tokenEnc); ok { userRT = pt } else {
        if os.Getenv("REFRESH_TOKEN_ENC_KEY_B64") != "" || os.Getenv("REFRESH_TOKEN_ENC_KEY_B64_OLD") != "" {
            apperr.Write(w, r, http.StatusInternalServerError, "DECRYPT_FAILED", "Failed to decrypt refresh token", nil); return
        }
        userRT = tokenEnc // plaintext fallback
    }
    // Build live client with user's refresh token
    live, err := adsstub.NewClient(ctx, adsstub.LiveConfig{
        DeveloperToken: cfgAds.DeveloperToken,
        OAuthClientID: cfgAds.OAuthClientID,
        OAuthClientSecret: cfgAds.OAuthClientSecret,
        RefreshToken: userRT,
        LoginCustomerID: cfgAds.LoginCustomerID, // optional for listAccessible
    })
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "ADS_CLIENT_INIT_FAILED", "Init Ads client failed", map[string]string{"error": err.Error()}); return }
    defer live.Close()
    names, err := live.ListAccessibleCustomers(ctx)
    if err != nil { apperr.Write(w, r, http.StatusBadRequest, "LIST_ACCESSIBLE_FAILED", "List accessible customers failed", map[string]string{"error": err.Error()}); return }
    type Item struct{ ResourceName string `json:"resourceName"`; ID string `json:"id"` }
    items := make([]Item, 0, len(names))
    for _, rn := range names {
        id := rn
        if i := strings.LastIndex(rn, "/"); i >= 0 { id = rn[i+1:] }
        items = append(items, Item{ResourceName: rn, ID: id})
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type Server struct {
    db *sql.DB
    pcMu sync.RWMutex
    pc   map[string]preflightCache
}
type preflightCache struct{ val PreflightResponse; exp time.Time }

func (s *Server) preflightHandler(w http.ResponseWriter, r *http.Request) {
    // Require authenticated user (Firebase)
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost {
        apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return
    }
    var req PreflightRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil); return
    }
    ctx := r.Context()
    creds, _ := adscfg.LoadAdsCreds(ctx)
    flags := adscfg.LoadPrecheckFlags()

    // validate-only: skip token requirement and live calls
    var tokenEnc string
    var loginCID string
    if !req.ValidateOnly {
        // Strong requirement: user-level refresh token must exist for live checks
        var err error
        tokenEnc, loginCID, _, err = storage.GetUserRefreshToken(ctx, s.db, uid)
        if err != nil || tokenEnc == "" {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusBadRequest)
            _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "error": "missing_user_refresh_token",
                "message": "No Google Ads refresh token found. Please connect your Google Ads account.",
            })
            return
        }
        // Decrypt with key rotation support; fallback to plaintext if key not set
        if pt, ok := decryptWithRotation(tokenEnc); ok {
            creds.RefreshToken = pt
        } else {
            // If we cannot decrypt and key(s) set, treat as error to avoid sending garbage to Google
            if os.Getenv("REFRESH_TOKEN_ENC_KEY_B64") != "" || os.Getenv("REFRESH_TOKEN_ENC_KEY_B64_OLD") != "" {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusInternalServerError)
                _ = json.NewEncoder(w).Encode(map[string]interface{}{
                    "error": "failed_to_decrypt_refresh_token",
                    "message": "Refresh token decryption failed. Please contact support or reconnect your Google Ads account.",
                })
                return
            }
            // No keys provided: assume plaintext stored
            creds.RefreshToken = tokenEnc
        }
        if creds.LoginCustomerID == "" && loginCID != "" { creds.LoginCustomerID = loginCID }
    }

    // Optional live client (stub by default)
    var client preflight.LiveClient
    // Live only if env enables AND not validateOnly
    if flags.EnableLive && !req.ValidateOnly {
        // 默认使用 stub；当启用 ads_live 构建标签时，NewClient 返回真实客户端
        baseClient := adsstub.NewClientStub()
        // 包一层速率限制与指数退避
        client = preflight.WrapWithThrottle(baseClient)
    }

    // Short cache by user + account
    cacheKey := uid + ":" + req.AccountID + ":vo=" + func() string { if req.ValidateOnly { return "1" }; return "0" }()
    s.pcMu.RLock()
    if ent, ok := s.pc[cacheKey]; ok && time.Now().Before(ent.exp) {
        s.pcMu.RUnlock()
        writeJSON(w, http.StatusOK, ent.val)
        return
    }
    s.pcMu.RUnlock()

    // Per-user/plan/action 限流参数注入（仅 LIVE 路径）
    // Key: userId:actionType[:accountId]
    if client != nil {
        plan := ratelimit.ResolveUserPlan(r.Context(), uid)
        pol := ratelimit.LoadPolicy(r.Context())
        rl := pol.For(plan, "preflight")
        key := uid + ":preflight"
        if strings.TrimSpace(req.AccountID) != "" { key += ":" + strings.TrimSpace(req.AccountID) }
        ctx = ratelimit.WithParams(ctx, ratelimit.RateParams{Key: key, RPM: rl.RPM, Concurrency: rl.Concurrency})
    }
    // Run checks with timeout guard
    ctx, cancel := context.WithTimeout(ctx, time.Duration(adscfg.LoadPrecheckFlags().TotalTimeoutMS)*time.Millisecond)
    defer cancel()
    result := preflight.Run(ctx, preflight.EnvInputs{
        DeveloperToken: creds.DeveloperToken,
        OAuthClientID: creds.OAuthClientID,
        OAuthClientSecret: creds.OAuthClientSecret,
        RefreshToken: creds.RefreshToken,
        LoginCustomerID: creds.LoginCustomerID,
        TestCustomerID: creds.TestCustomerID,
        AccountID: req.AccountID,
    }, flags.EnableLive && !req.ValidateOnly, client)

    // Shape aligned to OAS: { summary: ok|warn|error, checks: [{code,severity,message,details?}] }
    // Map internal summary (ready|degraded|blocked) -> (ok|warn|error)
    sm := result.Summary
    switch sm {
    case "ready": sm = "ok"
    case "degraded": sm = "warn"
    case "blocked": sm = "error"
    }
    outChecks := make([]map[string]any, 0, len(result.Checks))
    legacyChecks := make([]PreflightCheck, 0, len(result.Checks))
    for _, c := range result.Checks {
        item := map[string]any{
            "code": c.Code,
            "severity": string(c.Severity),
            "message": c.Message,
        }
        if c.Details != nil && len(c.Details) > 0 { item["details"] = c.Details }
        outChecks = append(outChecks, item)
        // legacy for UI cache (name/status/detail)
        st := string(c.Severity)
        if st == "skip" { st = "warn" }
        legacyChecks = append(legacyChecks, PreflightCheck{Name: c.Code, Status: st, Detail: c.Message})
    }
    // Optional landing reachability via Browser-Exec
    if strings.TrimSpace(req.LandingURL) != "" {
        if c := checkLandingReachability(r.Context(), req.LandingURL); c != nil {
            outChecks = append(outChecks, map[string]any{"code": c.Name, "severity": c.Status, "message": c.Detail})
            legacyChecks = append(legacyChecks, *c)
        }
    }
    resp := map[string]any{"summary": sm, "checks": outChecks}
    legacy := PreflightResponse{Summary: sm, Checks: legacyChecks}
    writeJSON(w, http.StatusOK, resp)
    // Best-effort Firestore UI cache (legacy shape)
    _ = writePreflightUI(r.Context(), uid, req.AccountID, legacy)
    // Fill short cache
    ttl := 2 * time.Minute
    if v := strings.TrimSpace(os.Getenv("PREFLIGHT_CACHE_TTL_MS")); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 { ttl = time.Duration(n) * time.Millisecond }
    }
    s.pcMu.Lock()
    if s.pc == nil { s.pc = map[string]preflightCache{} }
    s.pc[cacheKey] = preflightCache{val: legacy, exp: time.Now().Add(ttl)}
    s.pcMu.Unlock()
}

// diagnoseHandler provides a minimal diagnostic engine that evaluates predefined rules
// and returns structured suggestions. This endpoint is not part of OAS; it is an extra helper.
// POST /api/v1/adscenter/diagnose { accountId, landingUrl?, metrics? }
func (s *Server) diagnoseHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{
        AccountID  string                 `json:"accountId"`
        LandingURL string                 `json:"landingUrl"`
        Metrics    map[string]any         `json:"metrics"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    // Extract or default metrics
    getNum := func(k string, def float64) float64 {
        if body.Metrics == nil { return def }
        if v, ok := body.Metrics[k]; ok {
            switch t := v.(type) {
            case float64: return t
            case int: return float64(t)
            case string:
                if f, err := strconv.ParseFloat(t, 64); err == nil { return f }
            }
        }
        return def
    }
    impressions := getNum("impressions", 0)
    ctr := getNum("ctr", 0)
    _ = getNum("conversions", 0) // placeholder for future use
    qs := getNum("qualityScore", 0)
    budgetPacing := getNum("budgetPacing", 0) // ratio used/budget today
    dailyBudget := getNum("dailyBudget", 0)

    rules := []map[string]any{}
    add := func(code, sev, msg string, details map[string]any) { rules = append(rules, map[string]any{"code": code, "severity": sev, "message": msg, "details": details}) }
    suggest := []map[string]any{}
    addSug := func(kind string, params map[string]any, reason string, impact map[string]any) {
        m := map[string]any{"action": kind, "params": params, "reason": reason}
        if impact != nil && len(impact) > 0 { m["impact"] = impact }
        suggest = append(suggest, m)
    }

    // Rule: no impressions
    if impressions <= 0 {
        add("NO_IMPRESSIONS", "error", "近7天曝光为0，广告未投放或被限制", map[string]any{"impressions": impressions})
        addSug("ENABLE_CAMPAIGNS", nil, "启用被暂停的广告系列", map[string]any{"expectedImprDelta": "+100~+500"})
        addSug("FIX_TARGETING", map[string]any{"hint": "放宽地域/时段/设备定向"}, "扩大受众范围", map[string]any{"expectedImprDelta": "+10%~+30%"})
    }
    // Rule: low CTR
    if impressions > 100 && ctr < 0.5 {
        add("LOW_CTR", "warn", "点击率较低，建议优化创意与匹配类型", map[string]any{"ctr": ctr, "threshold": 0.8})
        addSug("ADJUST_MATCH_TYPE", map[string]any{"to": "phrase"}, "降低流量噪声并提升相关性", map[string]any{"expectedCtrDelta": "+0.2~+0.5"})
        addSug("ADD_AD_VARIANTS", map[string]any{"count": 2}, "增加创意版本做AB测试", map[string]any{"expectedCtrDelta": "+0.1~+0.3"})
    }
    // Rule: low quality score
    if qs > 0 && qs < 5 {
        add("LOW_QUALITY_SCORE", "warn", "质量得分偏低，建议优化落地页相关性与加载速度", map[string]any{"qualityScore": qs, "threshold": 6})
        addSug("INCREASE_CPC", map[string]any{"percent": 10}, "短期提升排名与曝光", map[string]any{"expectedImprDelta": "+5%~+15%", "risk": "CPC上涨"})
    }
    // Rule: budget issues
    if dailyBudget <= 0 {
        add("BUDGET_MISSING", "error", "未设置或预算为0", map[string]any{"dailyBudget": dailyBudget})
        addSug("ADJUST_BUDGET", map[string]any{"dailyBudget": 50}, "设置合理日预算", map[string]any{"expectedImprDelta": "+20%~+50%"})
    } else if budgetPacing >= 1.0 {
        add("BUDGET_EXHAUSTED", "warn", "预算已耗尽，建议提升预算或优化投放时段", map[string]any{"pacing": budgetPacing})
        addSug("ADJUST_BUDGET", map[string]any{"percent": 20}, "提升预算避免漏量", map[string]any{"expectedImprDelta": "+10%~+30%"})
    }
    // Rule: tracking missing (heuristic based on landing URL)
    if u := strings.TrimSpace(body.LandingURL); u != "" {
        if !strings.Contains(u, "utm_") && !strings.Contains(u, "gclid=") {
            add("TRACKING_MISSING", "warn", "缺少常见跟踪参数（utm_* 或 gclid）", map[string]any{"landingUrl": u})
            addSug("ENABLE_AUTO_TAGGING", nil, "启用自动标记以提升转化归因", map[string]any{"expectedConvDelta": "+5%~+15%"})
        }
    }
    // Rule: no conversions despite impressions and acceptable CTR
    conversions := getNum("conversions", 0)
    if impressions > 300 && ctr >= 0.8 && conversions <= 0 {
        add("NO_CONVERSIONS", "warn", "有曝光和点击但无转化，需检查落地页与转化追踪", map[string]any{"impressions": impressions, "ctr": ctr, "conversions": conversions})
        addSug("IMPROVE_LANDING", map[string]any{"hint": "提升加载速度/相关性"}, "优化落地页体验", map[string]any{"expectedConvDelta": "+5%~+20%"})
        addSug("ENABLE_CONV_TRACKING", map[string]any{"hint": "GA4/Ads 转化事件"}, "完善转化追踪", map[string]any{"expectedConvDelta": "+10%~+30%"})
    }
    // Overall severity
    summary := "ok"
    for _, r := range rules { if r["severity"] == "error" { summary = "error"; break } else if summary != "error" && r["severity"] == "warn" { summary = "warn" } }
    writeJSON(w, http.StatusOK, map[string]any{"summary": summary, "rules": rules, "suggestedActions": suggest})
}

// diagnosePlanHandler returns a BulkAction plan (validateOnly) inferred from metrics.
// POST /api/v1/adscenter/diagnose/plan { accountId, landingUrl?, metrics }
func (s *Server) diagnosePlanHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{
        Metrics map[string]any `json:"metrics"`
        Suggested []api.SuggestedAction `json:"suggestedActions"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    // Prefer suggestions if provided, otherwise derive from metrics
    var plan struct{
        ValidateOnly bool `json:"validateOnly"`
        Actions []map[string]any `json:"actions"`
    }
    if len(body.Suggested) > 0 {
        plan.ValidateOnly = true
        for _, sgg := range body.Suggested {
            t := strings.ToUpper(strings.TrimSpace(sgg.Action))
            p := map[string]any{}
            if sgg.Params != nil { for k, v := range *sgg.Params { p[k] = v } }
            switch t {
            case "INCREASE_CPC":
                if _, ok := p["percent"]; !ok { p["percent"] = 10 }
                plan.Actions = append(plan.Actions, map[string]any{"type": "ADJUST_CPC", "params": p})
            case "ADJUST_BUDGET":
                plan.Actions = append(plan.Actions, map[string]any{"type": "ADJUST_BUDGET", "params": p})
            case "ROTATE_LINK":
                // accept either targetDomain string or links[] array
                if _, ok := p["targetDomain"]; ok {
                    plan.Actions = append(plan.Actions, map[string]any{"type": "ROTATE_LINK", "params": p})
                } else if v, ok := p["links"].([]any); ok && len(v) > 0 {
                    plan.Actions = append(plan.Actions, map[string]any{"type": "ROTATE_LINK", "params": p})
                }
            // other suggestion kinds currently not mapped to supported plan actions
            default:
                // ignore unsupported suggestion types to keep plan valid
            }
        }
        if len(plan.Actions) == 0 {
            // fallback to metrics if nothing mapped
            mplan := buildPlanFromMetrics(body.Metrics)
            // mplan is struct{ValidateOnly bool; Actions []map[string]any}
            plan.ValidateOnly = mplan.ValidateOnly
            plan.Actions = mplan.Actions
        }
    } else {
        mplan := buildPlanFromMetrics(body.Metrics)
        plan.ValidateOnly = mplan.ValidateOnly
        plan.Actions = mplan.Actions
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"plan": plan, "validateOnly": true})
}

// diagnoseExecuteHandler generates a plan from metrics and enqueues it as a bulk operation.
// POST /api/v1/adscenter/diagnose/execute { metrics }
func (s *Server) diagnoseExecuteHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{ Metrics map[string]any `json:"metrics"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    plan := buildPlanFromMetrics(body.Metrics)
    // Enqueue similar to submit handler (minimal)
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // Enforce per-plan daily quota before creating an operation
    planName := ratelimit.ResolveUserPlan(r.Context(), uid)
    pol := ratelimit.LoadPolicy(r.Context())
    if daily := pol.QuotaDailyFor(planName); daily > 0 {
        usage := 0
        _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, uid).Scan(&usage)
        if usage >= daily {
            apperr.Write(w, r, http.StatusTooManyRequests, "QUOTA_EXCEEDED", "daily quota exceeded", map[string]string{"plan": planName})
            return
        }
    }
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());`)
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionAudit"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`)
    planBytes, _ := json.Marshal(plan)
    opID := strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
    _, _ = db.Exec(`INSERT INTO "BulkActionOperation"(id, user_id, plan, status) VALUES ($1,$2,$3,'queued')`, opID, uid, string(planBytes))
    _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'before',$3::jsonb)`, opID, uid, string(planBytes))
    // shard planning
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionShard"(
        id BIGSERIAL PRIMARY KEY,
        op_id TEXT NOT NULL,
        seq INT NOT NULL,
        actions JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    if len(plan.Actions) > 0 {
        batchSize := 20
        if v := strings.TrimSpace(os.Getenv("ADS_MUTATE_BATCH_SIZE")); v != "" {
            if n, err := strconv.Atoi(v); err == nil && n > 0 { batchSize = n }
        }
        total := len(plan.Actions)
        if total > batchSize {
            shards := 0
            for i := 0; i < total; i += batchSize {
                j := i + batchSize
                if j > total { j = total }
                part := plan.Actions[i:j]
                pb, _ := json.Marshal(map[string]any{"actions": part})
                _, _ = db.Exec(`INSERT INTO "BulkActionShard"(op_id, seq, actions, status) VALUES ($1,$2,$3,'queued')`, opID, shards, string(pb))
                shards++
            }
            sp := map[string]any{"kind": "shard_plan", "batchSize": batchSize, "shards": shards, "totalActions": total}
            sb, _ := json.Marshal(sp)
            _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'other',$3::jsonb)`, opID, uid, string(sb))
        }
    }
    // async update to running->completed with shard simulation
    go func(opId, user string) {
        time.Sleep(300 * time.Millisecond)
        _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='running', updated_at=NOW() WHERE id=$1`, opId)
        rows, err := db.Query(`SELECT id, seq FROM "BulkActionShard" WHERE op_id=$1 ORDER BY seq ASC`, opId)
        if err == nil {
            for rows.Next() {
                var shardID int64; var seq int
                if err := rows.Scan(&shardID, &seq); err == nil {
                    _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1`, shardID)
                    time.Sleep(200 * time.Millisecond)
                    _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, shardID)
                }
            }
            rows.Close()
        }
        // simulate after snapshot
        snap := map[string]any{"executed": len(plan.Actions)}
        b, _ := json.Marshal(snap)
        _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, opId, user, string(b))
        _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, opId)
    }(opID, uid)
    writeJSON(w, http.StatusAccepted, map[string]any{"operationId": opID, "status": "queued"})
}

// buildPlanFromMetrics produces a plan using only allowed action types to pass validation (ADJUST_BUDGET, ADJUST_CPC).
func buildPlanFromMetrics(metrics map[string]any) (out struct{ Actions []map[string]any `json:"actions"`; ValidateOnly bool `json:"validateOnly"` }) {
    getNum := func(k string, def float64) float64 {
        if metrics == nil { return def }
        if v, ok := metrics[k]; ok {
            switch t := v.(type) {
            case float64: return t
            case int: return float64(t)
            case string:
                if f, err := strconv.ParseFloat(t, 64); err == nil { return f }
            }
        }
        return def
    }
    impressions := getNum("impressions", 0)
    ctr := getNum("ctr", 0)
    qs := getNum("qualityScore", 0)
    pacing := getNum("budgetPacing", 0)
    dailyBudget := getNum("dailyBudget", 0)
    out.ValidateOnly = false
    add := func(typ string, params map[string]any) { out.Actions = append(out.Actions, map[string]any{"type": typ, "params": params}) }
    if dailyBudget <= 0 {
        add("ADJUST_BUDGET", map[string]any{"dailyBudget": 50})
    } else if pacing >= 1.0 {
        add("ADJUST_BUDGET", map[string]any{"percent": 20})
    }
    if impressions > 100 && ctr < 0.5 { add("ADJUST_CPC", map[string]any{"percent": 10}) }
    if qs > 0 && qs < 5 { add("ADJUST_CPC", map[string]any{"percent": 10}) }
    return
}

// diagnoseMetricsHandler: provide metrics autofill (stub or live in future).
// GET /api/v1/adscenter/diagnose/metrics?accountId=xxx
func (s *Server) diagnoseMetricsHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // Live mode gated behind ADS_DIAG_LIVE (not implemented yet)
    live := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_DIAG_LIVE")), "true")
    accountID := strings.TrimSpace(r.URL.Query().Get("accountId"))
    if accountID == "" { accountID = uid }
    if live {
        // per-user plan limiter（action=diagnose）
        plan := ratelimit.ResolveUserPlan(r.Context(), uid)
        pol := ratelimit.LoadPolicy(r.Context())
        rl := pol.For(plan, "diagnose")
        km := getExecKeyedMgr(r.Context())
        if km != nil {
            if rel, err := km.Get(uid+":diagnose", rl.RPM, rl.Concurrency).Acquire(r.Context()); err == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        }
        if relG, err := getExecGlobalLimiter().Acquire(r.Context()); err == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        // Attempt Live client; fallback to stub if build tag not enabled or errors occur.
        cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
        // Try user-level refresh token for better permissions
        tokenEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), s.db, uid)
        rt := tokenEnc
        if pt, ok := decryptWithRotation(tokenEnc); ok { rt = pt }
        if rt == "" { rt = cfgAds.RefreshToken }
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken:   cfgAds.DeveloperToken,
            OAuthClientID:    cfgAds.OAuthClientID,
            OAuthClientSecret: cfgAds.OAuthClientSecret,
            RefreshToken:     rt,
            LoginCustomerID:  func() string { if cfgAds.LoginCustomerID != "" { return cfgAds.LoginCustomerID }; return loginCID }(),
        })
        if err == nil && client != nil {
            // campaigns -> derive simple metrics
            n, err2 := client.GetCampaignsCount(r.Context(), accountID)
            if err2 == nil {
                impressions := n*200 + 300 // heuristic
                ctr := 1.2
                if n > 10 { ctr = 0.8 }
                if n > 50 { ctr = 0.5 }
                qs := 6
                if n < 5 { qs = 7 } else if n > 30 { qs = 5 }
                budget := 50 + n
                pacing := 0.3
                writeJSON(w, http.StatusOK, map[string]any{
                    "impressions": impressions,
                    "ctr": ctr,
                    "qualityScore": qs,
                    "dailyBudget": budget,
                    "budgetPacing": pacing,
                })
                return
            }
        }
        // Fall through to stub if live failed
    }
    // Stub/pseudo: deterministic metrics for consistent UX
    h := fnvHash(accountID)
    impressions := (h%2000 + 100)
    ctr := float64((h%100)+1) / 10.0
    qs := (h%10 + 1)
    budget := (h%200 + 20)
    pacing := float64((h%90)+1) / 100.0
    writeJSON(w, http.StatusOK, map[string]any{
        "impressions": impressions,
        "ctr": ctr,
        "qualityScore": qs,
        "dailyBudget": budget,
        "budgetPacing": pacing,
    })
}

// checkLandingReachability calls browser-exec /check-availability to verify landing URL.
func checkLandingReachability(ctx context.Context, url string) *PreflightCheck {
    be := strings.TrimRight(os.Getenv("BROWSER_EXEC_URL"), "/")
    if be == "" { return &PreflightCheck{Name:"landing.reachability", Status:"warn", Detail:"browser-exec not configured"} }
    type reqT struct{ URL string `json:"url"`; Timeout int `json:"timeoutMs"` }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
    defer cancel()
    hdr := map[string]string{"Content-Type": "application/json"}
    if tok := strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")); tok != "" { hdr["Authorization"] = "Bearer "+tok }
    var out struct{ Ok bool `json:"ok"`; Status int `json:"status"` }
    _ = httpx.New(1500*time.Millisecond).DoJSON(cctx, http.MethodPost, be+"/api/v1/browser/check-availability", reqT{URL:url, Timeout: 1200}, hdr, 1, &out)
    if out.Ok || (out.Status >= 200 && out.Status < 400) {
        return &PreflightCheck{Name:"landing.reachability", Status:"ok", Detail:"reachable"}
    }
    return &PreflightCheck{Name:"landing.reachability", Status:"warn", Detail:"unreachable or non-2xx"}
}

// --- OAuth URL & Callback ---

func (s *Server) oauthURLHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    cfg, _ := adscfg.LoadAdsCreds(r.Context())
    redirect := chooseRedirectURL(r)
    if redirect == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADS_OAUTH_REDIRECT_URL(S) not set", nil); return }
    oc := &oauth2.Config{
        ClientID: cfg.OAuthClientID,
        ClientSecret: cfg.OAuthClientSecret,
        Endpoint: google.Endpoint,
        Scopes: []string{"https://www.googleapis.com/auth/adwords"},
        RedirectURL: redirect,
    }
    state := signState(uid)
    url := oc.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
    _ = json.NewEncoder(w).Encode(map[string]string{"authUrl": url})
}

func (s *Server) oauthCallbackHandler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    code := r.URL.Query().Get("code")
    state := r.URL.Query().Get("state")
    if code == "" || state == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid callback params", nil); return }
    uid, ok := verifyState(state)
    if !ok || uid == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_STATE", "Invalid state param", nil); return }

    creds, _ := adscfg.LoadAdsCreds(ctx)
    redirect := chooseRedirectURL(r)
    if redirect == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADS_OAUTH_REDIRECT_URL(S) not set", nil); return }
    oc := &oauth2.Config{
        ClientID: creds.OAuthClientID,
        ClientSecret: creds.OAuthClientSecret,
        Endpoint: google.Endpoint,
        Scopes: []string{"https://www.googleapis.com/auth/adwords"},
        RedirectURL: redirect,
    }
    tok, err := oc.Exchange(ctx, code)
    if err != nil { apperr.Write(w, r, http.StatusBadRequest, "OAUTH_EXCHANGE_FAILED", "Exchange code failed", map[string]string{"error": err.Error()}); return }
    if tok.RefreshToken == "" { apperr.Write(w, r, http.StatusBadRequest, "NO_REFRESH_TOKEN", "No refresh token returned", nil); return }

    // Encrypt and store
    keyB64 := strings.TrimSpace(os.Getenv("REFRESH_TOKEN_ENC_KEY_B64"))
    key, _ := base64.StdEncoding.DecodeString(keyB64)
    enc := tok.RefreshToken
    if len(key) == 32 {
        if c, err := tokencrypto.Encrypt(key, tok.RefreshToken); err == nil { enc = c }
    }
    loginCID := strings.TrimSpace(r.URL.Query().Get("login_customer_id"))
    _ = storage.UpsertUserRefreshToken(ctx, s.db, uid, loginCID, "", enc)
    _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func signState(uid string) string {
    secret := []byte(strings.TrimSpace(os.Getenv("OAUTH_STATE_SECRET")))
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(uid))
    sig := mac.Sum(nil)
    return base64.URLEncoding.EncodeToString([]byte(uid+"."+base64.RawURLEncoding.EncodeToString(sig)))
}
func verifyState(state string) (string, bool) {
    b, err := base64.URLEncoding.DecodeString(state)
    if err != nil { return "", false }
    parts := strings.Split(string(b), ".")
    if len(parts) != 2 { return "", false }
    uid := parts[0]
    sigRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
    if err != nil { return "", false }
    secret := []byte(strings.TrimSpace(os.Getenv("OAUTH_STATE_SECRET")))
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(uid))
    if !hmac.Equal(mac.Sum(nil), sigRaw) { return "", false }
    return uid, true
}

// chooseRedirectURL selects a proper redirect URL based on request host and configured envs.
// Priority: ADS_OAUTH_REDIRECT_URL (single) > ADS_OAUTH_REDIRECT_URLS (multi, comma or newline separated; match by host; fallback first).
func chooseRedirectURL(r *http.Request) string {
    if v := strings.TrimSpace(os.Getenv("ADS_OAUTH_REDIRECT_URL")); v != "" { return v }
    urlsEnv := strings.TrimSpace(os.Getenv("ADS_OAUTH_REDIRECT_URLS"))
    if urlsEnv == "" { return "" }
    // split by comma/newline
    var list []string
    for _, part := range strings.FieldsFunc(urlsEnv, func(r rune) bool { return r == ',' || r == '\n' || r == '\r' }) {
        s := strings.TrimSpace(part)
        if s != "" { list = append(list, s) }
    }
    if len(list) == 0 { return "" }
    reqHost := r.Header.Get("X-Forwarded-Host")
    if reqHost == "" { reqHost = r.Host }
    // strict host match using url.Parse
    normalize := func(h string) string {
        if strings.HasPrefix(h, "www.") { return h[4:] }
        return h
    }
    reqHost = normalize(reqHost)
    for _, u := range list {
        if pu, err := neturl.Parse(u); err == nil {
            if normalize(pu.Host) == reqHost { return u }
        }
    }
    // fallback: substring contains
    for _, u := range list {
        if strings.Contains(u, reqHost) { return u }
    }
    return list[0]
}

// decryptWithRotation tries REFRESH_TOKEN_ENC_KEY_B64, then REFRESH_TOKEN_ENC_KEY_B64_OLD.
// Returns (plaintext, true) on success; ("", false) on failure.
func decryptWithRotation(ciphertext string) (string, bool) {
    // If ciphertext is obviously plaintext (no base64 or too short), we can attempt returning as is when no keys provided.
    // But to be safe, we only decrypt when keys are configured; otherwise caller treats as plaintext.
    tryKey := func(envKey string) (string, bool) {
        kB64 := strings.TrimSpace(os.Getenv(envKey))
        if kB64 == "" { return "", false }
        key, err := base64.StdEncoding.DecodeString(kB64)
        if err != nil || len(key) != 32 { return "", false }
        pt, err := tokencrypto.Decrypt(key, ciphertext)
        if err != nil { return "", false }
        return pt, true
    }
    if pt, ok := tryKey("REFRESH_TOKEN_ENC_KEY_B64"); ok { return pt, true }
    if pt, ok := tryKey("REFRESH_TOKEN_ENC_KEY_B64_OLD"); ok { return pt, true }
    return "", false
}

func writePreflightUI(ctx context.Context, userID, accountID string, payload PreflightResponse) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if pid == "" { pid = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if pid == "" || userID == "" || accountID == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, pid)
    if err != nil { return err }
    defer cli.Close()
    doc := map[string]any{"accountId": accountID, "updatedAt": time.Now().UTC(), "summary": payload.Summary, "checks": payload.Checks}
    _, err = cli.Collection("users/"+userID+"/adscenter/preflight").Doc(accountID).Set(cctx, doc)
    return err
}

// --- MCC Binding Stubs ---
func (s *Server) mccLinkHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    var req struct{ CustomerID string `json:"customerId"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if strings.TrimSpace(req.CustomerID) == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "customerId required", nil); return }
    // Idempotency (minimal) before actual action
    if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
        if idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idem != "" {
            if db, err := sql.Open("postgres", dbURL); err == nil {
                defer db.Close()
                scope := "adscenter.mcc.link"
                var target string
                _ = db.QueryRow(`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, idem, uid, scope).Scan(&target)
                if target != "" {
                    writeJSON(w, http.StatusAccepted, map[string]any{"status": "queued", "message": "idempotent", "userId": uid, "customerId": req.CustomerID})
                    return
                }
                _, _ = db.Exec(`INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at) VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval) ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at`, idem, uid, scope, req.CustomerID, "24 hours")
            }
        }
    }
    // Ensure MccLink table exists
    if db := s.db; db != nil {
        _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "MccLink"(user_id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, customer_id))`)
    }
    if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_ENABLE_LIVE")), "true") {
        // per-user plan limiter（action=mcc）
        plan := ratelimit.ResolveUserPlan(r.Context(), uid)
        pol := ratelimit.LoadPolicy(r.Context())
        rl := pol.For(plan, "mcc")
        km := getExecKeyedMgr(r.Context())
        if km != nil {
            if rel, err := km.Get(uid+":mcc", rl.RPM, rl.Concurrency).Acquire(r.Context()); err == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        }
        if relG, err := getExecGlobalLimiter().Acquire(r.Context()); err == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        cfg, _ := adscfg.LoadAdsCreds(r.Context())
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken: cfg.DeveloperToken,
            OAuthClientID: cfg.OAuthClientID,
            OAuthClientSecret: cfg.OAuthClientSecret,
            RefreshToken: cfg.RefreshToken, // platform-level
            LoginCustomerID: cfg.LoginCustomerID,
        })
        if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "ADS_CLIENT_INIT_FAILED", "init manager client failed", map[string]string{"error": err.Error()}); return }
        if err := client.SendManagerLinkInvitation(r.Context(), req.CustomerID); err != nil { apperr.Write(w, r, http.StatusBadRequest, "MCC_INVITE_FAILED", "send invitation failed", map[string]string{"error": err.Error()}); return }
        // persist: status pending
        if s.db != nil { _, _ = s.db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status, updated_at) VALUES ($1,$2,'pending',NOW()) ON CONFLICT (user_id, customer_id) DO UPDATE SET status='pending', updated_at=NOW()`, uid, req.CustomerID) }
        _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "message": "invitation sent", "userId": uid, "customerId": req.CustomerID})
        return
    }
    if s.db != nil { _, _ = s.db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status, updated_at) VALUES ($1,$2,'pending',NOW()) ON CONFLICT (user_id, customer_id) DO UPDATE SET status='pending', updated_at=NOW()`, uid, req.CustomerID) }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "queued", "message": "stub: invitation requested", "userId": uid, "customerId": req.CustomerID})
}
func (s *Server) mccStatusHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    customerID := r.URL.Query().Get("customerId")
    if strings.TrimSpace(customerID) == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "customerId required", nil); return }
    if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_ENABLE_LIVE")), "true") {
        // per-user plan limiter（action=mcc）
        plan := ratelimit.ResolveUserPlan(r.Context(), uid)
        pol := ratelimit.LoadPolicy(r.Context())
        rl := pol.For(plan, "mcc")
        km := getExecKeyedMgr(r.Context())
        if km != nil {
            if rel, err := km.Get(uid+":mcc", rl.RPM, rl.Concurrency).Acquire(r.Context()); err == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        }
        if relG, err := getExecGlobalLimiter().Acquire(r.Context()); err == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        cfg, _ := adscfg.LoadAdsCreds(r.Context())
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken: cfg.DeveloperToken,
            OAuthClientID: cfg.OAuthClientID,
            OAuthClientSecret: cfg.OAuthClientSecret,
            RefreshToken: cfg.RefreshToken, // platform-level
            LoginCustomerID: cfg.LoginCustomerID,
        })
        if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "ADS_CLIENT_INIT_FAILED", "Init Ads client failed", map[string]string{"error": err.Error()}); return }
        sVal, err := client.GetManagerLinkStatus(r.Context(), customerID)
        if err != nil { apperr.Write(w, r, http.StatusBadRequest, "MCC_STATUS_FAILED", "Fetch manager link status failed", map[string]string{"error": err.Error()}); return }
        // normalize and persist
        norm := strings.ToLower(strings.TrimSpace(sVal))
        if norm == "approved" || norm == "active" { norm = "active" } else if norm == "pending" || norm == "invited" { norm = "pending" }
        if s.db != nil { _, _ = s.db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status, updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (user_id, customer_id) DO UPDATE SET status=$3, updated_at=NOW()`, uid, customerID, norm) }
        _ = json.NewEncoder(w).Encode(map[string]any{"customerId": customerID, "status": norm, "userId": uid})
        return
    }
    // stub: return DB status if exists, else pending
    if s.db != nil {
        var st sql.NullString
        _ = s.db.QueryRow(`SELECT status FROM "MccLink" WHERE user_id=$1 AND customer_id=$2`, uid, customerID).Scan(&st)
        if st.Valid { _ = json.NewEncoder(w).Encode(map[string]any{"customerId": customerID, "status": st.String, "userId": uid}); return }
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"customerId": customerID, "status": "pending", "message": "stub", "userId": uid})
}
func (s *Server) mccUnlinkHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    var req struct{ CustomerID string `json:"customerId"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if strings.TrimSpace(req.CustomerID) == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "customerId required", nil); return }
    // Idempotency (minimal) before action
    if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
        if idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idem != "" {
            if db, err := sql.Open("postgres", dbURL); err == nil {
                defer db.Close()
                scope := "adscenter.mcc.unlink"
                var target string
                _ = db.QueryRow(`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, idem, uid, scope).Scan(&target)
                if target != "" {
                    writeJSON(w, http.StatusAccepted, map[string]any{"status": "queued", "message": "idempotent", "userId": uid, "customerId": req.CustomerID})
                    return
                }
                _, _ = db.Exec(`INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at) VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval) ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at`, idem, uid, scope, req.CustomerID, "24 hours")
            }
        }
    }
    if s.db != nil { _, _ = s.db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status, updated_at) VALUES ($1,$2,'inactive',NOW()) ON CONFLICT (user_id, customer_id) DO UPDATE SET status='inactive', updated_at=NOW()`, uid, req.CustomerID) }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "queued", "message": "stub: unlink requested", "userId": uid, "customerId": req.CustomerID})
}

// --- Keyword Expansion (rule-based, no Ads API) ---
// POST /api/v1/adscenter/keywords/expand
// body: { seedDomain?: string, seedKeywords?: [string], country?: string, limit?: number, minScore?: number, validateOnly?: bool }
// resp: { items: [{ keyword, score, reason }] }
func (s *Server) keywordsExpandHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var req struct{
        SeedDomain    string   `json:"seedDomain"`
        SeedKeywords  []string `json:"seedKeywords"`
        Country       string   `json:"country"`
        Limit         int      `json:"limit"`
        MinScore      float64  `json:"minScore"`
        ValidateOnly  bool     `json:"validateOnly"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    lim := req.Limit
    if lim <= 0 { if v := strings.TrimSpace(os.Getenv("KEYWORD_EXPAND_LIMIT_DEFAULT")); v != "" { if n, e := strconv.Atoi(v); e==nil && n>0 { lim = n } }; if lim <= 0 { lim = 20 } }
    minScore := req.MinScore
    if minScore <= 0 { if v := strings.TrimSpace(os.Getenv("KEYWORD_EXPAND_MIN_SCORE")); v != "" { if f, e := strconv.ParseFloat(v, 64); e==nil && f>0 { minScore = f } } }

    // Seed terms from domain + provided keywords
    tokens := tokenizeDomain(req.SeedDomain)
    seeds := map[string]struct{}{}
    for _, t := range tokens { if t != "" { seeds[t] = struct{}{} } }
    for _, k := range req.SeedKeywords {
        for _, t := range tokenizeKeyword(k) { if t != "" { seeds[t] = struct{}{} } }
    }
    if len(seeds) == 0 { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain or seedKeywords required", nil); return }

    // Generate candidates by simple rule library (multi-lingual)
    brand := brandFromTokens(tokens)
    suffixes := []string{"review","reviews","price","discount","coupon","promo","deal","buy","official","free shipping","how to","tutorial","guide","vs"}
    suffixesCN := []string{"测评","评测","价格","优惠","优惠券","折扣","官网","购买","教程","指南","对比"}
    baseSeeds := keys(seeds)

    cand := make(map[string]float64)
    reason := make(map[string][]string)
    add := func(k string, score float64, why string) { kk := strings.ToLower(strings.TrimSpace(k)); if kk=="" { return }; if cur, ok := cand[kk]; !ok || score>cur { cand[kk] = score; reason[kk] = appendUnique(reason[kk], why) } }

    // 1) brand + suffix
    if brand != "" {
        for _, sfx := range suffixes { add(brand+" "+sfx, 70, "brand+suffix") }
        for _, sfx := range suffixesCN { add(brand+" "+sfx, 72, "brand+suffix.cn") }
    }
    // 2) combine seed tokens pairwise
    for i := 0; i < len(baseSeeds); i++ {
        for j := i+1; j < len(baseSeeds); j++ {
            add(baseSeeds[i]+" "+baseSeeds[j], 55, "seeds-pair")
            add(baseSeeds[j]+" "+baseSeeds[i], 52, "seeds-pair")
        }
    }
    // 3) synonyms/aliases for common commerce intent
    synonyms := map[string][]string{
        "discount": {"coupon","promo","deal","sale"},
        "购买": {"买","下单"},
        "优惠": {"折扣","优惠券"},
        "官网": {"官方网站"},
    }
    for _, k := range baseSeeds {
        if alts, ok := synonyms[k]; ok {
            for _, alt := range alts { add(alt, 40, "synonym") }
        }
    }
    // 4) domain token expansions (token + suffix)
    for _, t := range tokens {
        for _, sfx := range suffixes { add(t+" "+sfx, 45, "token+suffix") }
        for _, sfx := range suffixesCN { add(t+" "+sfx, 47, "token+suffix.cn") }
    }

    // 5) re-score candidates based on overlap with seeds and simple heuristics
    scored := make([]struct{ K string; S float64 }, 0, len(cand))
    for k, base := range cand {
        overlap := jaccard(tokens, tokenizeKeyword(k))
        s := base + 30*overlap
        if req.Country != "" { s += 3 } // slight boost if country specified
        if s > 100 { s = 100 }
        if s >= minScore { scored = append(scored, struct{K string; S float64}{k, s}) }
    }
    sort.Slice(scored, func(i, j int) bool { return scored[i].S > scored[j].S })
    if len(scored) > lim { scored = scored[:lim] }
    items := make([]map[string]any, 0, len(scored))
    for _, it := range scored { items = append(items, map[string]any{"keyword": it.K, "score": it.S, "reason": strings.Join(reason[it.K], ",")}) }
    writeJSON(w, http.StatusOK, map[string]any{"items": items, "usedExternal": false})
}

func tokenizeDomain(d string) []string {
    d = strings.TrimSpace(strings.ToLower(d))
    if d == "" { return nil }
    if strings.HasPrefix(d, "http://") || strings.HasPrefix(d, "https://") { if u, err := neturl.Parse(d); err==nil { d = u.Hostname() } }
    // strip www. and TLD
    d = strings.TrimPrefix(d, "www.")
    parts := strings.FieldsFunc(d, func(r rune) bool { return r=='.' || r=='-' || r=='_' })
    // drop last part if tld-like
    if len(parts) >= 2 && len(parts[len(parts)-1]) <= 3 { parts = parts[:len(parts)-1] }
    out := make([]string, 0, len(parts))
    stop := map[string]struct{}{"com":{},"net":{},"org":{},"www":{}}
    for _, p := range parts { p = strings.TrimSpace(p); if p=="" { continue }; if _,bad := stop[p]; bad { continue }; out = append(out, p) }
    return out
}
func tokenizeKeyword(k string) []string {
    k = strings.ToLower(strings.TrimSpace(k))
    if k == "" { return nil }
    seps := func(r rune) bool { return r==' ' || r=='-' || r=='_' || r=='/' }
    out := strings.FieldsFunc(k, seps)
    return out
}
func jaccard(a []string, b []string) float64 {
    if len(a)==0 || len(b)==0 { return 0 }
    A := map[string]struct{}{}; for _, x := range a { A[x] = struct{}{} }
    B := map[string]struct{}{}; for _, x := range b { B[x] = struct{}{} }
    inter := 0
    for k := range A { if _, ok := B[k]; ok { inter++ } }
    denom := float64(len(A)+len(B)-inter)
    if denom <= 0 { return 0 }
    return float64(inter)/denom
}
func toString(v interface{}) string { if s, ok := v.(string); ok { return s }; return "" }
func toMap(v interface{}) map[string]interface{} { if m, ok := v.(map[string]interface{}); ok { return m }; return nil }
func int64From(v interface{}) int64 { switch t := v.(type) { case float64: return int64(t); case int64: return t; case int: return int64(t); case string: 
    if n, err := strconv.ParseInt(strings.TrimSpace(t), 10, 64); err == nil { return n } 
    return 0; default: return 0 } }
func brandFromTokens(tokens []string) string {
    if len(tokens)==0 { return "" }
    // heuristic: last token as brand
    return tokens[len(tokens)-1]
}
func keys(m map[string]struct{}) []string { out := make([]string,0,len(m)); for k := range m { out = append(out,k) }; return out }
func appendUnique(a []string, v string) []string { for _, x := range a { if x==v { return a } } ; return append(a, v) }

// POST /api/v1/adscenter/mcc/refresh
// Refresh statuses for all pending links of current user (best-effort; LIVE only when configured)
func (s *Server) mccRefreshHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if s.db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    // optional sharding
    shard := -1
    total := 0
    // prefer JSON body
    var body struct{ Shard *int `json:"shard"`; TotalShards *int `json:"totalShards"` }
    _ = json.NewDecoder(r.Body).Decode(&body)
    if body.TotalShards != nil && *body.TotalShards > 0 { total = *body.TotalShards }
    if body.Shard != nil && *body.Shard >= 0 { shard = *body.Shard }
    // fetch pending links
    rows, err := s.db.QueryContext(r.Context(), `SELECT customer_id FROM "MccLink" WHERE user_id=$1 AND status IN ('pending','invited')`, uid)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    ids := []string{}
    for rows.Next() { var cid string; if rows.Scan(&cid) == nil && cid != "" { ids = append(ids, cid) } }
    if total > 0 && shard >= 0 && shard < total {
        filtered := make([]string, 0, len(ids))
        for _, cid := range ids { if fnvHash(cid)%total == shard { filtered = append(filtered, cid) } }
        ids = filtered
    }
    updated := 0
    // Only attempt LIVE if ADS_LIVE or ADS_MCC_LIVE enabled
    liveEnabled := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_LIVE")), "true") || strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_KEYWORD_LIVE")), "true")
    if liveEnabled {
        cfg, _ := adscfg.LoadAdsCreds(r.Context())
        // prefer platform creds refresh token; user-level may be required for some endpoints
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken: cfg.DeveloperToken,
            OAuthClientID: cfg.OAuthClientID,
            OAuthClientSecret: cfg.OAuthClientSecret,
            RefreshToken: cfg.RefreshToken,
            LoginCustomerID: cfg.LoginCustomerID,
        })
        if err == nil {
            defer client.Close()
            for _, cid := range ids {
                sVal, err := client.GetManagerLinkStatus(r.Context(), cid)
                if err != nil { continue }
                norm := strings.ToLower(strings.TrimSpace(sVal))
                if norm == "approved" || norm == "active" { norm = "active" } else if norm == "pending" || norm == "invited" { norm = "pending" }
                if _, err := s.db.ExecContext(r.Context(), `UPDATE "MccLink" SET status=$1, updated_at=NOW() WHERE user_id=$2 AND customer_id=$3`, norm, uid, cid); err == nil { updated++ }
            }
        }
    }
    writeJSON(w, http.StatusOK, map[string]any{"checked": len(ids), "updated": updated, "live": liveEnabled})
}

func fnvHash(s string) int {
    h := fnv.New32a()
    _, _ = h.Write([]byte(s))
    return int(h.Sum32())
}

func bulkActionsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    // Read raw to allow combo shape fallback
    raw, err := io.ReadAll(r.Body)
    if err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    // Try decode as BulkActionPlan first (typed struct)
    var plan api.BulkActionPlan
    _ = json.Unmarshal(raw, &plan)
    // If no actions, try to interpret as OpportunityComboPlan and convert
    if len(plan.Actions) == 0 {
        var combo api.OpportunityComboPlan
        if err := json.Unmarshal(raw, &combo); err == nil && combo.Plan != nil {
            seed := ""; if combo.SeedDomain != nil { seed = strings.TrimSpace(*combo.SeedDomain) }
            country := ""; if combo.Country != nil { country = strings.TrimSpace(*combo.Country) }
            // helper to construct typed action with Param union
            mk := func(filter map[string]interface{}, params map[string]interface{}, t api.BulkActionPlanActionsType) struct{
                Filter *map[string]interface{}                 `json:"filter,omitempty"`
                Params *api.BulkActionPlan_Actions_Params     `json:"params,omitempty"`
                Type   *api.BulkActionPlanActionsType         `json:"type,omitempty"`
            }{
                f := filter
                var p api.BulkActionPlan_Actions_Params
                switch t {
                case api.ROTATELINK:
                    var rp api.RotateLinkParams
                    if v, ok := params["targetDomain"].(string); ok { rp.TargetDomain = &v }
                    if v, ok := params["seedDomain"].(string); ok { rp.SeedDomain = &v }
                    if v, ok := params["country"].(string); ok { rp.Country = &v }
                    _ = p.FromRotateLinkParams(rp)
                case api.ADJUSTCPC:
                    var ap api.AdjustCpcParams
                    if v, ok := params["keyword"].(string); ok { ap.Keyword = &v }
                    if v, ok := params["seedDomain"].(string); ok { ap.SeedDomain = &v }
                    if v, ok := params["country"].(string); ok { ap.Country = &v }
                    if v, ok := params["percent"].(int); ok { vv := float32(v); ap.Percent = &vv } else if v, ok := params["percent"].(float64); ok { vv := float32(v); ap.Percent = &vv }
                    if v, ok := params["cpcValue"].(float64); ok { vv := float32(v); ap.CpcValue = &vv }
                    _ = p.FromAdjustCpcParams(ap)
                default:
                }
                tt := t
                return struct{
                    Filter *map[string]interface{}                 `json:"filter,omitempty"`
                    Params *api.BulkActionPlan_Actions_Params     `json:"params,omitempty"`
                    Type   *api.BulkActionPlanActionsType         `json:"type,omitempty"`
                }{Filter: &f, Params: &p, Type: &tt}
            }
            // build actions
            if combo.Plan.Domains != nil {
                for _, d := range *combo.Plan.Domains {
                    if d.Domain == nil || strings.TrimSpace(*d.Domain) == "" { continue }
                    params := map[string]interface{}{"seedDomain": seed, "country": country, "targetDomain": *d.Domain, "source": "opportunity-combo"}
                    plan.Actions = append(plan.Actions, mk(nil, params, api.ROTATELINK))
                }
            }
            if combo.Plan.Keywords != nil {
                for _, k := range *combo.Plan.Keywords {
                    if k.Keyword == nil || strings.TrimSpace(*k.Keyword) == "" { continue }
                    percent := 5
                    if k.Score != nil { if *k.Score >= 80 { percent = 15 } else if *k.Score >= 60 { percent = 10 } }
                    params := map[string]interface{}{"keyword": *k.Keyword, "percent": percent, "reason": "opportunity-combo", "seedDomain": seed, "country": country}
                    plan.Actions = append(plan.Actions, mk(nil, params, api.ADJUSTCPC))
                }
            }
            plan.ValidateOnly = combo.ValidateOnly
        }
    }
    // Compute normalized controls
    validateOnly := false
    if plan.ValidateOnly != nil { validateOnly = *plan.ValidateOnly }
    if len(plan.Actions) == 0 { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "actions required", nil); return }
    // Project typed to generic slice for shard/audit/summary
    actionsAny := make([]map[string]any, 0, len(plan.Actions))
    for _, a := range plan.Actions {
        m := map[string]any{}
        if a.Type != nil { m["type"] = string(*a.Type) }
        if a.Filter != nil { m["filter"] = *a.Filter }
        if a.Params != nil {
            var pm map[string]any
            if b, err := json.Marshal(a.Params); err == nil { _ = json.Unmarshal(b, &pm) }
            if len(pm) > 0 { m["params"] = pm }
        }
        actionsAny = append(actionsAny, m)
    }
    type Sum struct{ Actions int `json:"actions"`; EstimatedAffected int `json:"estimatedAffected"` }
    sum := Sum{Actions: len(actionsAny), EstimatedAffected: 0}
    if validateOnly {
        writeJSON(w, http.StatusOK, map[string]any{"summary": sum})
        return
    }
    // Enqueue by persisting an operation record (minimal)
    // Table: BulkActionOperation(id, user_id, plan, status, created_at, updated_at)
    id := func() string { return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "") }()
    uid := ""
    // Try context injected by Auth middleware, fallback to header
    if v := r.Context().Value(middleware.UserIDKey); v != nil {
        if s, ok := v.(string); ok { uid = s }
    }
    if uid == "" { if v := r.Header.Get("X-User-Id"); v != "" { uid = v } }
    planBytes, _ := json.Marshal(map[string]any{"validateOnly": plan.ValidateOnly, "actions": actionsAny})
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL != "" {
        db, err := sql.Open("postgres", dbURL)
        if err == nil {
            _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());`)
            _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionAudit"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`)
            // Idempotency check
            scope := "adscenter.bulk-actions"
            idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
            if idem != "" {
                var existing string
                _ = db.QueryRow(`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, idem, uid, scope).Scan(&existing)
                if existing != "" {
                    var status sql.NullString
                    _ = db.QueryRow(`SELECT status FROM "BulkActionOperation" WHERE id=$1`, existing).Scan(&status)
                    st := "queued"; if status.Valid { st = status.String }
                    writeJSON(w, http.StatusAccepted, map[string]any{"operationId": existing, "status": st, "summary": sum})
                    _ = db.Close()
                    return
                }
            }
            // Quota enforcement (per plan) before enqueue
            planName := ratelimit.ResolveUserPlan(r.Context(), uid)
            pol := ratelimit.LoadPolicy(r.Context())
            if daily := pol.QuotaDailyFor(planName); daily > 0 {
                usage := 0
                _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, uid).Scan(&usage)
                if usage >= daily {
                    _ = db.Close()
                    apperr.Write(w, r, http.StatusTooManyRequests, "QUOTA_EXCEEDED", "daily quota exceeded", map[string]string{"plan": planName})
                    return
                }
            }
            _, _ = db.Exec(`INSERT INTO "BulkActionOperation"(id, user_id, plan, status) VALUES ($1,$2,$3,'queued')`, id, uid, string(planBytes))
            // write BEFORE snapshot (stub)
            _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'before',$3::jsonb)`, id, uid, string(planBytes))
            // Optional shard planning for large plans
            _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionShard"(
                id BIGSERIAL PRIMARY KEY,
                op_id TEXT NOT NULL,
                seq INT NOT NULL,
                actions JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`)
            if len(actionsAny) > 0 {
                // batch size via env ADS_MUTATE_BATCH_SIZE (default 20)
                batchSize := 20
                if v := strings.TrimSpace(os.Getenv("ADS_MUTATE_BATCH_SIZE")); v != "" {
                    if n, err := strconv.Atoi(v); err == nil && n > 0 { batchSize = n }
                }
                total := len(actionsAny)
                if total > batchSize {
                    // split into shards and persist
                    shards := 0
                    for i := 0; i < total; i += batchSize {
                        j := i + batchSize
                        if j > total { j = total }
                        part := actionsAny[i:j]
                        pb, _ := json.Marshal(map[string]any{"actions": part})
                        _, _ = db.Exec(`INSERT INTO "BulkActionShard"(op_id, seq, actions, status) VALUES ($1,$2,$3,'queued')`, id, shards, string(pb))
                        shards++
                    }
                    // audit shard plan
                    sp := map[string]any{"kind": "shard_plan", "batchSize": batchSize, "shards": shards, "totalActions": total}
                    sb, _ := json.Marshal(sp)
                    _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'other',$3::jsonb)`, id, uid, string(sb))
                }
            }
            // Fine-grained action snapshots (kind=other)
            if len(actionsAny) > 0 {
                for idx, a := range actionsAny {
                    b, _ := json.Marshal(map[string]any{"actionIndex": idx, "action": a})
                    _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'other',$3::jsonb)`, id, uid, string(b))
                }
            }
            if idem != "" {
                _, _ = db.Exec(`
                    INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
                    VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
                    ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at
                `, idem, uid, scope, id, "24 hours")
            }
            // simulate progress for demo if enabled
            if strings.EqualFold(strings.TrimSpace(os.Getenv("SIMULATE_BULK_ACTION")), "1") {
                go func(opId string) {
                    // best-effort status transitions with shard simulation
                    time.Sleep(500 * time.Millisecond)
                    _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='running', updated_at=NOW() WHERE id=$1`, opId)
                    // iterate shards if any
                    rows, err := db.Query(`SELECT id, seq FROM "BulkActionShard" WHERE op_id=$1 ORDER BY seq ASC`, opId)
                    if err == nil {
                        for rows.Next() {
                            var shardID int64; var seq int
                            if err := rows.Scan(&shardID, &seq); err == nil {
                                _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1`, shardID)
                                time.Sleep(400 * time.Millisecond)
                                _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, shardID)
                            }
                        }
                        rows.Close()
                    }
                    time.Sleep(500 * time.Millisecond)
                    _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, opId)
                    // AFTER snapshot (stub summary)
                    var planTxt string
                    _ = db.QueryRow(`SELECT plan::text FROM "BulkActionOperation" WHERE id=$1`, opId).Scan(&planTxt)
                    snap := map[string]any{"summary": map[string]any{"status": "completed"}}
                    if planTxt != "" { snap["plan"] = json.RawMessage(planTxt) }
                    b, _ := json.Marshal(snap)
                    _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, opId, uid, string(b))
                }(id)
            }
            _ = db.Close()
        }
    }
    writeJSON(w, http.StatusAccepted, map[string]any{"operationId": id, "status": "queued", "summary": sum})
}

// bulkRollbackHandler marks an operation as rolled_back and appends a rollback audit snapshot (stub).
func (s *Server) bulkRollbackHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := r.URL.Query().Get("id")
    // chi pattern: /api/v1/adscenter/bulk-actions/{id}/rollback → get from path if empty
    if id == "" {
        parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
        if len(parts) >= 1 { id = parts[0] }
    }
    if strings.TrimSpace(id) == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // ensure tables
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`)
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionAudit"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    // verify ownership
    var owner sql.NullString
    if err := db.QueryRow(`SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&owner); err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "operation not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    if !owner.Valid || owner.String != uid {
        apperr.Write(w, r, http.StatusForbidden, "FORBIDDEN", "not owner", nil); return
    }
    // update status and insert rollback snapshot (stub)
    _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='rolled_back', updated_at=NOW() WHERE id=$1`, id)
    snap := map[string]any{"summary": map[string]any{"status": "rolled_back", "mode": "stub"}}
    b, _ := json.Marshal(snap)
    _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'rollback',$3::jsonb)`, id, uid, string(b))
    writeJSON(w, http.StatusOK, map[string]any{"operationId": id, "status": "rolled_back"})
}

// bulkAuditsHandler lists audits for an operation.
func (s *Server) bulkAuditsHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := r.URL.Query().Get("id")
    if id == "" {
        parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
        if len(parts) >= 2 { id = parts[0] }
    }
    if strings.TrimSpace(id) == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    rows, err := db.Query(`SELECT kind, snapshot::text, created_at FROM "BulkActionAudit" WHERE op_id=$1 AND user_id=$2 ORDER BY created_at ASC`, id, uid)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ Kind string `json:"kind"`; Snapshot json.RawMessage `json:"snapshot"`; CreatedAt time.Time `json:"createdAt"` }
    out := []item{}
    for rows.Next() {
        var it item
        var snapTxt string
        if err := rows.Scan(&it.Kind, &snapTxt, &it.CreatedAt); err == nil { it.Snapshot = json.RawMessage(snapTxt); out = append(out, it) }
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func runMigrations(databaseURL string) error {
    db, err := sql.Open("postgres", databaseURL)
    if err != nil { return err }
    defer db.Close()
    if err = db.Ping(); err != nil { return err }
    tx, err := db.Begin()
    if err != nil { return err }
    defer tx.Rollback()
    files, err := os.ReadDir("internal/migrations")
    if err != nil {
        if os.IsNotExist(err) {
            log.Printf("No migrations directory found; skipping DB migrations.")
            return nil
        }
        return err
    }
    for _, f := range files {
        if f.IsDir() { continue }
        if !strings.HasSuffix(f.Name(), ".sql") { continue }
        b, err := os.ReadFile("internal/migrations/"+f.Name())
        if err != nil { return err }
        stmts := strings.Split(string(b), ";")
        for _, s := range stmts {
            s = strings.TrimSpace(s)
            if s == "" { continue }
            if _, err := tx.Exec(s); err != nil { return err }
        }
    }
    return tx.Commit()
}

func main() {
    log.Println("Starting Adscenter service...")
    ctx := context.Background()
    // optional OTel trace (no-op if disabled)
    shutdown := telemetry.SetupTracing("adscenter")
    defer func(){ _ = shutdown(context.Background()) }()
    cfg, err := adsconfig.Load(ctx)
    if err != nil { log.Fatalf("config load: %v", err) }
    if err := runMigrations(cfg.DatabaseURL); err != nil { log.Fatalf("migrations: %v", err) }
    db, err := storage.NewDB(cfg.DatabaseURL)
    if err != nil { log.Fatalf("db: %v", err) }
    defer db.Close()

    srv := &Server{db: db}
    r := chi.NewRouter()
    telemetry.RegisterDefaultMetrics("adscenter")
    // Middlewares must be registered before any routes are added
    r.Use(telemetry.ChiMiddleware("adscenter"))
    r.Use(middleware.LoggingMiddleware("adscenter"))
    // healthz/readyz for k8s/Cloud Run probes (unified convention)
    r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
        ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
        defer cancel()
        if err := srv.db.PingContext(ctx); err != nil {
            apperr.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
            return
        }
        w.WriteHeader(http.StatusOK)
    })
    r.Handle("/metrics", telemetry.MetricsHandler())
    // Mount OpenAPI chi server
    oas := &oasImpl{srv: srv}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
        ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
            apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", err.Error(), nil)
        },
    })
    r.Mount("/", oapiHandler)
    // Extra endpoints not in OAS
    r.HandleFunc("/api/v1/adscenter/oauth/callback", srv.oauthCallbackHandler)
    r.Handle("/api/v1/adscenter/mcc/link", middleware.AuthMiddleware(http.HandlerFunc(srv.mccLinkHandler)))
    r.Handle("/api/v1/adscenter/mcc/status", middleware.AuthMiddleware(http.HandlerFunc(srv.mccStatusHandler)))
    r.Handle("/api/v1/adscenter/mcc/unlink", middleware.AuthMiddleware(http.HandlerFunc(srv.mccUnlinkHandler)))
    r.Handle("/api/v1/adscenter/mcc/refresh", middleware.AuthMiddleware(http.HandlerFunc(srv.mccRefreshHandler)))
    // Diagnostics (extra endpoint, not in OAS)
    r.Handle("/api/v1/adscenter/diagnose", middleware.AuthMiddleware(http.HandlerFunc(srv.diagnoseHandler)))
    r.Handle("/api/v1/adscenter/diagnose/plan", middleware.AuthMiddleware(http.HandlerFunc(srv.diagnosePlanHandler)))
    r.Handle("/api/v1/adscenter/diagnose/execute", middleware.AuthMiddleware(http.HandlerFunc(srv.diagnoseExecuteHandler)))
    r.Handle("/api/v1/adscenter/diagnose/metrics", middleware.AuthMiddleware(http.HandlerFunc(srv.diagnoseMetricsHandler)))
    // Bulk actions matrix (capability introspection)
    r.Handle("/api/v1/adscenter/bulk-actions/matrix", middleware.AuthMiddleware(http.HandlerFunc(srv.bulkMatrixHandler)))
    // Risk Engine (basic rules)
    r.Handle("/api/v1/adscenter/risk/evaluate", middleware.AuthMiddleware(http.HandlerFunc(srv.riskEvaluateHandler)))
    // Limits info endpoint（非OAS，便于前端获知套餐限流/配额）
    r.Handle("/api/v1/adscenter/limits/me", middleware.AuthMiddleware(http.HandlerFunc(srv.limitsInfoHandler)))
    // Internal worker endpoints (requires auth)
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/execute-next", middleware.AuthMiddleware(http.HandlerFunc(srv.executeNextShardHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/execute-tick", middleware.AuthMiddleware(http.HandlerFunc(srv.executeTickHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/shards", middleware.AuthMiddleware(http.HandlerFunc(srv.listShardsHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/snapshots", middleware.AuthMiddleware(http.HandlerFunc(srv.listSnapshotsHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/snapshot-aggregate", middleware.AuthMiddleware(http.HandlerFunc(srv.listSnapshotAggregateHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/deadletters", middleware.AuthMiddleware(http.HandlerFunc(srv.listDeadLettersHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/deadletters/{dlid}/retry", middleware.AuthMiddleware(http.HandlerFunc(srv.retryDeadLetterHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/deadletters/retry-batch", middleware.AuthMiddleware(http.HandlerFunc(srv.retryDeadLetterBatchHandler)))
    // Keywords expansion (rule-based, no Ads API)
    r.Handle("/api/v1/adscenter/keywords/expand", middleware.AuthMiddleware(http.HandlerFunc(srv.keywordsExpandHandler)))
    // Bulk audits & rollback (stubs)
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/audits", middleware.AuthMiddleware(http.HandlerFunc(srv.bulkAuditsHandler)))
    r.Handle("/api/v1/adscenter/bulk-actions/{id}/rollback", middleware.AuthMiddleware(http.HandlerFunc(srv.bulkRollbackHandler)))

    port := cfg.Port
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, r); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// oasImpl adapts generated interface to existing handlers
type oasImpl struct{ srv *Server }

func (h *oasImpl) ListAccounts(w http.ResponseWriter, r *http.Request)      { h.srv.accountsHandler(w, r) }
func (h *oasImpl) RunPreflight(w http.ResponseWriter, r *http.Request)      { h.srv.preflightHandler(w, r) }
func (h *oasImpl) GetOAuthUrl(w http.ResponseWriter, r *http.Request)       { h.srv.oauthURLHandler(w, r) }
func (h *oasImpl) OauthCallback(w http.ResponseWriter, r *http.Request)     { h.srv.oauthCallbackHandler(w, r) }
func (h *oasImpl) SubmitBulkActions(w http.ResponseWriter, r *http.Request) { bulkActionsHandler(w, r) }
// GET /api/v1/adscenter/bulk-actions
func (h *oasImpl) ListBulkActions(w http.ResponseWriter, r *http.Request, params api.ListBulkActionsParams) {
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if dbURL == "" || uid == "" { writeJSON(w, http.StatusOK, map[string]any{"items": []any{}}); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    limit := 50
    if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 200 { limit = int(*params.Limit) }
    rows, err := db.QueryContext(r.Context(), `SELECT id, status, created_at, updated_at FROM "BulkActionOperation" WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2`, uid, limit)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    out := []api.BulkActionOperation{}
    for rows.Next() {
        var id string
        var status sql.NullString
        var created, updated sql.NullTime
        if err := rows.Scan(&id, &status, &created, &updated); err == nil {
            item := api.BulkActionOperation{OperationId: id, Status: api.BulkActionOperationStatus(status.String)}
            if created.Valid { item.CreatedAt = &created.Time }
            if updated.Valid { item.UpdatedAt = &updated.Time }
            out = append(out, item)
        }
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// POST /api/v1/adscenter/mcc/refresh
func (h *oasImpl) MccRefresh(w http.ResponseWriter, r *http.Request) { h.srv.mccRefreshHandler(w, r) }
func (h *oasImpl) ExpandKeywords(w http.ResponseWriter, r *http.Request)    { h.srv.expandKeywordsHandler(w, r) }
func (h *oasImpl) GetBulkActionAudits(w http.ResponseWriter, r *http.Request, id string) {
    // Delegate to existing handler; ensure path contains id for parser
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/adscenter/bulk-actions/" + id + "/audits"
    h.srv.bulkAuditsHandler(w, r2)
}
func (h *oasImpl) RollbackBulkAction(w http.ResponseWriter, r *http.Request, id string) {
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/adscenter/bulk-actions/" + id + "/rollback"
    h.srv.bulkRollbackHandler(w, r2)
}
// POST /api/v1/adscenter/bulk-actions/{id}/rollback-plan
func (h *oasImpl) GetRollbackPlan(w http.ResponseWriter, r *http.Request, id string) {
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    var planTxt sql.NullString
    if err := db.QueryRow(`SELECT plan::text FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&planTxt); err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "operation not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    // 1) 尝试基于执行审计（exec）生成“精准回滚”计划（用 before 快照还原）
    invPlan := map[string]any{"validateOnly": true}
    type actionT struct{ Type string; Params map[string]any }
    precise := make([]actionT, 0)
    rows, err := db.Query(`SELECT snapshot::text FROM "BulkActionAudit" WHERE op_id=$1 AND kind='exec' ORDER BY id ASC`, id)
    if err == nil {
        defer rows.Close()
        for rows.Next() {
            var snapTxt string
            if rows.Scan(&snapTxt) != nil { continue }
            var snap map[string]any
            if json.Unmarshal([]byte(snapTxt), &snap) != nil { continue }
            // expect: { action: {type, params}, result: { details: { before: {...}, targets: [...] } } }
            act, _ := snap["action"].(map[string]any)
            t := toString(act["type"])
            res, _ := snap["result"].(map[string]any)
            det := toMap(res["details"])
            if t == "" || det == nil { continue }
            switch strings.ToUpper(t) {
            case "ADJUST_CPC":
                // details.before: { resourceName: cpcMicros }
                if before := toMap(det["before"]); before != nil {
                    targets := make([]string, 0, len(before))
                    var firstVal int64
                    same := true
                    idx := 0
                    for rn, val := range before {
                        targets = append(targets, rn)
                        v := int64From(val)
                        if idx == 0 { firstVal = v } else if v != firstVal { same = false }
                        idx++
                    }
                    if len(targets) > 0 {
                        if same {
                            precise = append(precise, actionT{Type: "ADJUST_CPC", Params: map[string]any{"targetResourceNames": targets, "cpcMicros": firstVal}})
                        } else {
                            for rn, val := range before {
                                precise = append(precise, actionT{Type: "ADJUST_CPC", Params: map[string]any{"targetResourceNames": []string{rn}, "cpcMicros": int64From(val)}})
                            }
                        }
                    }
                }
            case "ADJUST_BUDGET":
                if before := toMap(det["before"]); before != nil {
                    targets := make([]string, 0, len(before))
                    var firstVal int64
                    same := true
                    idx := 0
                    for rn, val := range before {
                        targets = append(targets, rn)
                        v := int64From(val)
                        if idx == 0 { firstVal = v } else if v != firstVal { same = false }
                        idx++
                    }
                    if len(targets) > 0 {
                        if same {
                            precise = append(precise, actionT{Type: "ADJUST_BUDGET", Params: map[string]any{"campaignBudgetResourceNames": targets, "amountMicros": firstVal}})
                        } else {
                            for rn, val := range before {
                                precise = append(precise, actionT{Type: "ADJUST_BUDGET", Params: map[string]any{"campaignBudgetResourceNames": []string{rn}, "amountMicros": int64From(val)}})
                            }
                        }
                    }
                }
            case "ROTATE_LINK":
                // details.before: { resourceName: suffix }
                if before := toMap(det["before"]); before != nil {
                    targets := make([]string, 0, len(before))
                    var firstS string
                    same := true
                    idx := 0
                    for rn, val := range before {
                        s := toString(val)
                        targets = append(targets, rn)
                        if idx == 0 { firstS = s } else if s != firstS { same = false }
                        idx++
                    }
                    if len(targets) > 0 {
                        if same {
                            precise = append(precise, actionT{Type: "ROTATE_LINK", Params: map[string]any{"adResourceNames": targets, "finalUrlSuffix": firstS}})
                        } else {
                            for rn, val := range before {
                                precise = append(precise, actionT{Type: "ROTATE_LINK", Params: map[string]any{"adResourceNames": []string{rn}, "finalUrlSuffix": toString(val)}})
                            }
                        }
                    }
                }
            }
        }
    }
    if len(precise) > 0 {
        arr := make([]any, 0, len(precise))
        for _, a := range precise { arr = append(arr, map[string]any{"type": a.Type, "params": a.Params}) }
        invPlan["actions"] = arr
        writeJSON(w, http.StatusOK, map[string]any{"plan": invPlan, "source": "exec_audit"})
        return
    }

    // 2) 回退：基于原计划生成“启发式逆向计划”（兼容旧逻辑）
    inverse := map[string]any{"validateOnly": true}
    if strings.TrimSpace(planTxt.String) != "" {
        var in map[string]any
        _ = json.Unmarshal([]byte(planTxt.String), &in)
        if arr, ok := in["actions"].([]any); ok {
            inv := make([]any, 0, len(arr))
            for _, a := range arr {
                m, ok := a.(map[string]any); if !ok { continue }
                t, _ := m["type"].(string)
                params, _ := m["params"].(map[string]any)
                switch t {
                case "ADJUST_CPC":
                    if v, ok := params["percent"].(float64); ok { params["percent"] = -v }
                case "ADJUST_BUDGET":
                    if v, ok := params["dailyBudget"].(float64); ok { params["dailyBudget"] = v * 0.5 }
                case "ROTATE_LINK":
                    params = map[string]any{"note": "manual review required"}
                }
                inv = append(inv, map[string]any{"type": t, "filter": m["filter"], "params": params})
            }
            inverse["actions"] = inv
        }
    }
    writeJSON(w, http.StatusOK, map[string]any{"plan": inverse, "source": "original_plan"})
}
// GET /api/v1/adscenter/audits
func (h *oasImpl) ListAuditEvents(w http.ResponseWriter, r *http.Request, params api.ListAuditEventsParams) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    q := `SELECT kind, data::text, created_at FROM "AuditEvent" WHERE user_id=$1`
    args := []any{uid}
    idx := 2
    if params.Kind != nil && *params.Kind != "" { q += fmt.Sprintf(" AND kind=$%d", idx); args = append(args, *params.Kind); idx++ }
    if params.Since != nil { q += fmt.Sprintf(" AND created_at >= $%d", idx); args = append(args, *params.Since); idx++ }
    lim := 50
    if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 200 { lim = int(*params.Limit) }
    q += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", idx)
    args = append(args, lim)
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ Kind string `json:"kind"`; Data json.RawMessage `json:"data"`; CreatedAt time.Time `json:"createdAt"` }
    out := []item{}
    for rows.Next() { var it item; var dt string; if err := rows.Scan(&it.Kind, &dt, &it.CreatedAt); err == nil { it.Data = json.RawMessage(dt); out = append(out, it) } }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}
// POST /api/v1/adscenter/bulk-actions/validate
// oasImpl has inline implementations for validate & get; no extra adapter needed
// POST /api/v1/adscenter/mcc/link
func (h *oasImpl) MccLink(w http.ResponseWriter, r *http.Request) { h.srv.mccLinkHandler(w, r) }
// GET /api/v1/adscenter/mcc/status
func (h *oasImpl) MccStatus(w http.ResponseWriter, r *http.Request, params api.MccStatusParams) {
    // attach query param to request URL (handler reads from r.URL)
    q := r.URL.Query(); q.Set("customerId", params.CustomerId); r2 := r.Clone(r.Context()); r2.URL.RawQuery = q.Encode()
    h.srv.mccStatusHandler(w, r2)
}
// POST /api/v1/adscenter/mcc/unlink
func (h *oasImpl) MccUnlink(w http.ResponseWriter, r *http.Request) { h.srv.mccUnlinkHandler(w, r) }
// POST /api/v1/adscenter/oauth/revoke
func (h *oasImpl) OauthRevoke(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    // Optional live revoke against Google OAuth2 revoke endpoint
    // 1) read encrypted token
    tokenEnc, _, _, _ := storage.GetUserRefreshToken(r.Context(), db, uid)
    token := tokenEnc
    if pt, ok := decryptWithRotation(tokenEnc); ok { token = pt }
    // 2) call revoke if enabled
    if strings.EqualFold(strings.TrimSpace(os.Getenv("OAUTH_REVOKE_LIVE")), "true") && strings.TrimSpace(token) != "" {
        // Use unified http client for tracing/circuit; keep form encoding
        form := neturl.Values{}
        form.Set("token", token)
        req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://oauth2.googleapis.com/revoke", strings.NewReader(form.Encode()))
        req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
        _ , _ = httpx.New(5 * time.Second).DoRaw(req)
    }
    // 3) clear stored token (best-effort)
    _, err := db.ExecContext(r.Context(), `UPDATE "UserAdsConnection" SET "refreshToken"='' WHERE "userId"=$1`, uid)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "UPDATE_FAILED", "failed to clear token", map[string]string{"error": err.Error()}); return }
    _ = writeAudit(r.Context(), db, uid, "oauth_revoke", map[string]any{"live": strings.EqualFold(strings.TrimSpace(os.Getenv("OAUTH_REVOKE_LIVE")), "true")})
    writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}
// GET /api/v1/adscenter/bulk-actions/{id}/plan
func (h *oasImpl) GetBulkActionPlan(w http.ResponseWriter, r *http.Request, id string) {
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    var planTxt sql.NullString
    err = db.QueryRow(`SELECT plan::text FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&planTxt)
    if err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "operation not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    if !planTxt.Valid || strings.TrimSpace(planTxt.String) == "" { writeJSON(w, http.StatusOK, map[string]any{"plan": map[string]any{}}); return }
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"plan":` + planTxt.String + `}`))
}
// POST /api/v1/adscenter/bulk-actions/{id}/rollback-execute
func (h *oasImpl) RollbackExecute(w http.ResponseWriter, r *http.Request, id string) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    // Load plan
    var planTxt sql.NullString
    if err := db.QueryRowContext(r.Context(), `SELECT plan::text FROM "BulkActionOperation" WHERE id=$1 AND user_id=$2`, id, uid).Scan(&planTxt); err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "operation not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    // Generate inverse
    inv := map[string]any{"validateOnly": true}
    if strings.TrimSpace(planTxt.String) != "" {
        var in map[string]any
        _ = json.Unmarshal([]byte(planTxt.String), &in)
        if arr, ok := in["actions"].([]any); ok {
            invArr := make([]any, 0, len(arr))
            for _, a := range arr {
                m, ok := a.(map[string]any); if !ok { continue }
                t, _ := m["type"].(string)
                p, _ := m["params"].(map[string]any)
                switch t {
                case "ADJUST_CPC": if v, ok := p["percent"].(float64); ok { p["percent"] = -v } 
                case "ADJUST_BUDGET": if v, ok := p["dailyBudget"].(float64); ok { p["dailyBudget"] = v * 0.5 }
                case "ROTATE_LINK": p = map[string]any{"note": "manual review required"}
                }
                invArr = append(invArr, map[string]any{"type": t, "filter": m["filter"], "params": p})
            }
            inv["actions"] = invArr
        }
    }
    // Execute stub: write audit entries per action, update operation status
    executed := 0
    errors := 0
    if arr, ok := inv["actions"].([]any); ok {
        for _, a := range arr {
            snap := map[string]any{"action": a, "status": "ok", "executedAt": time.Now().UTC()}
            b, _ := json.Marshal(snap)
            if _, err := db.ExecContext(r.Context(), `INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'rollback_exec',$3::jsonb)`, id, uid, string(b)); err != nil {
                errors++
            } else {
                executed++
            }
        }
    }
    _, _ = db.ExecContext(r.Context(), `UPDATE "BulkActionOperation" SET status='rolled_back', updated_at=NOW() WHERE id=$1`, id)
    _ = writeAudit(r.Context(), db, uid, "rollback_execute", map[string]any{"operationId": id, "executed": executed, "errors": errors})
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusAccepted)
    _ = json.NewEncoder(w).Encode(map[string]any{"executed": executed, "errors": errors})
}
// GET /api/v1/adscenter/bulk-actions/{id}/report
func (h *oasImpl) GetRollbackReport(w http.ResponseWriter, r *http.Request, id string, params api.GetRollbackReportParams) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    // optional kind filter via query param
    kind := ""
    if params.Kind != nil { kind = strings.TrimSpace(string(*params.Kind)) }
    q := `SELECT kind, snapshot::text, created_at FROM "BulkActionAudit" WHERE op_id=$1 AND user_id=$2`
    args := []any{id, uid}
    if kind == "rollback" || kind == "rollback_exec" || kind == "after" {
        q += ` AND kind=$3`
        args = append(args, kind)
    } else {
        q += ` AND kind IN ('rollback','rollback_exec','after')`
    }
    q += ` ORDER BY created_at ASC`
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ Kind string `json:"kind"`; Snapshot json.RawMessage `json:"snapshot"`; CreatedAt time.Time `json:"createdAt"` }
    out := []item{}
    for rows.Next() { var it item; var snapTxt string; if err := rows.Scan(&it.Kind, &snapTxt, &it.CreatedAt); err == nil { it.Snapshot = json.RawMessage(snapTxt); out = append(out, it) } }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// bulkMatrixHandler returns supported bulk actions and expected params (static capability matrix).
// GET /api/v1/adscenter/bulk-actions/matrix
func (s *Server) bulkMatrixHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{
        "actions": []map[string]any{
            {"type": "ADJUST_CPC", "params": []map[string]any{
                {"name": "keyword", "type": "string", "required": false},
                {"name": "percent", "type": "number", "required": false, "note": "percent or cpcValue required"},
                {"name": "cpcValue", "type": "number", "required": false},
                {"name": "seedDomain", "type": "string", "required": false},
                {"name": "country", "type": "string", "required": false},
            }},
            {"type": "ADJUST_BUDGET", "params": []map[string]any{
                {"name": "dailyBudget", "type": "number", "required": false},
                {"name": "percent", "type": "number", "required": false},
            }},
            {"type": "ROTATE_LINK", "params": []map[string]any{
                {"name": "targetDomain", "type": "string", "required": false},
                {"name": "links", "type": "string[]", "required": false},
                {"name": "seedDomain", "type": "string", "required": false},
                {"name": "country", "type": "string", "required": false},
            }},
        },
        "notes": []string{
            "ADJUST_CPC: require either percent or cpcValue",
            "ADJUST_BUDGET: dailyBudget>0 or percent specified",
            "ROTATE_LINK: require targetDomain or non-empty links[]",
        },
    })
}

// riskEvaluateHandler evaluates basic risk signals and writes an audit event; optionally publishes a notification.
// POST /api/v1/adscenter/risk/evaluate { accountId, landingUrl?, metrics }
func (s *Server) riskEvaluateHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    if r.Method != http.MethodPost { apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{ AccountID string `json:"accountId"`; LandingURL string `json:"landingUrl"`; Metrics map[string]any `json:"metrics"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    get := func(k string, def float64) float64 {
        if body.Metrics == nil { return def }
        if v, ok := body.Metrics[k]; ok {
            switch t := v.(type) { case float64: return t; case int: return float64(t); case string: if f, e := strconv.ParseFloat(t, 64); e == nil { return f } }
        }
        return def
    }
    impressions := get("impressions", 0)
    ctr := get("ctr", 0)
    qs := get("qualityScore", 0)
    risks := []map[string]any{}
    add := func(code, sev, msg string, details map[string]any) { risks = append(risks, map[string]any{"code": code, "severity": sev, "message": msg, "details": details}) }
    if impressions <= 0 { add("NO_IMPRESSIONS", "error", "近7天曝光为0，广告未投放或被限制", map[string]any{"impressions": impressions}) }
    if impressions > 100 && ctr < 0.5 { add("LOW_CTR", "warn", "点击率较低", map[string]any{"ctr": ctr}) }
    if qs > 0 && qs < 5 { add("LOW_QUALITY_SCORE", "warn", "质量得分偏低", map[string]any{"qualityScore": qs}) }
    if u := strings.TrimSpace(body.LandingURL); u != "" {
        if !strings.Contains(u, "utm_") && !strings.Contains(u, "gclid=") { add("TRACKING_MISSING", "warn", "缺少utm/gclid跟踪参数", map[string]any{"landingUrl": u}) }
    }
    // audit best-effort
    _ = writeAudit(r.Context(), s.db, uid, "risk_detected", map[string]any{"accountId": body.AccountID, "risks": risks})
    // optional notification publish
    go func() {
        defer func(){ recover() }()
        if pub, err := ev.NewPublisher(context.Background()); err == nil && len(risks) > 0 {
            _ = pub.Publish(context.Background(), ev.EventNotificationCreated, map[string]any{
                "userId": uid,
                "type": "risk",
                "title": "检测到广告风险",
                "data": map[string]any{"accountId": body.AccountID, "risks": risks},
                "createdAt": time.Now().UTC().Format(time.RFC3339),
            }, ev.WithSource("adscenter"))
            pub.Close()
        }
    }()
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"items": risks})
}
// POST /api/v1/adscenter/bulk-actions/validate
func (h *oasImpl) ValidateBulkActions(w http.ResponseWriter, r *http.Request) {
    var body struct{
        ValidateOnly *bool `json:"validateOnly"`
        Actions *[]map[string]any `json:"actions"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    if body.Actions == nil || len(*body.Actions) == 0 { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "actions required", nil); return }
    // simple validation: allowed types and required params presence stub
    allowed := map[string]struct{}{"ADJUST_CPC":{}, "ADJUST_BUDGET":{}, "ROTATE_LINK":{}}
    warns := []string{}
    errs := []string{}
    violations := make([]map[string]any, 0, 8)
    addV := func(code, sev, msg string, idx int, field string) { violations = append(violations, map[string]any{"code": code, "severity": sev, "message": msg, "actionIndex": idx, "field": field}) }
    // hard limits
    if len(*body.Actions) > 100 { errs = append(errs, "too many actions (>100)") }
    for i, a := range *body.Actions {
        t, _ := a["type"].(string)
        if _, ok := allowed[t]; !ok { errs = append(errs, fmt.Sprintf("actions[%d]: unsupported type", i)); addV("UNSUPPORTED_TYPE","error","unsupported action type", i, "type"); continue }
        params, _ := a["params"].(map[string]any)
        switch t {
        case "ADJUST_CPC":
            // require either percent or cpcValue
            _, hasPct := params["percent"].(float64)
            _, hasValue := params["cpcValue"].(float64)
            if !hasPct && !hasValue { errs = append(errs, fmt.Sprintf("actions[%d]: ADJUST_CPC requires percent or cpcValue", i)); addV("CPC_PARAM_REQUIRED","error","percent or cpcValue required", i, "params"); break }
            if v, ok := params["percent"].(float64); ok {
                if v > 100 { errs = append(errs, fmt.Sprintf("actions[%d]: percent > 100 not allowed", i)); addV("CPC_PERCENT_TOO_HIGH","error","percent over 100%", i, "params.percent") } else if v > 50 { warns = append(warns, fmt.Sprintf("actions[%d]: large percent %0.1f%%", i, v)); addV("CPC_PERCENT_LARGE","warn","percent over 50%", i, "params.percent") }
            }
        case "ADJUST_BUDGET":
            if v, ok := params["dailyBudget"].(float64); ok {
                if v <= 0 { errs = append(errs, fmt.Sprintf("actions[%d]: dailyBudget must be > 0", i)); addV("BUDGET_NON_POSITIVE","error","dailyBudget must be > 0", i, "params.dailyBudget") }
                if v > 10000 { warns = append(warns, fmt.Sprintf("actions[%d]: high dailyBudget %.0f", i, v)); addV("BUDGET_HIGH","warn","dailyBudget very high", i, "params.dailyBudget") }
            } else {
                warns = append(warns, fmt.Sprintf("actions[%d]: dailyBudget missing", i)); addV("BUDGET_MISSING","warn","dailyBudget missing", i, "params.dailyBudget")
            }
        case "ROTATE_LINK":
            // Accept either links array or targetDomain string
            if links, ok := params["links"].([]any); ok {
                if len(links) == 0 { errs = append(errs, fmt.Sprintf("actions[%d]: links empty", i)); addV("LINKS_EMPTY","error","links empty", i, "params.links") }
            } else if td, ok := params["targetDomain"].(string); ok {
                if strings.TrimSpace(td) == "" { errs = append(errs, fmt.Sprintf("actions[%d]: targetDomain empty", i)); addV("TARGET_DOMAIN_EMPTY","error","targetDomain empty", i, "params.targetDomain") }
            } else {
                errs = append(errs, fmt.Sprintf("actions[%d]: either links[] or targetDomain required", i)); addV("ROTATE_PARAM_REQUIRED","error","links[] or targetDomain required", i, "params")
            }
        }
        // generic hints
        if _, ok := a["filter"].(map[string]any); !ok { warns = append(warns, fmt.Sprintf("actions[%d]: filter missing (may affect many entities)", i)); addV("FILTER_MISSING","warn","filter missing (may affect many entities)", i, "filter") }
    }
    // Quota（按套餐）：读取用户套餐的每日配额，并基于今日使用量给出告警/错误
    if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid != "" {
        plan := ratelimit.ResolveUserPlan(r.Context(), uid)
        pol := ratelimit.LoadPolicy(r.Context())
        if daily := pol.QuotaDailyFor(plan); daily > 0 {
            // 估算今日使用量：按用户统计今日创建的 BulkActionOperation 数
            usage := 0
            if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
                if db2, err := sql.Open("postgres", dbURL); err == nil {
                    defer db2.Close()
                    _ = db2.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, uid).Scan(&usage)
                }
            }
            if usage >= daily { errs = append(errs, "daily quota exceeded"); addV("QUOTA_EXCEEDED","error","daily quota exceeded", -1, "quota.daily") }
            if usage > int(float64(daily)*0.8) && usage < daily { warns = append(warns, "daily quota near limit"); addV("QUOTA_NEAR_LIMIT","warn","daily quota near 80%", -1, "quota.daily") }
        }
    }
    // naive estimatedAffected: per action baseline 10，ADJUST_BUDGET=15，ROTATE_LINK=8
    est := 0
    for _, a := range *body.Actions {
        t, _ := a["type"].(string)
        switch t {
        case "ADJUST_BUDGET": est += 15
        case "ROTATE_LINK": est += 8
        default: est += 10
        }
    }
    sum := map[string]any{"actions": len(*body.Actions), "estimatedAffected": est}
    out := map[string]any{"ok": len(errs) == 0, "summary": sum, "warnings": warns, "errors": errs, "violations": violations}
    // audit best-effort
    if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid != "" { _ = writeAudit(r.Context(), h.srv.db, uid, "bulk_validate", out) }
    writeJSON(w, http.StatusOK, out)
}

// Ads diagnose endpoints (OAS bindings)
func (h *oasImpl) Diagnose(w http.ResponseWriter, r *http.Request)                 { h.srv.diagnoseHandler(w, r) }
func (h *oasImpl) DiagnosePlan(w http.ResponseWriter, r *http.Request)            { h.srv.diagnosePlanHandler(w, r) }
func (h *oasImpl) DiagnoseExecute(w http.ResponseWriter, r *http.Request)         { h.srv.diagnoseExecuteHandler(w, r) }
func (h *oasImpl) GetDiagnoseMetrics(w http.ResponseWriter, r *http.Request, params api.GetDiagnoseMetricsParams) {
    // Pass-through to existing handler (reads accountId from query)
    h.srv.diagnoseMetricsHandler(w, r)
}

// writeAudit writes an audit event best-effort.
func writeAudit(ctx context.Context, db *sql.DB, userID, kind string, data map[string]any) error {
    if db == nil || userID == "" || kind == "" { return nil }
    b, _ := json.Marshal(data)
    _, err := db.ExecContext(ctx, `INSERT INTO "AuditEvent"(user_id, kind, data, created_at) VALUES ($1,$2,$3::jsonb,NOW())`, userID, kind, string(b))
    return err
}
func (h *oasImpl) GetBulkAction(w http.ResponseWriter, r *http.Request, id string) {
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // ensure table
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`)
    var status sql.NullString
    var created, updated sql.NullTime
    err = db.QueryRow(`SELECT status, created_at, updated_at FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&status, &created, &updated)
    if err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "operation not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    resp := api.BulkActionOperation{OperationId: id, Status: api.BulkActionOperationStatus(status.String)}
    if created.Valid { resp.CreatedAt = &created.Time }
    if updated.Valid { resp.UpdatedAt = &updated.Time }
    // parse summary from plan if needed
    var actions int
    var plan struct{ Actions *[]any `json:"actions"` }
    if row := db.QueryRow(`SELECT plan FROM "BulkActionOperation" WHERE id=$1`, id); row != nil {
        var txt string
        if err := row.Scan(&txt); err == nil && txt != "" {
            _ = json.Unmarshal([]byte(txt), &plan)
            if plan.Actions != nil { actions = len(*plan.Actions) }
        }
    }
    resp.Summary = &struct {
        Actions           *int `json:"actions,omitempty"`
        EstimatedAffected *int `json:"estimatedAffected,omitempty"`
    }{Actions: func() *int { if actions > 0 { return &actions }; return nil }(), EstimatedAffected: nil}
    writeJSON(w, http.StatusOK, resp)
}

// GET /api/v1/adscenter/bulk-actions/{id}/report
// duplicate GetRollbackReport removed; unified implementation above uses h.srv.db and supports kind filter including rollback_exec
// GET /api/v1/adscenter/mcc/links
func (h *oasImpl) ListMccLinks(w http.ResponseWriter, r *http.Request, params api.ListMccLinksParams) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    q := `SELECT customer_id, status, updated_at FROM "MccLink" WHERE user_id=$1`
    args := []any{uid}
    if params.Status != nil && *params.Status != "" {
        q += ` AND status=$2`
        args = append(args, string(*params.Status))
    }
    q += ` ORDER BY updated_at DESC LIMIT 100`
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ CustomerId string `json:"customerId"`; Status string `json:"status"`; UpdatedAt time.Time `json:"updatedAt"` }
    out := []item{}
    for rows.Next() {
        var it item
        if err := rows.Scan(&it.CustomerId, &it.Status, &it.UpdatedAt); err == nil { out = append(out, it) }
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}
// GET /api/v1/adscenter/connections
func (h *oasImpl) ListAdsConnections(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    db := h.srv.db
    if db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil); return }
    rows, err := db.QueryContext(r.Context(), `SELECT COALESCE("loginCustomerId",''), COALESCE("primaryCustomerId",''), COALESCE("updatedAt", NOW()) FROM "UserAdsConnection" WHERE "userId"=$1 ORDER BY "updatedAt" DESC LIMIT 5`, uid)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ LoginCustomerId string `json:"loginCustomerId"`; PrimaryCustomerId string `json:"primaryCustomerId"`; UpdatedAt time.Time `json:"updatedAt"` }
    list := []item{}
    for rows.Next() {
        var it item
        if err := rows.Scan(&it.LoginCustomerId, &it.PrimaryCustomerId, &it.UpdatedAt); err == nil { list = append(list, it) }
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": list})
}

// POST /api/v1/adscenter/keywords/expand
func (s *Server) expandKeywordsHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    var body struct{
        SeedDomain    string   `json:"seedDomain"`
        SeedKeywords  []string `json:"seedKeywords"`
        ValidateOnly  bool     `json:"validateOnly"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    // basic normalization
    seeds := make([]string, 0, len(body.SeedKeywords))
    for _, s := range body.SeedKeywords { s = strings.TrimSpace(s); if s != "" { seeds = append(seeds, s) } }
    seedDomain := strings.TrimSpace(body.SeedDomain)
    if len(seeds) == 0 && seedDomain == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain or seedKeywords required", nil); return }

    // Optional LIVE integration (build tag 'ads_live' required for real API calls)
    var ideas []adsstub.KeywordIdea
    if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_KEYWORD_LIVE")), "true") {
        // Load platform creds + user refresh token (similar to preflight)
        creds, _ := adscfg.LoadAdsCreds(r.Context())
        tokenEnc, loginCID, _, err := storage.GetUserRefreshToken(r.Context(), s.db, uid)
        if err == nil && tokenEnc != "" {
            if pt, ok := decryptWithRotation(tokenEnc); ok { creds.RefreshToken = pt } else { creds.RefreshToken = tokenEnc }
            if creds.LoginCustomerID == "" && loginCID != "" { creds.LoginCustomerID = loginCID }
            if cli, err2 := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
                DeveloperToken: creds.DeveloperToken,
                OAuthClientID: creds.OAuthClientID,
                OAuthClientSecret: creds.OAuthClientSecret,
                RefreshToken: creds.RefreshToken,
                LoginCustomerID: creds.LoginCustomerID,
            }); err2 == nil {
                if its, err3 := cli.KeywordIdeas(r.Context(), seedDomain, seeds); err3 == nil { ideas = its }
            }
        }
    }
    if ideas == nil {
        // Fallback to stub
        cli, _ := adsstub.NewClient(r.Context(), adsstub.LiveConfig{})
        ideas, _ = cli.KeywordIdeas(r.Context(), seedDomain, seeds)
    }
    type idea struct{ Keyword string `json:"keyword"`; Avg int `json:"avgMonthlySearches"`; Competition string `json:"competition"` }
    items := make([]idea, 0, len(ideas))
    for _, it := range ideas {
        if it.AvgMonthlySearches <= 1000 { continue }
        if strings.EqualFold(it.Competition, "HIGH") { continue }
        items = append(items, idea{Keyword: it.Text, Avg: it.AvgMonthlySearches, Competition: strings.ToUpper(it.Competition)})
    }
    sort.Slice(items, func(i, j int) bool { return items[i].Avg > items[j].Avg })
    if len(items) > 20 { items = items[:20] }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []idea `json:"items"` }{Items: items})
}

// executeNextShardHandler picks the next queued shard for a bulk operation and executes it (stub),
// emitting fine-grained audits and updating shard/operation status.
// POST /api/v1/adscenter/bulk-actions/{id}/execute-next
func (s *Server) executeNextShardHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // get op id
    id := ""
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
    if len(parts) >= 2 { id = parts[0] }
    if id == "" { id = strings.TrimSpace(r.URL.Query().Get("id")) }
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // ensure tables
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`)
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionShard"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, seq INT NOT NULL, actions JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    // pick next queued shard
    var shardID int64
    var actionsTxt string
    err = db.QueryRow(`SELECT id, actions::text FROM "BulkActionShard" WHERE op_id=$1 AND status='queued' ORDER BY seq ASC LIMIT 1`, id).Scan(&shardID, &actionsTxt)
    if err == sql.ErrNoRows {
        // nothing to do; if no running shards, finalize operation
        var cnt int
        _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionShard" WHERE op_id=$1 AND status IN ('queued','running')`, id).Scan(&cnt)
        if cnt == 0 {
            _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, id)
        }
        writeJSON(w, http.StatusOK, map[string]any{"status": "idle", "remaining": cnt})
        return
    } else if err != nil {
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    // mark running
    _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1`, shardID)
    // parse actions JSON
    var payload struct{ Actions []map[string]any `json:"actions"` }
    _ = json.Unmarshal([]byte(actionsTxt), &payload)
    // Apply per-user (owner) plan limiters for mutate
    var ownerUID string
    _ = db.QueryRow(`SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&ownerUID)
    if strings.TrimSpace(ownerUID) != "" {
        plan := ratelimit.ResolveUserPlan(r.Context(), ownerUID)
        pol := ratelimit.LoadPolicy(r.Context())
        rl := pol.For(plan, "mutate")
        km := getExecKeyedMgr(r.Context())
        if km != nil {
            if rel, err := km.Get(ownerUID+":mutate", rl.RPM, rl.Concurrency).Acquire(r.Context()); err == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
        }
        if relG, err := getExecGlobalLimiter().Acquire(r.Context()); err == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
    }
    executed := 0
    errorsN := 0
    // Prepare executor config with Ads credentials (best-effort)
    cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
    // owner refresh token
    rtEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), s.db, ownerUID)
    rt := rtEnc
    if pt, ok := decryptWithRotation(rtEnc); ok { rt = pt }
    exec := exectr.New(exectr.Config{
        BrowserExecURL: strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")),
        InternalToken:  strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")),
        Timeout:        8 * time.Second,
        ValidateOnly:   false,
        LiveMutate:     strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MUTATE_LIVE")), "true"),
        DeveloperToken: cfgAds.DeveloperToken,
        OAuthClientID:  cfgAds.OAuthClientID,
        OAuthClientSecret: cfgAds.OAuthClientSecret,
        RefreshToken:   rt,
        LoginCustomerID: func() string { if cfgAds.LoginCustomerID != "" { return cfgAds.LoginCustomerID }; return loginCID }(),
        CustomerID:     loginCID,
    })
    for idx, a := range payload.Actions {
        act := exectr.Action{Type: toString(a["type"]), Filter: toMap(a["filter"]), Params: toMap(a["params"])}
        // execute with retry
        var res exectr.Result
        err := ratelimit.Retry(r.Context(), 3, 200*time.Millisecond, 1500*time.Millisecond, func(c context.Context) error {
            rr, e := exec.ExecuteOne(c, act); res = rr; return e
        })
        snap := map[string]any{"actionIndex": idx, "action": a, "executedAt": time.Now().UTC(), "result": res}
        if err != nil || !res.Success { errorsN++ ; snap["status"] = "error"; if err != nil { snap["error"] = err.Error() } } else { executed++; snap["status"] = "ok" }
        b, _ := json.Marshal(snap)
        _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'exec',$3::jsonb)`, id, uid, string(b))
        // write before/after snapshots (best-effort)
        _ = writeSnapshots(r.Context(), db, id, idx, toString(a["type"]), res)
        if err != nil || !res.Success {
            _ = writeDeadLetter(r.Context(), db, id, idx, toString(a["type"]), a, res, err)
        }
    }
    _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, shardID)
    // if no remaining shards, finalize operation
    var remaining int
    _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionShard" WHERE op_id=$1 AND status IN ('queued','running')`, id).Scan(&remaining)
    if remaining == 0 {
        _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, id)
        // AFTER snapshot aggregate
        snap := map[string]any{"summary": map[string]any{"status": "completed"}}
        b, _ := json.Marshal(snap)
        _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, id, uid, string(b))
    }
    writeJSON(w, http.StatusOK, map[string]any{"processedShard": shardID, "executed": executed, "errors": errorsN, "remaining": remaining})
}

// executeTickHandler picks up to ?max=N queued shards across all operations and executes them (stub),
// intended to be triggered by Cloud Scheduler with OIDC.
// POST /api/v1/adscenter/bulk-actions/execute-tick?max=1
func (s *Server) executeTickHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(middleware.UserIDKey)
    uid, _ := uidRaw.(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    max := 1
    if v := strings.TrimSpace(r.URL.Query().Get("max")); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 50 { max = n }
    }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // ensure tables
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionShard"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, seq INT NOT NULL, actions JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    processed := 0
    for processed < max {
        // pick a fair window grouped by owner (user_id), taking first per owner
        rows, err := db.Query(`
            SELECT s.id, s.actions::text, s.op_id, o.user_id
            FROM "BulkActionShard" s
            JOIN "BulkActionOperation" o ON s.op_id = o.id
            WHERE s.status='queued'
            ORDER BY o.user_id, s.created_at ASC
            LIMIT 200`)
        if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
        type rec struct{ shardID int64; actionsTxt, opId, owner string }
        picked := make(map[string]rec)
        for rows.Next() {
            var sid int64; var atxt, op, owner string
            if err := rows.Scan(&sid, &atxt, &op, &owner); err == nil {
                if _, ok := picked[owner]; !ok { picked[owner] = rec{shardID: sid, actionsTxt: atxt, opId: op, owner: owner} }
            }
        }
        rows.Close()
        if len(picked) == 0 { break }
        for _, pr := range picked {
            if processed >= max { break }
            // mark running (optimistic)
            _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1 AND status='queued'`, pr.shardID)
            var st string
            _ = db.QueryRow(`SELECT status FROM "BulkActionShard" WHERE id=$1`, pr.shardID).Scan(&st)
            if st != "running" { continue }
            // parse actions JSON
            var payload struct{ Actions []map[string]any `json:"actions"` }
            _ = json.Unmarshal([]byte(pr.actionsTxt), &payload)
            // rate limits (per owner)
            ownerUID := pr.owner
            if strings.TrimSpace(ownerUID) != "" {
                plan := ratelimit.ResolveUserPlan(r.Context(), ownerUID)
                pol := ratelimit.LoadPolicy(r.Context())
                rl := pol.For(plan, "mutate")
                km := getExecKeyedMgr(r.Context())
                if km != nil {
                    if rel, err := km.Get(ownerUID+":mutate", rl.RPM, rl.Concurrency).Acquire(r.Context()); err == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
                }
                if relG, err := getExecGlobalLimiter().Acquire(r.Context()); err == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
            }
            // executor with owner creds
            cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
            rtEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), s.db, ownerUID)
            rt := rtEnc
            if pt, ok := decryptWithRotation(rtEnc); ok { rt = pt }
            exec := exectr.New(exectr.Config{
                BrowserExecURL: strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")),
                InternalToken:  strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")),
                Timeout:        8 * time.Second,
                ValidateOnly:   false,
                LiveMutate:     strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MUTATE_LIVE")), "true"),
                DeveloperToken: cfgAds.DeveloperToken,
                OAuthClientID:  cfgAds.OAuthClientID,
                OAuthClientSecret: cfgAds.OAuthClientSecret,
                RefreshToken:   rt,
                LoginCustomerID: func() string { if cfgAds.LoginCustomerID != "" { return cfgAds.LoginCustomerID }; return loginCID }(),
                CustomerID:     loginCID,
            })
            for idx, a := range payload.Actions {
                act := exectr.Action{Type: toString(a["type"]), Filter: toMap(a["filter"]), Params: toMap(a["params"])}
                var res exectr.Result
                err := ratelimit.Retry(r.Context(), 3, 200*time.Millisecond, 1500*time.Millisecond, func(c context.Context) error { rr, e := exec.ExecuteOne(c, act); res = rr; return e })
                snap := map[string]any{"actionIndex": idx, "action": a, "executedAt": time.Now().UTC(), "result": res}
                if err != nil || !res.Success { snap["status"] = "error"; if err != nil { snap["error"] = err.Error() } } else { snap["status"] = "ok" }
                b, _ := json.Marshal(snap)
                _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'exec',$3::jsonb)`, pr.opId, uid, string(b))
                _ = writeSnapshots(r.Context(), db, pr.opId, idx, toString(a["type"]), res)
                if err != nil || !res.Success {
                    _ = writeDeadLetter(r.Context(), db, pr.opId, idx, toString(a["type"]), a, res, err)
                }
            }
            _, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, pr.shardID)
            // finalize op if no shards left
            var remaining int
            _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionShard" WHERE op_id=$1 AND status IN ('queued','running')`, pr.opId).Scan(&remaining)
            if remaining == 0 {
                _, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, pr.opId)
                snap := map[string]any{"summary": map[string]any{"status": "completed"}}
                b, _ := json.Marshal(snap)
                _, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, pr.opId, uid, string(b))
            }
            processed++
            if processed >= max { break }
        }
    }
    writeJSON(w, http.StatusOK, map[string]any{"processed": processed})
}

// listShardsHandler returns shard statuses for a given operation id.
// GET /api/v1/adscenter/bulk-actions/{id}/shards
func (s *Server) listShardsHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := ""
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
    if len(parts) >= 2 { id = parts[0] }
    if id == "" { id = strings.TrimSpace(r.URL.Query().Get("id")) }
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    rows, err := db.Query(`SELECT id, seq, status, updated_at FROM "BulkActionShard" WHERE op_id=$1 ORDER BY seq ASC`, id)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type shard struct{ ID int64 `json:"id"`; Seq int `json:"seq"`; Status string `json:"status"`; UpdatedAt time.Time `json:"updatedAt"` }
    out := []shard{}
    for rows.Next() {
        var sh shard
        if err := rows.Scan(&sh.ID, &sh.Seq, &sh.Status, &sh.UpdatedAt); err == nil { out = append(out, sh) }
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// listSnapshotsHandler lists before/after snapshots for an operation.
// GET /api/v1/adscenter/bulk-actions/{id}/snapshots?kind=before|after
func (s *Server) listSnapshotsHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := ""
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
    if len(parts) >= 2 { id = parts[0] }
    if id == "" { id = strings.TrimSpace(r.URL.Query().Get("id")) }
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionSnapshot"(
        id BIGSERIAL PRIMARY KEY,
        op_id TEXT NOT NULL,
        action_idx INT NOT NULL,
        action_type TEXT NOT NULL,
        kind TEXT NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    kind := strings.TrimSpace(r.URL.Query().Get("kind"))
    q := `SELECT id, action_idx, action_type, kind, snapshot::text, created_at FROM "BulkActionSnapshot" WHERE op_id=$1`
    args := []any{id}
    if kind == "before" || kind == "after" {
        q += ` AND kind=$2`
        args = append(args, kind)
    }
    q += ` ORDER BY id ASC LIMIT 500`
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ ID int64 `json:"id"`; ActionIdx int `json:"actionIdx"`; ActionType string `json:"actionType"`; Kind string `json:"kind"`; Snapshot json.RawMessage `json:"snapshot"`; CreatedAt time.Time `json:"createdAt"` }
    out := []item{}
    for rows.Next() { var it item; var snapTxt string; if err := rows.Scan(&it.ID, &it.ActionIdx, &it.ActionType, &it.Kind, &snapTxt, &it.CreatedAt); err == nil { it.Snapshot = json.RawMessage(snapTxt); out = append(out, it) } }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// writeSnapshots persists before/after snapshots (best-effort) if present in the result details.
func writeSnapshots(ctx context.Context, db *sql.DB, opId string, idx int, actionType string, res exectr.Result) error {
    if db == nil { return nil }
    // ensure table
    _, _ = db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS "BulkActionSnapshot"(
        id BIGSERIAL PRIMARY KEY,
        op_id TEXT NOT NULL,
        action_idx INT NOT NULL,
        action_type TEXT NOT NULL,
        kind TEXT NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    det := toMap(res.Details)
    if det == nil { return nil }
    insert := func(kind string, m map[string]any) {
        for rn, val := range m {
            snap := map[string]any{"resourceName": rn, "value": val}
            b, _ := json.Marshal(snap)
            _, _ = db.ExecContext(ctx, `INSERT INTO "BulkActionSnapshot"(op_id, action_idx, action_type, kind, snapshot) VALUES ($1,$2,$3,$4,$5::jsonb)`, opId, idx, actionType, kind, string(b))
        }
    }
    if b := toMap(det["before"]); b != nil { insert("before", b) }
    if a := toMap(det["after"]); a != nil { insert("after", a) }
    return nil
}

// Dead letters: persist failed actions for later inspection/retry.
func writeDeadLetter(ctx context.Context, db *sql.DB, opId string, idx int, actionType string, action map[string]any, res exectr.Result, execErr error) error {
    if db == nil { return nil }
    _, _ = db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS "BulkActionDeadLetter"(
        id BIGSERIAL PRIMARY KEY,
        op_id TEXT NOT NULL,
        action_idx INT NOT NULL,
        action_type TEXT NOT NULL,
        error TEXT,
        action JSONB NOT NULL,
        result JSONB,
        retry_count INT NOT NULL DEFAULT 0,
        retried_at TIMESTAMPTZ NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    a, _ := json.Marshal(action)
    r, _ := json.Marshal(res)
    errMsg := ""
    if execErr != nil { errMsg = execErr.Error() } else if !res.Success { errMsg = toString(res.Message) }
    _, _ = db.ExecContext(ctx, `INSERT INTO "BulkActionDeadLetter"(op_id, action_idx, action_type, error, action, result) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, opId, idx, actionType, errMsg, string(a), string(r))
    return nil
}

// listDeadLettersHandler lists dead letters for an operation id.
func (s *Server) listDeadLettersHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := strings.TrimSpace(strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")[0])
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionDeadLetter"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, action_idx INT NOT NULL, action_type TEXT NOT NULL, error TEXT, action JSONB NOT NULL, result JSONB, retry_count INT NOT NULL DEFAULT 0, retried_at TIMESTAMPTZ NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    rows, err := db.QueryContext(r.Context(), `SELECT id, action_idx, action_type, error, action::text, result::text, retry_count, retried_at, status, created_at FROM "BulkActionDeadLetter" WHERE op_id=$1 ORDER BY id ASC LIMIT 500`, id)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ ID int64 `json:"id"`; ActionIdx int `json:"actionIdx"`; ActionType string `json:"actionType"`; Error string `json:"error"`; Action json.RawMessage `json:"action"`; Result json.RawMessage `json:"result"`; RetryCount int `json:"retryCount"`; RetriedAt *time.Time `json:"retriedAt"`; Status string `json:"status"`; CreatedAt time.Time `json:"createdAt"` }
    out := []item{}
    for rows.Next() { var it item; var aj, rj string; var retried sql.NullTime; if err := rows.Scan(&it.ID, &it.ActionIdx, &it.ActionType, &it.Error, &aj, &rj, &it.RetryCount, &retried, &it.Status, &it.CreatedAt); err == nil { it.Action = json.RawMessage(aj); it.Result = json.RawMessage(rj); if retried.Valid { t := retried.Time; it.RetriedAt = &t }; out = append(out, it) } }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// retryDeadLetterHandler retries executing a specific dead letter row and updates its status.
// POST /api/v1/adscenter/bulk-actions/{id}/deadletters/{dlid}/retry
func (s *Server) retryDeadLetterHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
    if len(parts) < 4 || parts[2] != "deadletters" || parts[3] == "" || parts[1] == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id/dlid required", nil); return }
    opId := parts[0]
    dlid := strings.TrimSpace(parts[3])
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // ensure tables
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionDeadLetter"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, action_idx INT NOT NULL, action_type TEXT NOT NULL, error TEXT, action JSONB NOT NULL, result JSONB, retry_count INT NOT NULL DEFAULT 0, retried_at TIMESTAMPTZ NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    var idx int
    var at, actionJSON string
    err = db.QueryRowContext(r.Context(), `SELECT action_idx, action_type, action::text FROM "BulkActionDeadLetter" WHERE id=$1 AND op_id=$2`, dlid, opId).Scan(&idx, &at, &actionJSON)
    if err != nil { if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "dead letter not found", nil); return } ; apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    var action map[string]any
    _ = json.Unmarshal([]byte(actionJSON), &action)
    // prepare executor
    ownerUID := ""
    _ = db.QueryRow(`SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, opId).Scan(&ownerUID)
    cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
    rtEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), s.db, ownerUID)
    rt := rtEnc
    if pt, ok := decryptWithRotation(rtEnc); ok { rt = pt }
    exec := exectr.New(exectr.Config{
        BrowserExecURL: strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")),
        InternalToken:  strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")),
        Timeout:        8 * time.Second,
        ValidateOnly:   false,
        LiveMutate:     strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MUTATE_LIVE")), "true"),
        DeveloperToken: cfgAds.DeveloperToken,
        OAuthClientID:  cfgAds.OAuthClientID,
        OAuthClientSecret: cfgAds.OAuthClientSecret,
        RefreshToken:   rt,
        LoginCustomerID: func() string { if cfgAds.LoginCustomerID != "" { return cfgAds.LoginCustomerID }; return loginCID }(),
        CustomerID:     loginCID,
    })
    // limits (mutate)
    plan := ratelimit.ResolveUserPlan(r.Context(), ownerUID)
    pol := ratelimit.LoadPolicy(r.Context())
    rl := pol.For(plan, "mutate")
    km := getExecKeyedMgr(r.Context())
    if km != nil {
        if rel, e := km.Get(ownerUID+":mutate", rl.RPM, rl.Concurrency).Acquire(r.Context()); e == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
    }
    if relG, e := getExecGlobalLimiter().Acquire(r.Context()); e == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
    // execute
    act := exectr.Action{Type: at, Params: toMap(action["params"]), Filter: toMap(action["filter"]) }
    var res exectr.Result
    execErr := ratelimit.Retry(r.Context(), 3, 200*time.Millisecond, 1500*time.Millisecond, func(c context.Context) error { rr, e := exec.ExecuteOne(c, act); res = rr; return e })
    // audit + snapshots
    snap := map[string]any{"actionIndex": idx, "action": action, "executedAt": time.Now().UTC(), "result": res}
    if execErr != nil || !res.Success { snap["status"] = "error"; if execErr != nil { snap["error"] = execErr.Error() } } else { snap["status"] = "ok" }
    b, _ := json.Marshal(snap)
    _, _ = db.ExecContext(r.Context(), `INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'exec',$3::jsonb)`, opId, uid, string(b))
    _ = writeSnapshots(r.Context(), db, opId, idx, at, res)
    // update dead letter row
    st := "resolved"
    if execErr != nil || !res.Success { st = "failed" }
    _, _ = db.ExecContext(r.Context(), `UPDATE "BulkActionDeadLetter" SET retry_count=retry_count+1, retried_at=NOW(), status=$1, result=$2::jsonb, error=$3 WHERE id=$4`, st, string(b), func() string { if execErr != nil { return execErr.Error() }; return toString(res.Message) }(), dlid)
    writeJSON(w, http.StatusOK, map[string]any{"status": st, "result": res})
}

// retryDeadLetterBatchHandler retries up to ?limit deadletters for an operation, optionally filtered by actionType.
// POST /api/v1/adscenter/bulk-actions/{id}/deadletters/retry-batch?actionType=ADJUST_CPC&limit=10
func (s *Server) retryDeadLetterBatchHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := strings.TrimSpace(strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")[0])
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    filterType := strings.TrimSpace(r.URL.Query().Get("actionType"))
    limit := 10
    if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 { limit = n } }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    // prepare executor/context
    ownerUID := ""
    _ = db.QueryRow(`SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&ownerUID)
    cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
    rtEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), s.db, ownerUID)
    rt := rtEnc
    if pt, ok := decryptWithRotation(rtEnc); ok { rt = pt }
    exec := exectr.New(exectr.Config{
        BrowserExecURL: strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")),
        InternalToken:  strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")),
        Timeout:        8 * time.Second,
        ValidateOnly:   false,
        LiveMutate:     strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MUTATE_LIVE")), "true"),
        DeveloperToken: cfgAds.DeveloperToken,
        OAuthClientID:  cfgAds.OAuthClientID,
        OAuthClientSecret: cfgAds.OAuthClientSecret,
        RefreshToken:   rt,
        LoginCustomerID: func() string { if cfgAds.LoginCustomerID != "" { return cfgAds.LoginCustomerID }; return loginCID }(),
        CustomerID:     loginCID,
    })
    // limits
    plan := ratelimit.ResolveUserPlan(r.Context(), ownerUID)
    pol := ratelimit.LoadPolicy(r.Context())
    rl := pol.For(plan, "mutate")
    km := getExecKeyedMgr(r.Context())
    if km != nil {
        if rel, e := km.Get(ownerUID+":mutate", rl.RPM, rl.Concurrency).Acquire(r.Context()); e == nil { defer rel() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
    }
    if relG, e := getExecGlobalLimiter().Acquire(r.Context()); e == nil { defer relG() } else { apperr.Write(w, r, http.StatusTooManyRequests, "RATE_LIMIT", "rate limited", nil); return }
    // query rows
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionDeadLetter"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, action_idx INT NOT NULL, action_type TEXT NOT NULL, error TEXT, action JSONB NOT NULL, result JSONB, retry_count INT NOT NULL DEFAULT 0, retried_at TIMESTAMPTZ NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    q := `SELECT id, action_idx, action_type, action::text FROM "BulkActionDeadLetter" WHERE op_id=$1 AND status IN ('pending','failed')`
    args := []any{id}
    if filterType != "" { q += ` AND action_type=$2`; args = append(args, filterType) }
    q += ` ORDER BY id ASC LIMIT ` + fmt.Sprintf("%d", limit)
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    retried := 0
    resolved := 0
    for rows.Next() {
        var dlid int64
        var idx int
        var at, aj string
        if rows.Scan(&dlid, &idx, &at, &aj) != nil { continue }
        var action map[string]any
        _ = json.Unmarshal([]byte(aj), &action)
        act := exectr.Action{Type: at, Params: toMap(action["params"]), Filter: toMap(action["filter"]) }
        var res exectr.Result
        execErr := ratelimit.Retry(r.Context(), 3, 200*time.Millisecond, 1500*time.Millisecond, func(c context.Context) error { rr, e := exec.ExecuteOne(c, act); res = rr; return e })
        // audit/snapshots
        snap := map[string]any{"actionIndex": idx, "action": action, "executedAt": time.Now().UTC(), "result": res}
        if execErr != nil || !res.Success { snap["status"] = "error"; if execErr != nil { snap["error"] = execErr.Error() } } else { snap["status"] = "ok" }
        b, _ := json.Marshal(snap)
        _, _ = db.ExecContext(r.Context(), `INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'exec',$3::jsonb)`, id, uid, string(b))
        _ = writeSnapshots(r.Context(), db, id, idx, at, res)
        // update DL row
        st := "resolved"
        if execErr != nil || !res.Success { st = "failed" } else { resolved++ }
        _, _ = db.ExecContext(r.Context(), `UPDATE "BulkActionDeadLetter" SET retry_count=retry_count+1, retried_at=NOW(), status=$1, result=$2::jsonb, error=$3 WHERE id=$4`, st, string(b), func() string { if execErr != nil { return execErr.Error() }; return toString(res.Message) }(), dlid)
        retried++
    }
    writeJSON(w, http.StatusOK, map[string]any{"retried": retried, "resolved": resolved})
}

// listSnapshotAggregateHandler aggregates before/after snapshots into a compact diff view.
func (s *Server) listSnapshotAggregateHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := strings.TrimSpace(strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")[0])
    if id == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operationId required", nil); return }
    dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
    if dbURL == "" { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    db, err := sql.Open("postgres", dbURL)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "DB_OPEN_FAILED", "db open failed", map[string]string{"error": err.Error()}); return }
    defer db.Close()
    actionFilter := strings.TrimSpace(r.URL.Query().Get("actionType"))
    limit := 500
    if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 2000 { limit = n } }
    q := `SELECT action_type, kind, snapshot::text FROM "BulkActionSnapshot" WHERE op_id=$1`
    args := []any{id}
    if actionFilter != "" { q += ` AND action_type=$2`; args = append(args, actionFilter) }
    q += ` ORDER BY id ASC LIMIT $` + fmt.Sprintf("%d", len(args)+1)
    args = append(args, limit)
    rows, err := db.QueryContext(r.Context(), q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    // aggregate by resourceName
    ag := map[string]map[string]any{} // key=resourceName -> {actionType, before, after}
    for rows.Next() {
        var at, kind, snapTxt string
        if rows.Scan(&at, &kind, &snapTxt) != nil { continue }
        var m map[string]any
        if json.Unmarshal([]byte(snapTxt), &m) != nil { continue }
        rn := toString(m["resourceName"])
        if rn == "" { continue }
        entry, ok := ag[rn]
        if !ok { entry = map[string]any{"actionType": at}; ag[rn] = entry }
        entry[kind] = m["value"]
    }
    out := make([]map[string]any, 0, len(ag))
    for rn, e := range ag {
        out = append(out, map[string]any{"resourceName": rn, "actionType": e["actionType"], "before": e["before"], "after": e["after"]})
    }
    writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// limitsInfoHandler returns current user's plan and effective limits (preflight/mutate per plan) and daily quota.
// GET /api/v1/adscenter/limits/me
func (s *Server) limitsInfoHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    plan := ratelimit.ResolveUserPlan(r.Context(), uid)
    pol := ratelimit.LoadPolicy(r.Context())
    pf := pol.For(plan, "preflight")
    mt := pol.For(plan, "mutate")
    daily := pol.QuotaDailyFor(plan)
    // today usage (best-effort)
    used := 0
    if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
        if db, err := sql.Open("postgres", dbURL); err == nil {
            defer db.Close()
            _ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date=CURRENT_DATE`, uid).Scan(&used)
        }
    }
    writeJSON(w, http.StatusOK, map[string]any{
        "plan": plan,
        "limits": map[string]any{
            "preflight": map[string]any{"rpm": pf.RPM, "concurrency": pf.Concurrency},
            "mutate":    map[string]any{"rpm": mt.RPM, "concurrency": mt.Concurrency},
        },
        "quota": map[string]any{"daily": daily, "usedToday": used},
    })
}
