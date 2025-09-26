package main

import (
    "encoding/json"
    "context"
    "log"
    "net/http"
    "os"
    "time"
    "net/url"
    "io"
    "regexp"
    "strings"
    "strconv"

    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/recommendations/internal/oapi"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
    "database/sql"
    _ "github.com/lib/pq"
    "cloud.google.com/go/firestore"
    "cloud.google.com/go/bigquery"
    "fmt"
    "google.golang.org/api/iterator"
    "hash/fnv"
    apperr "github.com/xxrenzhe/autoads/pkg/errors"
)

func main() {
    r := chi.NewRouter()
    telemetry.RegisterDefaultMetrics("recommendations")
    r.Use(telemetry.ChiMiddleware("recommendations"))
    r.Use(middleware.LoggingMiddleware("recommendations"))
    r.Handle("/metrics", telemetry.MetricsHandler())
    r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

    srv := &Server{cache: map[string]aliasCache{}}
    // optional DB
    if dsn := strings.TrimSpace(os.Getenv("DATABASE_URL")); dsn != "" {
        if db, err := sql.Open("postgres", dsn); err == nil {
            if err := db.Ping(); err == nil {
                srv.db = db
                _ = ensureDDL(db)
            }
        }
    }
    h := &oasImpl{srv: srv}
    oapiHandler := api.HandlerWithOptions(h, api.ChiServerOptions{
        BaseURL: "/api/v1",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
    })
    r.Mount("/", oapiHandler)

    port := strings.TrimSpace(os.Getenv("PORT"))
    if port == "" { port = "8080" }
    log.Printf("recommendations listening on :%s", port)
    log.Fatal(http.ListenAndServe(":"+port, r))
}

type aliasCache struct{ aliases []string; exp time.Time }
type Server struct{ cache map[string]aliasCache; db *sql.DB }
type oasImpl struct{ srv *Server }

// POST /recommend/keywords/brand-check
func (h *oasImpl) BrandCheck(w http.ResponseWriter, r *http.Request) {
    type req struct{
        SeedDomain string   `json:"seedDomain"`
        Keywords   []string `json:"keywords"`
        Locale     string   `json:"locale"`
        LandingURL string   `json:"landingUrl"`
    }
    var body req
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    seed := strings.TrimSpace(body.SeedDomain)
    if seed == "" || len(body.Keywords) == 0 { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain and keywords required", nil); return }

    // Build brand alias set (with cache + optional landing page signals)
    aliases := h.srv.getAliases(seed, body.LandingURL)

    items := make([]api.BrandCheckItem, 0, len(body.Keywords))
    for _, kw := range body.Keywords {
        k := strings.TrimSpace(kw)
        if k == "" { continue }
        norm := normalize(k)
        contains, matched, method, score := matchBrand(norm, aliases)
        severity := "none"
        if contains && method == "exact" { severity = "error" } else if contains && method == "fuzzy" { severity = "warn" }
        it := api.BrandCheckItem{Keyword: k, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(severity)}
        if matched != "" { it.MatchedAlias = &matched }
        if score > 0 { s := float32(score); it.Score = &s }
        items = append(items, it)
    }
    // best-effort persistence
    go h.srv.persistResults(seed, aliases, items)
    // best-effort Firestore UI write
    if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid != "" {
        go h.srv.maybeWriteFirestore(r.Context(), uid, seed, items)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []api.BrandCheckItem `json:"items"` }{Items: items})
}

