package audit

import (
    "testing"
    "time"

    "github.com/stretchr/testify/require"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

// newTestDB creates an in-memory sqlite DB and migrates core tables.
func newTestDB(t *testing.T) *gorm.DB {
    t.Helper()
    db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    require.NoError(t, err)

    // Auto-migrate core audit tables
    require.NoError(t, db.AutoMigrate(&AuditEvent{}, &SecurityEvent{}))

    // Create minimal auxiliary tables used by AutoAds methods (empty schema is fine)
    // token_transactions(user_id TEXT, amount INTEGER, type TEXT, created_at DATETIME)
    require.NoError(t, db.Exec(`CREATE TABLE token_transactions (
        user_id TEXT, amount INTEGER, type TEXT, created_at DATETIME
    );`).Error)
    // batch_tasks/siterank_queries/chengelink_tasks(user_id TEXT, status TEXT, created_at DATETIME)
    require.NoError(t, db.Exec(`CREATE TABLE batch_tasks (
        user_id TEXT, status TEXT, created_at DATETIME
    );`).Error)
    require.NoError(t, db.Exec(`CREATE TABLE siterank_queries (
        user_id TEXT, status TEXT, created_at DATETIME
    );`).Error)
    require.NoError(t, db.Exec(`CREATE TABLE chengelink_tasks (
        user_id TEXT, status TEXT, created_at DATETIME
    );`).Error)

    return db
}

func TestAuditService_LogAndQuery(t *testing.T) {
    db := newTestDB(t)
    svc := NewAuditService(db)

    // Insert actions
    require.NoError(t, svc.LogUserAction("u1", ActionCreate, ResourceTask, "t1", map[string]any{"x": 1}, "127.0.0.1", "ua", true, "", 120*time.Millisecond))
    require.NoError(t, svc.LogUserAction("u1", ActionExecute, ResourceTask, "t1", map[string]any{"x": 2}, "127.0.0.1", "ua", true, "", 80*time.Millisecond))
    require.NoError(t, svc.LogUserAction("u1", ActionExecute, ResourceTask, "t2", map[string]any{"x": 3}, "127.0.0.1", "ua", false, "failed", 30*time.Millisecond))

    // Query events
    events, total, err := svc.GetAuditEvents("u1", 10, 0)
    require.NoError(t, err)
    require.Equal(t, int64(3), total)
    require.Len(t, events, 3)

    // Stats
    stats, err := svc.GetUserActionStats("u1", 7)
    require.NoError(t, err)
    require.EqualValues(t, 1, stats[ActionCreate])
    require.EqualValues(t, 2, stats[ActionExecute])
}

func TestAuditService_SecurityStatsAndRiskyIPs(t *testing.T) {
    db := newTestDB(t)
    svc := NewAuditService(db)

    // Insert security events
    require.NoError(t, svc.LogSecurityEvent(SecurityEventLoginFailed, "u1", "1.1.1.1", "ua", map[string]any{"reason": "bad_pw"}, SeverityLow))
    require.NoError(t, svc.LogSecurityEvent(SecurityEventRateLimitExceeded, "u2", "2.2.2.2", "ua", map[string]any{"endpoint": "/api"}, SeverityMedium))
    require.NoError(t, svc.LogSecurityEvent(SecurityEventUnauthorizedAccess, "u2", "2.2.2.2", "ua", map[string]any{"endpoint": "/secret"}, SeverityHigh))

    // Stats
    stats, err := svc.GetSecurityStats(7)
    require.NoError(t, err)
    ets := stats["event_types"].(map[string]int64)
    require.GreaterOrEqual(t, ets[SecurityEventLoginFailed], int64(1))
    require.GreaterOrEqual(t, ets[SecurityEventUnauthorizedAccess], int64(1))

    // Risky IPs
    ips, err := svc.GetTopRiskyIPs(7, 10)
    require.NoError(t, err)
    require.NotEmpty(t, ips)
}

func TestAutoAds_SystemSecurityReport(t *testing.T) {
    db := newTestDB(t)
    aas := NewAutoAdsAuditService(db)

    // Minimal data for report to avoid empty paths
    require.NoError(t, aas.LogSecurityIncident(SecurityEventRateLimitExceeded, "u2", "3.3.3.3", "ua", map[string]any{"path": "/api"}, SeverityMedium))

    report, err := aas.GetSystemSecurityReport(7)
    require.NoError(t, err)
    require.Contains(t, report, "security_stats")
    require.Contains(t, report, "risky_ips")
    require.Contains(t, report, "suspicious_users")
    require.Contains(t, report, "api_abuse")
    require.Contains(t, report, "security_score")
}

