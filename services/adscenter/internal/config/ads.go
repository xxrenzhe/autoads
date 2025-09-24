package config

import (
    "context"
    "os"
    "strings"
    "strconv"

    "github.com/xxrenzhe/autoads/services/adscenter/internal/secrets"
)

type AdsCreds struct {
    DeveloperToken   string
    OAuthClientID    string
    OAuthClientSecret string
    RefreshToken     string
    LoginCustomerID  string
    TestCustomerID   string
}

// LoadAdsCreds loads Google Ads credentials from environment variables
// or, if provided, from Secret Manager using corresponding *_SECRET_NAME envs.
// Secret-name envs: GOOGLE_ADS_DEVELOPER_TOKEN_SECRET_NAME, GOOGLE_ADS_OAUTH_CLIENT_ID_SECRET_NAME,
// GOOGLE_ADS_OAUTH_CLIENT_SECRET_SECRET_NAME, GOOGLE_ADS_REFRESH_TOKEN_SECRET_NAME,
// GOOGLE_ADS_LOGIN_CUSTOMER_ID_SECRET_NAME, GOOGLE_ADS_TEST_CUSTOMER_ID_SECRET_NAME
func LoadAdsCreds(ctx context.Context) (*AdsCreds, error) {
    get := func(key, secretNameKey string) (string, error) {
        if v := strings.TrimSpace(os.Getenv(key)); v != "" { return v, nil }
        if sn := strings.TrimSpace(os.Getenv(secretNameKey)); sn != "" {
            return secrets.Get(ctx, sn)
        }
        return "", nil
    }
    dev, _ := get("GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_DEVELOPER_TOKEN_SECRET_NAME")
    cid, _ := get("GOOGLE_ADS_OAUTH_CLIENT_ID", "GOOGLE_ADS_OAUTH_CLIENT_ID_SECRET_NAME")
    csec, _ := get("GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_OAUTH_CLIENT_SECRET_SECRET_NAME")
    rt, _ := get("GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN_SECRET_NAME")
    login, _ := get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_LOGIN_CUSTOMER_ID_SECRET_NAME")
    test, _ := get("GOOGLE_ADS_TEST_CUSTOMER_ID", "GOOGLE_ADS_TEST_CUSTOMER_ID_SECRET_NAME")
    return &AdsCreds{
        DeveloperToken: dev,
        OAuthClientID: cid,
        OAuthClientSecret: csec,
        RefreshToken: rt,
        LoginCustomerID: login,
        TestCustomerID: test,
    }, nil
}

type PrecheckFlags struct {
    EnableLive bool
    EnableAccessibleCustomers bool
    EnableValidateOnly bool
    PerCheckTimeoutMS int
    TotalTimeoutMS int
}

func LoadPrecheckFlags() PrecheckFlags {
    toBool := func(k string, def bool) bool {
        v := strings.ToLower(strings.TrimSpace(os.Getenv(k)))
        if v == "true" || v == "1" || v == "yes" { return true }
        if v == "false" || v == "0" || v == "no" { return false }
        return def
    }
    toInt := func(k string, def int) int {
        if s := strings.TrimSpace(os.Getenv(k)); s != "" {
            if n, err := strconv.Atoi(s); err == nil { return n }
        }
        return def
    }
    return PrecheckFlags{
        EnableLive: toBool("ADS_PRECHECK_ENABLE_LIVE", false),
        EnableAccessibleCustomers: toBool("ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS", false),
        EnableValidateOnly: toBool("ADS_PRECHECK_ENABLE_VALIDATE_ONLY", false),
        PerCheckTimeoutMS: toInt("ADS_PRECHECK_TIMEOUT_MS", 1500),
        TotalTimeoutMS: toInt("ADS_PRECHECK_TOTAL_TIMEOUT_MS", 2500),
    }
}