// POST /recommend/internal/offline/brand-audit
func (h *oasImpl) OfflineBrandAudit(w http.ResponseWriter, r *http.Request) {
    var body api.OfflineBrandAuditJSONRequestBody
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    seed := strings.TrimSpace(body.SeedDomain)
    if seed == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil); return }
    // collect keywords: prefer provided; else try BigQuery if enabled; else 202 without work
    keywords := make([]string, 0)
    if body.Keywords != nil { for _, k := range *body.Keywords { k = strings.TrimSpace(k); if k != "" { keywords = append(keywords, k) } } }
    // shard parameters (optional)
    totalShards := 0
    shard := 0
    if body.TotalShards != nil && *body.TotalShards > 0 { totalShards = int(*body.TotalShards) }
    if body.Shard != nil && *body.Shard >= 0 { shard = int(*body.Shard) }

    if len(keywords) == 0 && strings.EqualFold(strings.TrimSpace(os.Getenv("BQ_ENABLED")), "1") {
        days := 30; if body.Days != nil && *body.Days > 0 { days = int(*body.Days) }
        limit := 1000; if body.Limit != nil && *body.Limit > 0 { limit = int(*body.Limit) }
        acct := ""; if body.AccountId != nil { acct = strings.TrimSpace(*body.AccountId) }
        if ks, err := fetchKeywordsFromBigQuery(r.Context(), days, limit, acct); err == nil { keywords = ks }
    }
    if len(keywords) == 0 { w.WriteHeader(http.StatusAccepted); _ = json.NewEncoder(w).Encode(map[string]any{"status":"accepted","message":"no keywords to audit"}); return }
    // shard filtering (optional)
    if totalShards > 0 && shard < totalShards {
        filtered := make([]string, 0, len(keywords))
        for _, k := range keywords {
            hsh := fnvHash(k) % totalShards
            if hsh == shard { filtered = append(filtered, k) }
        }
        keywords = filtered
    }
    // run audit (best-effort)
    go func(seed string, list []string) {
        aliases := h.srv.getAliases(seed, "")
        items := make([]api.BrandCheckItem, 0, len(list))
        for _, kw := range list {
            k := strings.TrimSpace(kw); if k == "" { continue }
            norm := normalize(k)
            contains, matched, method, score := matchBrand(norm, aliases)
            sev := "none"; if contains && method == "exact" { sev = "error" } else if contains && method == "fuzzy" { sev = "warn" }
            it := api.BrandCheckItem{Keyword: k, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(sev)}
            if matched != "" { it.MatchedAlias = &matched }
            if score > 0 { s := float32(score); it.Score = &s }
            items = append(items, it)
        }
        h.srv.persistResults(seed, aliases, items)
    }(seed, keywords)
    w.WriteHeader(http.StatusAccepted)
    resp := map[string]any{"status":"accepted","seedDomain": seed, "keywords": len(keywords)}
    if totalShards > 0 { resp["shard"] = shard; resp["totalShards"] = totalShards }
    _ = json.NewEncoder(w).Encode(resp)
}

