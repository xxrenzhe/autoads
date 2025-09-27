//go:build ads_live

package executor

import (
    "bytes"
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "net/http"
    "strings"
    "time"

    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
)

type Action struct {
    Type   string                 `json:"type"`
    Params map[string]interface{} `json:"params,omitempty"`
    Filter map[string]interface{} `json:"filter,omitempty"`
}

type Result struct {
    Success bool                   `json:"success"`
    Message string                 `json:"message,omitempty"`
    Details map[string]interface{} `json:"details,omitempty"`
}

type Config struct {
    BrowserExecURL     string
    InternalToken      string
    Timeout            time.Duration
    ValidateOnly       bool
    LiveMutate         bool
    DeveloperToken     string
    OAuthClientID      string
    OAuthClientSecret  string
    RefreshToken       string
    LoginCustomerID    string
    CustomerID         string
}

type Executor struct{ cfg Config; http *httpx.Client }

func New(cfg Config) *Executor {
    if cfg.Timeout <= 0 { cfg.Timeout = 6 * time.Second }
    return &Executor{cfg: cfg, http: httpx.New(cfg.Timeout)}
}

func (e *Executor) ExecuteOne(ctx context.Context, a Action) (Result, error) {
    t := strings.ToUpper(strings.TrimSpace(a.Type))
    switch t {
    case "ADJUST_CPC":
        return e.adjustCPC(ctx, a)
    case "ADJUST_BUDGET":
        return e.adjustBudget(ctx, a)
    case "ROTATE_LINK":
        // reuse stub browser-exec resolve for now
        return (&Executor{cfg: Config{BrowserExecURL: e.cfg.BrowserExecURL, InternalToken: e.cfg.InternalToken, Timeout: e.cfg.Timeout, ValidateOnly: e.cfg.ValidateOnly}}).rotateLink(ctx, a)
    default:
        return Result{Success: false, Message: "unsupported action"}, errors.New("unsupported action")
    }
}

func (e *Executor) tokenSource(ctx context.Context) oauth2.TokenSource {
    conf := &oauth2.Config{ClientID: e.cfg.OAuthClientID, ClientSecret: e.cfg.OAuthClientSecret, Endpoint: google.Endpoint, Scopes: []string{"https://www.googleapis.com/auth/adwords"}}
    return conf.TokenSource(ctx, &oauth2.Token{RefreshToken: e.cfg.RefreshToken})
}

func (e *Executor) authHeaders(ctx context.Context) (http.Header, error) {
    tok, err := e.tokenSource(ctx).Token()
    if err != nil { return nil, err }
    h := http.Header{}
    h.Set("Authorization", "Bearer "+tok.AccessToken)
    h.Set("developer-token", e.cfg.DeveloperToken)
    if e.cfg.LoginCustomerID != "" { h.Set("login-customer-id", e.cfg.LoginCustomerID) }
    h.Set("Content-Type", "application/json")
    return h, nil
}

func (e *Executor) adjustCPC(ctx context.Context, a Action) (Result, error) {
    // Use validate-only mutate to verify structure/permission first
    if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
        return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
    }
    // Build mutate operations from params
    // Expect: params.targetResourceNames: []string of adGroupCriteria resource names
    //         params.cpcMicros: int (new CPC in micros)
    var targets []string
    if v, ok := a.Params["targetResourceNames"].([]interface{}); ok {
        for _, it := range v { if s, ok := it.(string); ok && strings.TrimSpace(s) != "" { targets = append(targets, s) } }
    }
    if len(targets) == 0 { return Result{Success: true, Message: "validateOnly mutate skipped: no targets"}, nil }
    cpcMicros := int64(0)
    switch vv := a.Params["cpcMicros"].(type) {
    case float64: cpcMicros = int64(vv)
    case int64: cpcMicros = vv
    case int: cpcMicros = int64(vv)
    }
    if cpcMicros <= 0 {
        return Result{Success: true, Message: "validateOnly mutate skipped: cpcMicros missing/<=0"}, nil
    }
    ops := make([]map[string]any, 0, len(targets))
    for _, rn := range targets {
        upd := map[string]any{"resourceName": rn, "cpcBidMicros": cpcMicros}
        ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"update": upd, "updateMask": "cpc_bid_micros"}})
    }
    // validateOnly unless LiveMutate 且未显式 ValidateOnly
    validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
    details := map[string]any{"targets": targets, "cpcMicros": cpcMicros}
    // best-effort before/after fetch when live mutate
    if !validateOnly {
        before, _ := e.fetchCriterionCPC(ctx, targets)
        if before != nil { details["before"] = before }
        res, err := e.mutate(ctx, ops, false)
        if err != nil { return Result{Success: false, Message: res.Message, Details: details}, err }
        after, _ := e.fetchCriterionCPC(ctx, targets)
        if after != nil { details["after"] = after }
        return Result{Success: true, Message: "mutate ok", Details: details}, nil
    }
    res, err := e.mutate(ctx, ops, true)
    res.Details = details
    return res, err
}

