package main

import (
    "encoding/json"
    "context"
    "log"
    "net/http"
    "os"
    "time"
    "strings"
    neturl "net/url"

    "github.com/xxrenzhe/autoads/services/adscenter/internal/auth"
    adscfg "github.com/xxrenzhe/autoads/services/adscenter/internal/config"
    "github.com/xxrenzhe/autoads/services/adscenter/internal/preflight"
    adsstub "github.com/xxrenzhe/autoads/services/adscenter/internal/ads"
    "github.com/xxrenzhe/autoads/services/adscenter/internal/storage"
    adsconfig "github.com/xxrenzhe/autoads/services/adscenter/internal/config"
    "database/sql"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
    tokencrypto "github.com/xxrenzhe/autoads/services/adscenter/internal/crypto"
)

type PreflightRequest struct {
    AccountID string `json:"accountId"`
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

// accountsHandler returns the list of accessible customer resource names for the current user.
func (s *Server) accountsHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    ctx := r.Context()
    // Load platform-level Ads config (developer token + oauth client)
    cfgAds, _ := adscfg.LoadAdsCreds(ctx)
    // Fetch user-level refresh token
    tokenEnc, _, _, err := storage.GetUserRefreshToken(ctx, s.db, uid)
    if err != nil || strings.TrimSpace(tokenEnc) == "" {
        http.Error(w, "missing user refresh token", http.StatusBadRequest); return
    }
    // Decrypt (with rotation)
    var userRT string
    if pt, ok := decryptWithRotation(tokenEnc); ok { userRT = pt } else {
        if os.Getenv("REFRESH_TOKEN_ENC_KEY_B64") != "" || os.Getenv("REFRESH_TOKEN_ENC_KEY_B64_OLD") != "" {
            http.Error(w, "failed to decrypt refresh token", http.StatusInternalServerError); return
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
    if err != nil { http.Error(w, "init ads client failed", http.StatusInternalServerError); return }
    defer live.Close()
    names, err := live.ListAccessibleCustomers(ctx)
    if err != nil { http.Error(w, "list accessible failed: "+err.Error(), http.StatusBadRequest); return }
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
}

func (s *Server) preflightHandler(w http.ResponseWriter, r *http.Request) {
    // Require authenticated user (Firebase)
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    var req PreflightRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }
    ctx := r.Context()
    creds, _ := adscfg.LoadAdsCreds(ctx)
    flags := adscfg.LoadPrecheckFlags()

    // Strong requirement: user-level refresh token must exist
    tokenEnc, loginCID, _, err := storage.GetUserRefreshToken(ctx, s.db, uid)
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

    // Optional live client (stub by default)
    var client preflight.LiveClient
    if flags.EnableLive {
        // By default, use stub; live implementation provided under build tag 'ads_live'
        client = adsstub.NewClientStub()
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
    }, flags.EnableLive, client)

    // Backward compatible response shape
    legacyChecks := make([]PreflightCheck, 0, len(result.Checks))
    for _, c := range result.Checks {
        status := string(c.Severity)
        if status == "skip" { status = "warn" }
        legacyChecks = append(legacyChecks, PreflightCheck{Name: c.Code, Status: status, Detail: c.Message})
    }
    writeJSON(w, http.StatusOK, PreflightResponse{Summary: result.Summary, Checks: legacyChecks})
}

// --- OAuth URL & Callback ---

func (s *Server) oauthURLHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    cfg, _ := adscfg.LoadAdsCreds(r.Context())
    redirect := chooseRedirectURL(r)
    if redirect == "" { http.Error(w, "server not configured: ADS_OAUTH_REDIRECT_URL(S)", http.StatusInternalServerError); return }
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
    if code == "" || state == "" { http.Error(w, "invalid callback params", http.StatusBadRequest); return }
    uid, ok := verifyState(state)
    if !ok || uid == "" { http.Error(w, "invalid state", http.StatusBadRequest); return }

    creds, _ := adscfg.LoadAdsCreds(ctx)
    redirect := chooseRedirectURL(r)
    if redirect == "" { http.Error(w, "server not configured", http.StatusInternalServerError); return }
    oc := &oauth2.Config{
        ClientID: creds.OAuthClientID,
        ClientSecret: creds.OAuthClientSecret,
        Endpoint: google.Endpoint,
        Scopes: []string{"https://www.googleapis.com/auth/adwords"},
        RedirectURL: redirect,
    }
    tok, err := oc.Exchange(ctx, code)
    if err != nil { http.Error(w, "exchange failed", http.StatusBadRequest); return }
    if tok.RefreshToken == "" { http.Error(w, "no refresh token returned", http.StatusBadRequest); return }

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