// POST /recommend/internal/offline/brand-coverage-audit
func (h *oasImpl) OfflineBrandCoverageAudit(w http.ResponseWriter, r *http.Request) {
    var body struct{
        SeedDomain string  `json:"seedDomain"`
        AccountId  *string `json:"accountId"`
        Days       *int    `json:"days"`
        Shard      *int    `json:"shard"`
        TotalShards *int   `json:"totalShards"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    seed := strings.TrimSpace(body.SeedDomain)
    if seed == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil); return }
    acct := ""; if body.AccountId != nil { acct = strings.TrimSpace(*body.AccountId) }
    days := 30; if body.Days != nil && *body.Days > 0 { days = *body.Days }
    shard := 0; if body.Shard != nil && *body.Shard >= 0 { shard = *body.Shard }
    total := 0; if body.TotalShards != nil && *body.TotalShards > 0 { total = *body.TotalShards }
    go func() {
        aliases := h.srv.getAliases(seed, "")
        // Pull keywords from BigQuery if enabled; else noop
        kws := []string{}
        if strings.EqualFold(strings.TrimSpace(os.Getenv("BQ_ENABLED")), "1") {
            if arr, err := fetchKeywordsFromBigQuery(context.Background(), days, 50000, acct); err == nil { kws = arr }
        }
        if total > 0 && shard < total {
            filtered := make([]string, 0, len(kws))
            for _, k := range kws { if fnvHash(k)%total == shard { filtered = append(filtered, k) } }
            kws = filtered
        }
        totalKw := len(kws)
        brandKw := 0
        aliasSet := map[string]struct{}{}
        for _, a := range aliases { a = normalize(a); if len(a) >= 3 { aliasSet[a] = struct{}{} } }
        coveredAlias := map[string]struct{}{}
        for _, k := range kws {
            norm := normalize(k)
            for a := range aliasSet { if strings.Contains(norm, a) { brandKw++; coveredAlias[a] = struct{}{}; break } }
        }
        missing := make([]string, 0)
        for a := range aliasSet { if _, ok := coveredAlias[a]; !ok { missing = append(missing, a) } }
        ratio := 0.0
        if totalKw > 0 { ratio = float64(brandKw) / float64(totalKw) }
        // persist
        if h.srv.db != nil {
            _ = h.srv.upsertCoverage(seed, acct, totalKw, brandKw, ratio, missing)
        }
    }()
    w.WriteHeader(http.StatusAccepted)
    _ = json.NewEncoder(w).Encode(map[string]any{"status":"accepted","seedDomain": seed, "accountId": acct, "days": days, "shard": shard, "totalShards": total})
}

// GET /recommend/keywords/brand-profile
func (h *oasImpl) GetBrandProfile(w http.ResponseWriter, r *http.Request, params api.GetBrandProfileParams) {
    seed := strings.TrimSpace(params.SeedDomain)
    if seed == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil); return }
    // try DB then cache compute
    var aliases []string
    var updated *time.Time
    if h.srv.db != nil {
        var jsonText sql.NullString
        var upd sql.NullTime
        _ = h.srv.db.QueryRow(`SELECT aliases::text, updated_at FROM brand_profile WHERE seed_domain=$1`, seed).Scan(&jsonText, &upd)
        if jsonText.Valid { _ = json.Unmarshal([]byte(jsonText.String), &aliases) }
        if upd.Valid { t := upd.Time; updated = &t }
    }
    if len(aliases) == 0 {
        aliases = h.srv.getAliases(seed, "")
        now := time.Now().UTC(); updated = &now
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"seedDomain": seed, "aliases": aliases, "updatedAt": updated})
}

// GET /recommend/keywords/brand-results
func (h *oasImpl) ListBrandResults(w http.ResponseWriter, r *http.Request, params api.ListBrandResultsParams) {
    seed := strings.TrimSpace(params.SeedDomain)
    if seed == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil); return }
    limit := 50
    if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 500 { limit = int(*params.Limit) }
    cursor := 0
    if params.Cursor != nil { if v, err := strconv.Atoi(strings.TrimSpace(*params.Cursor)); err == nil && v > 0 { cursor = v } }
    // require DB
    if h.srv.db == nil { _ = json.NewEncoder(w).Encode(map[string]any{"items": []any{}, "next": ""}); return }
    var rows *sql.Rows
    var err error
    // optional filters
    where := "seed_domain=$1"
    args := []any{seed}
    idx := 2
    if params.Severity != nil && *params.Severity != "" {
        where += fmt.Sprintf(" AND severity=$%d", idx)
        args = append(args, string(*params.Severity))
        idx++
    }
    if params.ContainsBrand != nil {
        where += fmt.Sprintf(" AND contains_brand=$%d", idx)
        args = append(args, *params.ContainsBrand)
        idx++
    }
    if cursor > 0 {
        where += fmt.Sprintf(" AND id < $%d", idx)
        args = append(args, cursor)
        idx++
    }
    q := fmt.Sprintf("SELECT id, keyword, contains_brand, COALESCE(matched_alias,''), COALESCE(method,''), COALESCE(score,0), severity FROM keyword_risk_results WHERE %s ORDER BY id DESC LIMIT $%d", where, idx)
    args = append(args, limit)
    rows, err = h.srv.db.Query(q, args...)
    if err != nil { apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    items := make([]api.BrandCheckItem, 0, limit)
    lastID := 0
    for rows.Next() {
        var id int
        var kw, matched, method, severity string
        var contains bool
        var score float64
        if err := rows.Scan(&id, &kw, &contains, &matched, &method, &score, &severity); err != nil { continue }
        it := api.BrandCheckItem{Keyword: kw, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(severity)}
        if strings.TrimSpace(matched) != "" { it.MatchedAlias = &matched }
        if score > 0 { s := float32(score); it.Score = &s }
        items = append(items, it)
        lastID = id
    }
    next := ""
    if len(items) == limit && lastID > 0 { next = strconv.Itoa(lastID) }
    _ = json.NewEncoder(w).Encode(map[string]any{"items": items, "next": next})
}

func fnvHash(s string) int {
    h := fnv.New32a()
    _, _ = h.Write([]byte(s))
    return int(h.Sum32())
}

func (s *Server) upsertCoverage(seed, account string, totalKw, brandKw int, ratio float64, missing []string) error {
    if s.db == nil { return nil }
    b, _ := json.Marshal(missing)
    _, _ = s.db.Exec(`
        CREATE TABLE IF NOT EXISTS brand_coverage_results (
          seed_domain TEXT NOT NULL,
          account_id  TEXT NOT NULL,
          total_keywords INT NOT NULL,
          brand_keywords INT NOT NULL,
          coverage_ratio DOUBLE PRECISION NOT NULL,
          missing_aliases JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (seed_domain, account_id)
        );`)
    _, err := s.db.Exec(`
        INSERT INTO brand_coverage_results(seed_domain, account_id, total_keywords, brand_keywords, coverage_ratio, missing_aliases, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())
        ON CONFLICT (seed_domain, account_id) DO UPDATE SET total_keywords=EXCLUDED.total_keywords, brand_keywords=EXCLUDED.brand_keywords, coverage_ratio=EXCLUDED.coverage_ratio, missing_aliases=EXCLUDED.missing_aliases, updated_at=NOW()
    `, seed, account, totalKw, brandKw, ratio, string(b))
    return err
}

// GET /recommend/brand-coverage
func (h *oasImpl) GetBrandCoverage(w http.ResponseWriter, r *http.Request, params api.GetBrandCoverageParams) {
    seed := strings.TrimSpace(params.SeedDomain)
    acct := strings.TrimSpace(params.AccountId)
    if seed == "" || acct == "" { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain & accountId required", nil); return }
    if h.srv.db == nil { apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil); return }
    var totalKw, brandKw int
    var ratio float64
    var missingTxt sql.NullString
    var updated sql.NullTime
    err := h.srv.db.QueryRow(`SELECT total_keywords, brand_keywords, coverage_ratio, missing_aliases::text, updated_at FROM brand_coverage_results WHERE seed_domain=$1 AND account_id=$2`, seed, acct).Scan(&totalKw, &brandKw, &ratio, &missingTxt, &updated)
    if err != nil {
        if err == sql.ErrNoRows { apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "coverage not found", nil); return }
        apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return
    }
    var missing []string
    if missingTxt.Valid { _ = json.Unmarshal([]byte(missingTxt.String), &missing) }
    resp := map[string]any{
        "seedDomain": seed,
        "accountId": acct,
        "totalKeywords": totalKw,
        "brandKeywords": brandKw,
        "coverageRatio": ratio,
        "missingAliases": missing,
        "updatedAt": func() *time.Time { if updated.Valid { t := updated.Time; return &t }; return nil }(),
    }
    _ = json.NewEncoder(w).Encode(resp)
}

// POST /recommend/brand-coverage/planned
func (h *oasImpl) GetPlannedBrandCoverage(w http.ResponseWriter, r *http.Request) {
    var body struct{
        SeedDomain string   `json:"seedDomain"`
        Keywords   []string `json:"keywords"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    seed := strings.TrimSpace(body.SeedDomain)
    if seed == "" || len(body.Keywords) == 0 { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain & keywords required", nil); return }
    aliases := h.srv.getAliases(seed, "")
    aliasSet := map[string]struct{}{}
    for _, a := range aliases { a = normalize(a); if len(a) >= 3 { aliasSet[a] = struct{}{} } }
    totalKw := 0
    brandKw := 0
    coveredAlias := map[string]struct{}{}
    for _, k := range body.Keywords {
        k = strings.TrimSpace(k); if k == "" { continue }
        totalKw++
        norm := normalize(k)
        for a := range aliasSet { if strings.Contains(norm, a) { brandKw++; coveredAlias[a] = struct{}{}; break } }
    }
    missing := make([]string, 0)
    for a := range aliasSet { if _, ok := coveredAlias[a]; !ok { missing = append(missing, a) } }
    ratio := 0.0
    if totalKw > 0 { ratio = float64(brandKw) / float64(totalKw) }
    resp := map[string]any{
        "seedDomain": seed,
        "totalKeywords": totalKw,
        "brandKeywords": brandKw,
        "coverageRatio": ratio,
        "missingAliases": missing,
        "updatedAt": time.Now().UTC(),
    }
    _ = json.NewEncoder(w).Encode(resp)
}

func envInt(k string, def int) int {
    if v := strings.TrimSpace(os.Getenv(k)); v != "" { if n, err := strconv.Atoi(v); err == nil { return n } }
    return def
}
func envFloat(k string, def float64) float64 {
    if v := strings.TrimSpace(os.Getenv(k)); v != "" { if f, err := strconv.ParseFloat(v, 64); err == nil { return f } }
    return def
}

// --- helpers ---
func (s *Server) getAliases(seedDomain, landingURL string) []string {
    key := strings.ToLower(strings.TrimSpace(seedDomain)) + "|" + strings.ToLower(strings.TrimSpace(landingURL))
    if ent, ok := s.cache[key]; ok && time.Now().Before(ent.exp) { return ent.aliases }
    brand := extractBrandFromDomain(seedDomain)
    aliases := buildAliases(brand)
    // Optional landing page signals
    if u := strings.TrimSpace(landingURL); u != "" {
        if titles := fetchLandingSignals(u, 1200*time.Millisecond); len(titles) > 0 {
            for _, t := range titles { aliases = append(aliases, buildAliases(t)...)}
        }
    } else {
        // Try homepage
        guess := func(sd string) string {
            sd = strings.ToLower(strings.TrimSpace(sd))
            if strings.HasPrefix(sd, "http://") || strings.HasPrefix(sd, "https://") { return sd }
            return "https://" + sd
        }(seedDomain)
        if titles := fetchLandingSignals(guess, 800*time.Millisecond); len(titles) > 0 {
            for _, t := range titles { aliases = append(aliases, buildAliases(t)...)}
        }
    }
    // dedupe
    m := map[string]struct{}{}
    out := make([]string, 0, len(aliases))
    for _, a := range aliases { a = normalize(a); if len(a) >= 3 { if _, ok := m[a]; !ok { m[a] = struct{}{}; out = append(out, a) } } }
    s.cache[key] = aliasCache{aliases: out, exp: time.Now().Add(7 * 24 * time.Hour)}
    return out
}

func fetchLandingSignals(u string, timeout time.Duration) []string {
    // Try browser-exec page-signals first
    if be := strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")); be != "" {
        type reqT struct{ URL string `json:"url"`; Timeout int `json:"timeoutMs"` }
        body, _ := json.Marshal(reqT{URL: u, Timeout: int(timeout / time.Millisecond)})
        c := &http.Client{Timeout: timeout}
        req, _ := http.NewRequest("POST", strings.TrimRight(be, "/")+"/api/v1/browser/page-signals", strings.NewReader(string(body)))
        req.Header.Set("Content-Type", "application/json")
        if tok := strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")); tok != "" { req.Header.Set("Authorization", "Bearer "+tok) }
        if resp, err := c.Do(req); err == nil && resp != nil {
            defer resp.Body.Close()
            var out struct{ Title string `json:"title"`; SiteName string `json:"siteName"` }
            if err := json.NewDecoder(resp.Body).Decode(&out); err == nil {
                arr := make([]string, 0, 2)
                if strings.TrimSpace(out.Title) != "" { arr = append(arr, out.Title) }
                if strings.TrimSpace(out.SiteName) != "" { arr = append(arr, out.SiteName) }
                if len(arr) > 0 { return arr }
            }
        }
    }
    // naive HTML fetcher: title and og:site_name
    // safe-guard: only http/https
    if pu, err := url.Parse(u); err != nil || (pu.Scheme != "http" && pu.Scheme != "https") {
        return nil
    }
    c := &http.Client{Timeout: timeout}
    req, _ := http.NewRequest("GET", u, nil)
    req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; RecoBot/1.0)")
    resp, err := c.Do(req)
    if err != nil { return nil }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 400 { return nil }
    // limit read
    body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
    html := strings.ToLower(string(body))
    titles := make([]string, 0, 2)
    // extract <title>
    if i := strings.Index(html, "<title>"); i >= 0 {
        if j := strings.Index(html[i+7:], "</title>"); j > 0 {
            t := body[i+7 : i+7+j]
            titles = append(titles, string(t))
        }
    }
    // extract og:site_name
    // very naive: content="..."
    if i := strings.Index(html, "property=\"og:site_name\""); i >= 0 {
        seg := html[i:]
        if k := strings.Index(seg, "content="); k >= 0 {
            tail := seg[k+8:]
            // strip leading quotes and capture until next quote
            tail = strings.TrimLeft(tail, " \t'\"")
            end := strings.IndexAny(tail, "'\"")
            if end > 0 { titles = append(titles, tail[:end]) }
        }
    }
    return titles
}