func (e *Executor) adjustBudget(ctx context.Context, a Action) (Result, error) {
    if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
        return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
    }
    // params.campaignBudgetResourceNames: []string, params.amountMicros: int64
    var targets []string
    if v, ok := a.Params["campaignBudgetResourceNames"].([]interface{}); ok {
        for _, it := range v { if s, ok := it.(string); ok && strings.TrimSpace(s) != "" { targets = append(targets, s) } }
    }
    if len(targets) == 0 { return Result{Success: true, Message: "validateOnly mutate skipped: no budgets"}, nil }
    amt := int64(0)
    switch vv := a.Params["amountMicros"].(type) {
    case float64: amt = int64(vv)
    case int64: amt = vv
    case int: amt = int64(vv)
    }
    if amt <= 0 { return Result{Success: true, Message: "validateOnly mutate skipped: amountMicros missing/<=0"}, nil }
    ops := make([]map[string]any, 0, len(targets))
    for _, rn := range targets {
        upd := map[string]any{"resourceName": rn, "amountMicros": amt}
        ops = append(ops, map[string]any{"campaignBudgetOperation": map[string]any{"update": upd, "updateMask": "amount_micros"}})
    }
    validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
    details := map[string]any{"targets": targets, "amountMicros": amt}
    if !validateOnly {
        before, _ := e.fetchBudgetAmounts(ctx, targets)
        if before != nil { details["before"] = before }
        res, err := e.mutate(ctx, ops, false)
        if err != nil { return Result{Success: false, Message: res.Message, Details: details}, err }
        after, _ := e.fetchBudgetAmounts(ctx, targets)
        if after != nil { details["after"] = after }
        return Result{Success: true, Message: "mutate ok", Details: details}, nil
    }
    res, err := e.mutate(ctx, ops, true)
    res.Details = details
    return res, err
}

