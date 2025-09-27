package main

import (
    "database/sql"
    "fmt"
    "io/fs"
    "log"
    "os"
    "path/filepath"
    "sort"
    _ "github.com/lib/pq"
    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
    "context"
)

func main() {
    ctx := context.Background()
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        if sec := os.Getenv("DATABASE_URL_SECRET_NAME"); sec != "" {
            // Fetch from Secret Manager; requires GOOGLE_APPLICATION_CREDENTIALS or metadata default creds
            client, err := secretmanager.NewClient(ctx)
            if err != nil { log.Fatalf("secretmanager: %v", err) }
            defer client.Close()
            res, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: sec})
            if err != nil { log.Fatalf("access secret %s failed: %v", sec, err) }
            dsn = string(res.Payload.Data)
        }
    }
    if dsn == "" { log.Fatalf("DATABASE_URL or DATABASE_URL_SECRET_NAME is required") }
    root := resolveSchemasDir()
    db, err := sql.Open("postgres", dsn)
    if err != nil { log.Fatal(err) }
    defer db.Close()
    if err := db.Ping(); err != nil { log.Fatal(err) }
    // Optional check-only mode: verify tables exist and exit.
    if os.Getenv("CHECK_ONLY") == "1" {
        checkTables(ctx, db)
        fmt.Println("[DONE] schema check completed")
        return
    }
    files := make([]string, 0)
    err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
        if err != nil { return err }
        if d.IsDir() { return nil }
        if filepath.Ext(path) == ".sql" { files = append(files, path) }
        return nil
    })
    if err != nil { log.Fatal(err) }
    // lexical order
    // Go doesn't have filepath.Sort; use std sort
    sort.Strings(files)
    log.Printf("applying %d SQL files under %s", len(files), root)
    for _, f := range files {
        b, err := os.ReadFile(f)
        if err != nil { log.Fatal(err) }
        log.Printf("-> %s", filepath.Base(f))
        if _, err := db.Exec(string(b)); err != nil {
            log.Fatalf("apply %s failed: %v", f, err)
        }
    }
    fmt.Println("[DONE] schema applied")
}

func resolveSchemasDir() string {
    // Prefer explicit env
    if v := os.Getenv("SCHEMAS_DIR"); v != "" { return v }
    // Common container path
    candidates := []string{
        "/app/schemas/sql",
        "./schemas/sql",
        filepath.Join("schemas", "sql"),
    }
    for _, c := range candidates {
        if st, err := os.Stat(c); err == nil && st.IsDir() {
            abs, _ := filepath.Abs(c)
            return abs
        }
    }
    // Fallback to working dir
    wd, _ := os.Getwd()
    return filepath.Join(wd, "schemas", "sql")
}

func checkTables(ctx context.Context, db *sql.DB) {
    tables := []string{
        "\"User\"",
        "\"Offer\"",
        "\"SiterankAnalysis\"",
        "event_store",
        "domain_cache",
        "domain_country_cache",
        "idempotency_keys",
        "\"BatchopenTask\"",
        "\"BulkActionOperation\"",
        "\"BulkActionShard\"",
        "\"BulkActionAudit\"",
        "\"AuditEvent\"",
        "\"MccLink\"",
        "\"BulkActionDeadLetter\"",
    }
    log.Println("[check] verifying core tables existence…")
    for _, t := range tables {
        var name sql.NullString
        if err := db.QueryRowContext(ctx, "SELECT to_regclass($1)", "public."+t).Scan(&name); err != nil {
            log.Printf("[check] %s error: %v", t, err)
            continue
        }
        if name.Valid && name.String != "" {
            log.Printf("[check] %-24s OK (%s)", t, name.String)
        } else {
            log.Printf("[check] %-24s MISSING", t)
        }
    }
}