func extractBrandFromDomain(seed string) string {
    seed = strings.ToLower(strings.TrimSpace(seed))
    seed = strings.TrimPrefix(seed, "http://")
    seed = strings.TrimPrefix(seed, "https://")
    if i := strings.Index(seed, "/"); i >= 0 { seed = seed[:i] }
    host := seed
    parts := strings.Split(host, ".")
    if len(parts) >= 2 {
        // handle co.uk like TLDs
        tld := parts[len(parts)-1]
        sld := parts[len(parts)-2]
        if len(parts) >= 3 && (tld == "uk" && (sld == "co" || sld == "ac")) {
            sld = parts[len(parts)-3]
        }
        host = sld
    }
    host = strings.ReplaceAll(host, "-", " ")
    host = normalize(host)
    tokens := strings.Fields(host)
    if len(tokens) > 0 { return tokens[0] }
    return host
}

func buildAliases(brand string) []string {
    base := normalize(brand)
    if base == "" { return nil }
    aliases := map[string]struct{}{}
    add := func(s string) { s = normalize(s); if len(s) >= 3 { aliases[s] = struct{}{} } }
    add(base)
    add(strings.ReplaceAll(base, " ", ""))
    // remove vowels variant for long words
    vowRe := regexp.MustCompile(`[aeiou]`)
    if len(base) >= 5 { add(vowRe.ReplaceAllString(base, "")) }
    out := make([]string, 0, len(aliases))
    for k := range aliases { out = append(out, k) }
    return out
}