// rotateLink uses stub path (browser-exec) until mutate path implemented.
func (e *Executor) rotateLink(ctx context.Context, a Action) (Result, error) {
    // Determine suffix
    suffix := ""
    if s, ok := a.Params["finalUrlSuffix"].(string); ok { suffix = strings.TrimSpace(s) }
    // If suffix not provided, try resolve via browser-exec using links/targetDomain
    if suffix == "" {
        var url string
        if v, ok := a.Params["links"].([]interface{}); ok && len(v) > 0 { if s0, ok2 := v[0].(string); ok2 { url = strings.TrimSpace(s0) } }
        if url == "" { if s0, ok := a.Params["targetDomain"].(string); ok { url = strings.TrimSpace(s0) } }
        if url != "" && strings.TrimSpace(e.cfg.BrowserExecURL) != "" {
            be := strings.TrimRight(e.cfg.BrowserExecURL, "/")
            body := map[string]interface{}{"url": url, "timeoutMs": int(e.cfg.Timeout / time.Millisecond)}
            hdr := map[string]string{}
            if e.cfg.InternalToken != "" { hdr["Authorization"] = "Bearer "+e.cfg.InternalToken }
            out := map[string]interface{}{}
            if err := e.http.DoJSON(ctx, http.MethodPost, be+"/api/v1/browser/resolve-offer", body, hdr, 1, &out); err == nil {
                if v, ok := out["finalUrlSuffix"].(string); ok { suffix = strings.TrimSpace(v) }
            }
        }
        if suffix == "" { suffix = time.Now().UTC().Format("20060102150405") }
    }
    // Targets: adGroupAd resource names
    var targets []string
    if v, ok := a.Params["adResourceNames"].([]interface{}); ok {
        for _, it := range v { if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" { targets = append(targets, s) } }
    }
    details := map[string]any{"suffix": suffix, "targets": targets}
    if len(targets) == 0 {
        return Result{Success: true, Message: "validateOnly mutate skipped: no targets", Details: details}, nil
    }
    // Build operations
    ops := make([]map[string]any, 0, len(targets))
    for _, rn := range targets {
        upd := map[string]any{"resourceName": rn, "ad": map[string]any{"finalUrlSuffix": suffix}}
        ops = append(ops, map[string]any{"adGroupAdOperation": map[string]any{"update": upd, "updateMask": "ad.final_url_suffix"}})
    }
    validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
    if !validateOnly {
        before, _ := e.fetchAdFinalSuffix(ctx, targets)
        if before != nil { details["before"] = before }
        res, err := e.mutate(ctx, ops, false)
        if err != nil { return Result{Success: false, Message: res.Message, Details: details}, err }
        after, _ := e.fetchAdFinalSuffix(ctx, targets)
        if after != nil { details["after"] = after }
        return Result{Success: true, Message: "mutate ok", Details: details}, nil
    }
    res, err := e.mutate(ctx, ops, true)
    res.Details = details
    return res, err
}

func (e *Executor) mutate(ctx context.Context, ops []map[string]any, validateOnly bool) (Result, error) {
    if len(ops) == 0 { return Result{Success: true, Message: "no-op"}, nil }
    url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:mutate", e.cfg.CustomerID)
    body := map[string]any{"validateOnly": validateOnly, "mutateOperations": ops}
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
    hdr, err := e.authHeaders(ctx)
    if err != nil { return Result{Success: false, Message: err.Error()}, err }
    req.Header = hdr
    resp, err := e.http.Do(req)
    if err != nil { return Result{Success: false, Message: err.Error()}, err }
    defer resp.Body.Close()
    var out map[string]any
    _ = json.NewDecoder(resp.Body).Decode(&out)
    if resp.StatusCode >= 400 { return Result{Success: false, Message: fmt.Sprintf("mutate http %d", resp.StatusCode), Details: out}, errors.New("mutate failed") }
    return Result{Success: true, Message: "validateOnly mutate ok", Details: out}, nil
}

func (e *Executor) fetchCriterionCPC(ctx context.Context, rns []string) (map[string]int64, error) {
    if len(rns) == 0 { return nil, nil }
    // Build IN clause for GAQL
    b := strings.Builder{}
    b.WriteString("SELECT ad_group_criterion.resource_name, ad_group_criterion.cpc_bid_micros FROM ad_group_criterion WHERE ad_group_criterion.resource_name IN (")
    for i, rn := range rns {
        if i > 0 { b.WriteString(", ") }
        b.WriteString("'" + rn + "'")
    }
    b.WriteString(") LIMIT ")
    b.WriteString(fmt.Sprintf("%d", len(rns)))
    rows, err := e.searchStream(ctx, b.String())
    if err != nil { return nil, err }
    out := map[string]int64{}
    for _, row := range rows {
        if res, ok := row["adGroupCriterion"].(map[string]any); ok {
            rn, _ := res["resourceName"].(string)
            switch v := res["cpcBidMicros"].(type) {
            case float64: out[rn] = int64(v)
            case int64: out[rn] = v
            }
        }
    }
    return out, nil
}

func (e *Executor) fetchBudgetAmounts(ctx context.Context, rns []string) (map[string]int64, error) {
    if len(rns) == 0 { return nil, nil }
    b := strings.Builder{}
    b.WriteString("SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign_budget WHERE campaign_budget.resource_name IN (")
    for i, rn := range rns {
        if i > 0 { b.WriteString(", ") }
        b.WriteString("'" + rn + "'")
    }
    b.WriteString(") LIMIT ")
    b.WriteString(fmt.Sprintf("%d", len(rns)))
    rows, err := e.searchStream(ctx, b.String())
    if err != nil { return nil, err }
    out := map[string]int64{}
    for _, row := range rows {
        if res, ok := row["campaignBudget"].(map[string]any); ok {
            rn, _ := res["resourceName"].(string)
            switch v := res["amountMicros"].(type) {
            case float64: out[rn] = int64(v)
            case int64: out[rn] = v
            }
        }
    }
    return out, nil
}

func (e *Executor) searchStream(ctx context.Context, query string) ([]map[string]any, error) {
    url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", e.cfg.CustomerID)
    body := map[string]any{"query": query}
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
    hdr, err := e.authHeaders(ctx)
    if err != nil { return nil, err }
    req.Header = hdr
    resp, err := e.http.Do(req)
    if err != nil { return nil, err }
    defer resp.Body.Close()
    if resp.StatusCode >= 400 { return nil, fmt.Errorf("searchStream http %d", resp.StatusCode) }
    // searchStream returns JSON array of chunks
    var arr []map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&arr); err != nil { return nil, err }
    rows := make([]map[string]any, 0, len(arr))
    for _, chunk := range arr {
        if results, ok := chunk["results"].([]any); ok {
            for _, r := range results { if m, ok := r.(map[string]any); ok { rows = append(rows, m) } }
        }
    }
    return rows, nil
}

func (e *Executor) fetchAdFinalSuffix(ctx context.Context, rns []string) (map[string]string, error) {
    if len(rns) == 0 { return nil, nil }
    b := strings.Builder{}
    b.WriteString("SELECT ad_group_ad.resource_name, ad.final_url_suffix FROM ad_group_ad WHERE ad_group_ad.resource_name IN (")
    for i, rn := range rns { if i > 0 { b.WriteString(", ") }; b.WriteString("'" + rn + "'") }
    b.WriteString(") LIMIT ")
    b.WriteString(fmt.Sprintf("%d", len(rns)))
    rows, err := e.searchStream(ctx, b.String())
    if err != nil { return nil, err }
    out := map[string]string{}
    for _, row := range rows {
        if res, ok := row["adGroupAd"].(map[string]any); ok {
            rn, _ := res["resourceName"].(string)
            if ad, ok2 := row["ad"].(map[string]any); ok2 {
                if s, ok3 := ad["finalUrlSuffix"].(string); ok3 { out[rn] = s }
            }
        }
    }
    return out, nil
}