// --- MCC Binding Stubs ---
func (s *Server) mccLinkHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    var req struct{ CustomerID string `json:"customerId"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if strings.TrimSpace(req.CustomerID) == "" { http.Error(w, "customerId required", http.StatusBadRequest); return }
    if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_ENABLE_LIVE")), "true") {
        cfg, _ := adscfg.LoadAdsCreds(r.Context())
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken: cfg.DeveloperToken,
            OAuthClientID: cfg.OAuthClientID,
            OAuthClientSecret: cfg.OAuthClientSecret,
            RefreshToken: cfg.RefreshToken, // platform-level
            LoginCustomerID: cfg.LoginCustomerID,
        })
        if err != nil {
            http.Error(w, "init manager client failed", http.StatusInternalServerError); return
        }
        if err := client.SendManagerLinkInvitation(r.Context(), req.CustomerID); err != nil {
            http.Error(w, "send invitation failed: "+err.Error(), http.StatusBadRequest); return
        }
        _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "message": "invitation sent", "userId": uid, "customerId": req.CustomerID})
        return
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "queued", "message": "stub: invitation requested", "userId": uid, "customerId": req.CustomerID})
}
func (s *Server) mccStatusHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    customerID := r.URL.Query().Get("customerId")
    if strings.TrimSpace(customerID) == "" { http.Error(w, "customerId required", http.StatusBadRequest); return }
    if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_ENABLE_LIVE")), "true") {
        cfg, _ := adscfg.LoadAdsCreds(r.Context())
        client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
            DeveloperToken: cfg.DeveloperToken,
            OAuthClientID: cfg.OAuthClientID,
            OAuthClientSecret: cfg.OAuthClientSecret,
            RefreshToken: cfg.RefreshToken, // platform-level
            LoginCustomerID: cfg.LoginCustomerID,
        })
        if err != nil { http.Error(w, "init manager client failed", http.StatusInternalServerError); return }
        sVal, err := client.GetManagerLinkStatus(r.Context(), customerID)
        if err != nil { http.Error(w, "status failed: "+err.Error(), http.StatusBadRequest); return }
        _ = json.NewEncoder(w).Encode(map[string]any{"customerId": customerID, "status": sVal, "userId": uid})
        return
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"customerId": customerID, "status": "pending", "message": "stub", "userId": uid})
}
func (s *Server) mccUnlinkHandler(w http.ResponseWriter, r *http.Request) {
    uidRaw := r.Context().Value(auth.UserIDContextKey)
    uid, _ := uidRaw.(string)
    if uid == "" { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    var req struct{ CustomerID string `json:"customerId"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if strings.TrimSpace(req.CustomerID) == "" { http.Error(w, "customerId required", http.StatusBadRequest); return }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "queued", "message": "stub: unlink requested", "userId": uid, "customerId": req.CustomerID})
}

func bulkActionsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    writeJSON(w, http.StatusAccepted, map[string]string{"status": "queued"})
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
    cfg, err := adsconfig.Load(ctx)
    if err != nil { log.Fatalf("config load: %v", err) }
    if err := runMigrations(cfg.DatabaseURL); err != nil { log.Fatalf("migrations: %v", err) }
    db, err := storage.NewDB(cfg.DatabaseURL)
    if err != nil { log.Fatalf("db: %v", err) }
    defer db.Close()

    srv := &Server{db: db}
    authClient := auth.NewClient(ctx)
    mux := http.NewServeMux()
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.Handle("/api/v1/adscenter/accounts", authClient.Middleware(http.HandlerFunc(srv.accountsHandler)))
    mux.Handle("/api/v1/adscenter/preflight", authClient.Middleware(http.HandlerFunc(srv.preflightHandler)))
    mux.Handle("/api/v1/adscenter/oauth/url", authClient.Middleware(http.HandlerFunc(srv.oauthURLHandler)))
    mux.HandleFunc("/api/v1/adscenter/oauth/callback", srv.oauthCallbackHandler) // callback need not be auth-protected
    mux.Handle("/api/v1/adscenter/bulk-actions", authClient.Middleware(http.HandlerFunc(bulkActionsHandler)))
    // MCC binding stubs
    mux.Handle("/api/v1/adscenter/mcc/link", authClient.Middleware(http.HandlerFunc(srv.mccLinkHandler)))
    mux.Handle("/api/v1/adscenter/mcc/status", authClient.Middleware(http.HandlerFunc(srv.mccStatusHandler)))
    mux.Handle("/api/v1/adscenter/mcc/unlink", authClient.Middleware(http.HandlerFunc(srv.mccUnlinkHandler)))

    port := cfg.Port
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, mux); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