func normalize(s string) string {
    s = strings.ToLower(s)
    // keep letters, numbers and spaces
    b := make([]rune, 0, len(s))
    for _, r := range s {
        if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
            b = append(b, r)
        } else if r == '-' || r == '_' {
            b = append(b, ' ')
        }
    }
    // collapse spaces
    out := strings.Join(strings.Fields(string(b)), " ")
    return out
}

func matchBrand(keyword string, aliases []string) (contains bool, matched, method string, score float64) {
    if keyword == "" || len(aliases) == 0 { return false, "", "none", 0 }
    k := keyword
    for _, a := range aliases {
        if len(a) < 3 { continue }
        if strings.Contains(k, a) {
            return true, a, "exact", 1.0
        }
    }
    // fuzzy via bigram Jaccard
    kg := ngrams(k, 2)
    best := 0.0
    bestA := ""
    for _, a := range aliases {
        ag := ngrams(a, 2)
        j := jaccard(kg, ag)
        if j > best { best = j; bestA = a }
    }
    if best >= 0.6 {
        return true, bestA, "fuzzy", best
    }
    return false, "", "none", best
}

func ngrams(s string, n int) map[string]struct{} {
    s = strings.ReplaceAll(s, " ", "")
    if len(s) < n { return map[string]struct{}{} }
    m := map[string]struct{}{}
    for i := 0; i <= len(s)-n; i++ {
        m[s[i:i+n]] = struct{}{}
    }
    return m
}

