package idempotency

import (
    "encoding/json"
    "net/http"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

const idempotencyHeader = "Idempotency-Key"

// getUserID extracts user id from context (set by InternalJWTAuth middleware).
func getUserID(c *gin.Context) string {
    uid := strings.TrimSpace(c.GetString("user_id"))
    if uid == "" { uid = strings.TrimSpace(c.GetString("userID")) }
    return uid
}

// WithIdempotency ensures at-most-once semantics for (user, endpoint, key).
// Returns true if the handler should proceed; false if a duplicate should short-circuit.
func WithIdempotency(c *gin.Context, endpoint string) bool {
    key := strings.TrimSpace(c.GetHeader(idempotencyHeader))
    if key == "" { return true }
    uid := getUserID(c)
    if uid == "" { return true }

    // Insert IGNORE a pending record; if exists, short circuit.
    _, err := gf.DB().Exec(gf.Ctx(nil),
        "INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status, created_at) VALUES(?,?,?,?,?)",
        uid, endpoint, key, "PENDING", time.Now(),
    )
    if err == nil {
        // check if we actually inserted or it's duplicate
        rec, e2 := gf.DB().Model("idempotency_requests").Where("user_id=? AND endpoint=? AND idem_key=?", uid, endpoint, key).One()
        if e2 == nil && rec != nil {
            st := strings.ToUpper(strings.TrimSpace(rec["status"].String()))
            if st == "PENDING" { return true }
            // DONE or others: attempt replay original response if available
            // Columns may be NULL if feature not enabled yet
            rs := rec["response_status"].Int()
            rb := strings.TrimSpace(rec["response_body"].String())
            if rs > 0 && rb != "" {
                // try to return stored status/body (assumed JSON)
                c.Header("Idempotent-Replayed", "1")
                c.Data(rs, "application/json; charset=utf-8", []byte(rb))
                return false
            }
            // fallback: generic already-processed
            c.JSON(http.StatusOK, gin.H{"message": "idempotent: already processed"})
            return false
        }
    }
    // on error, be permissive
    return true
}

// MarkIdempotentDone marks the request as DONE if an Idempotency-Key is present.
func MarkIdempotentDone(c *gin.Context, endpoint string) {
    key := strings.TrimSpace(c.GetHeader(idempotencyHeader))
    if key == "" { return }
    uid := getUserID(c)
    if uid == "" { return }
    // Minimal DONE mark; no response recorded
    _, _ = gf.DB().Model("idempotency_requests").Where("user_id=? AND endpoint=? AND idem_key=?", uid, endpoint, key).Update(gf.Map{
        "status":     "DONE",
        "updated_at": time.Now(),
        // default TTL 7d for cleanup compatibility even if response not recorded
        "expires_at": time.Now().Add(7 * 24 * time.Hour),
    })
}

// MarkIdempotentDoneWithResponse marks DONE and persists original response for replay.
// `body` is marshalled to JSON and stored along with HTTP status and expiry (default 7d).
func MarkIdempotentDoneWithResponse(c *gin.Context, endpoint string, status int, body any) {
    key := strings.TrimSpace(c.GetHeader(idempotencyHeader))
    if key == "" { return }
    uid := getUserID(c)
    if uid == "" { return }
    // marshal body to JSON (best-effort)
    var payload []byte
    if body != nil {
        if b, err := json.Marshal(body); err == nil {
            payload = b
        }
    }
    data := gf.Map{
        "status":          "DONE",
        "updated_at":      time.Now(),
        "expires_at":      time.Now().Add(7 * 24 * time.Hour),
    }
    if status > 0 { data["response_status"] = status }
    if len(payload) > 0 { data["response_body"] = string(payload) }
    _, _ = gf.DB().Model("idempotency_requests").Where("user_id=? AND endpoint=? AND idem_key=?", uid, endpoint, key).Update(data)
}