func jaccard(a, b map[string]struct{}) float64 {
    if len(a) == 0 || len(b) == 0 { return 0 }
    inter := 0
    for k := range a { if _, ok := b[k]; ok { inter++ } }
    union := len(a) + len(b) - inter
    if union <= 0 { return 0 }
    return float64(inter) / float64(union)
}

// --- persistence (best-effort) ---
func ensureDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS brand_profile (
  seed_domain TEXT PRIMARY KEY,
  aliases     JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS keyword_risk_results (
  id            BIGSERIAL PRIMARY KEY,
  seed_domain   TEXT NOT NULL,
  keyword       TEXT NOT NULL,
  contains_brand BOOLEAN NOT NULL,
  matched_alias TEXT,
  method        TEXT,
  score         DOUBLE PRECISION,
  severity      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_keyword_risk_results_seed_created ON keyword_risk_results(seed_domain, created_at DESC);
`
    _, err := db.Exec(ddl)
    return err
}

func (s *Server) persistResults(seed string, aliases []string, items []api.BrandCheckItem) {
    if s.db == nil { return }
    ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
    defer cancel()
    // upsert brand_profile
    b, _ := json.Marshal(aliases)
    _, _ = s.db.ExecContext(ctx, `
        INSERT INTO brand_profile(seed_domain, aliases, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (seed_domain) DO UPDATE SET aliases=EXCLUDED.aliases, updated_at=NOW()
    `, seed, string(b))
    // insert keyword risk results
    for _, it := range items {
        var matched, method *string
        var score *float64
        if it.MatchedAlias != nil { matched = it.MatchedAlias }
        if it.Method != "" { m := string(it.Method); method = &m }
        if it.Score != nil { v := float64(*it.Score); score = &v }
        _, _ = s.db.ExecContext(ctx, `
            INSERT INTO keyword_risk_results(seed_domain, keyword, contains_brand, matched_alias, method, score, severity)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, seed, it.Keyword, it.ContainsBrand, matched, method, score, string(it.Severity))
    }
}

func (s *Server) maybeWriteFirestore(ctx context.Context, uid, seed string, items []api.BrandCheckItem) {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return }
    pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if pid == "" { pid = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if pid == "" || uid == "" { return }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, pid)
    if err != nil { return }
    defer cli.Close()
    // users/{uid}/recommendations/brand-check/{seed}
    doc := map[string]any{
        "seedDomain": seed,
        "updatedAt": time.Now().UTC(),
        "items": items,
    }
    _, _ = cli.Collection("users/"+uid+"/recommendations/brand-check").Doc(seed).Set(cctx, doc)
}

// --- BigQuery integration (optional) ---
func fetchKeywordsFromBigQuery(ctx context.Context, days, limit int, accountID string) ([]string, error) {
    pid := strings.TrimSpace(os.Getenv("BQ_PROJECT_ID"))
    dataset := strings.TrimSpace(os.Getenv("BQ_DATASET"))
    table := strings.TrimSpace(os.Getenv("BQ_TABLE"))
    if pid == "" || dataset == "" || table == "" { return nil,  fmt.Errorf("bq not configured") }
    client, err := bigquery.NewClient(ctx, pid)
    if err != nil { return nil, err }
    defer client.Close()
    // Generic query for export tables that contain keyword text
    // Expect a column named 'keyword_text' or 'text'. Adjust via env if needed.
    col := strings.TrimSpace(os.Getenv("BQ_KEYWORD_COL"))
    if col == "" {
        col = strings.TrimSpace(os.Getenv("BQ_SEARCH_TERM_COL"))
    }
    if col == "" { col = "keyword_text" }
    dateField := strings.TrimSpace(os.Getenv("BQ_DATE_FIELD"))
    if dateField == "" { dateField = "_PARTITIONDATE" }
    qstr := fmt.Sprintf("SELECT DISTINCT LOWER(%s) AS k FROM `%s.%s.%s` WHERE %s >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY) ", col, pid, dataset, table, dateField)
    if accountID != "" { qstr += " AND customer_id = @customer_id " }
    qstr += " LIMIT @limit"
    q := client.Query(qstr)
    q.Parameters = []bigquery.QueryParameter{
        {Name: "days", Value: days},
        {Name: "limit", Value: limit},
    }
    if accountID != "" { q.Parameters = append(q.Parameters, bigquery.QueryParameter{Name:"customer_id", Value: accountID}) }
    it, err := q.Read(ctx)
    if err != nil { return nil, err }
    out := make([]string, 0, limit)
    for {
        var v []bigquery.Value
        err := it.Next(&v)
        if err == iterator.Done { break }
        if err != nil { return out, nil }
        if len(v) > 0 { if s, ok := v[0].(string); ok && strings.TrimSpace(s) != "" { out = append(out, s) } }
        if len(out) >= limit { break }
    }
    return out, nil
}
