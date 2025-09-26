package events

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "os"
    "time"

    "cloud.google.com/go/pubsub"
    "cloud.google.com/go/firestore"
    "strings"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "net/http"
)

type Subscriber struct {
    client *pubsub.Client
    sub    *pubsub.Subscription
    db     *sql.DB
    pub    *ev.Publisher
}

func NewSubscriber(ctx context.Context, db *sql.DB, pub *ev.Publisher) (*Subscriber, error) {
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    subID := os.Getenv("PUBSUB_SUBSCRIPTION_ID")
    topicID := os.Getenv("PUBSUB_TOPIC_ID")
    if projectID == "" || subID == "" {
        return nil, fmt.Errorf("missing GOOGLE_CLOUD_PROJECT or PUBSUB_SUBSCRIPTION_ID")
    }
    c, err := pubsub.NewClient(ctx, projectID)
    if err != nil { return nil, err }
    s := c.Subscription(subID)
    exists, err := s.Exists(ctx)
    if err != nil { return nil, err }
    if !exists {
        if topicID == "" { return nil, fmt.Errorf("subscription %s not exist and PUBSUB_TOPIC_ID missing for creation", subID) }
        t := c.Topic(topicID)
        s, err = c.CreateSubscription(ctx, subID, pubsub.SubscriptionConfig{Topic: t, AckDeadline: 20 * time.Second})
        if err != nil { return nil, err }
    }
    log.Printf("notifications: subscriber initialized (project=%s, sub=%s)", projectID, subID)
    return &Subscriber{client: c, sub: s, db: db, pub: pub}, nil
}

func (s *Subscriber) Start(ctx context.Context) {
    go func() {
        log.Printf("notifications: starting Receive on subscription %s", s.sub.ID())
        err := s.sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
            et := msg.Attributes["eventType"]
            if et == "" { log.Printf("notifications: drop message(no eventType)"); msg.Ack(); return }
            log.Printf("notifications: received event type=%s", et)
            switch et {
            case "SiterankCompleted":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                // unwrap envelope if present
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, "SiterankCompleted")
                // best-effort: project Offer status -> evaluated & write siterankScore if present
                offID, _ := strMap(payload, "offerId")
                uid, _ := strMap(payload, "userId")
                var score *float64
                if v, ok := payload["score"].(float64); ok { score = &v }
                if offID != "" && uid != "" {
                    if score != nil {
                        if _, err := s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated', "siterankScore"=$1 WHERE id=$2 AND "userId"=$3`, *score, offID, uid); err != nil {
                            _, _ = s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated', siterankScore=$1 WHERE id=$2 AND userid=$3`, *score, offID, uid)
                        }
                    } else {
                        if _, err := s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated' WHERE id=$1 AND "userId"=$2`, offID, uid); err != nil {
                            _, _ = s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated' WHERE id=$1 AND userid=$2`, offID, uid)
                        }
                    }
                }
                msg.Ack()
            case "OfferCreated", "SiterankRequested":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                if et == "OfferCreated" { _ = s.projectOfferCreated(cctx, payload) }
                msg.Ack()
            case "WorkflowStarted", "WorkflowStepCompleted", "WorkflowCompleted":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                msg.Ack()
            case "BatchOpsTaskQueued", "BatchOpsTaskStarted", "BatchOpsTaskCompleted", "BatchOpsTaskFailed":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                _ = s.projectBatchopenTask(cctx, et, payload)
                if strings.ToLower(strings.TrimSpace(os.Getenv("ENABLE_SAGA"))) == "1" {
                    if err := s.handleBatchopenSaga(cctx, et, payload); err != nil { log.Printf("notifications: saga error: %v", err) }
                }
                msg.Ack()
            case "BrowserExecRequested", "BrowserExecCompleted":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                msg.Ack()
            case "TokenReserved", "TokenDebited", "TokenReverted":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                msg.Ack()
            case "NotificationCreated":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                if dv, ok := payload["data"].(map[string]any); ok { payload = dv }
                _ = s.insertNotification(cctx, payload, et)
                msg.Ack()
            default:
                msg.Ack()
            }
        })
        if err != nil { log.Printf("notifications: subscriber stopped: %v", err) } else { log.Printf("notifications: Receive returned nil (stopped)") }
    }()
}

func (s *Subscriber) Close() { if s.client != nil { s.client.Close() } }

func (s *Subscriber) insertNotification(ctx context.Context, payload map[string]any, eventType string) error {
    // Resolve userId (best-effort)
    userID := ""
    if v, ok := payload["userId"].(string); ok { userID = v }
    // Fallback: try resolve from analysisId in SiterankAnalysis
    if userID == "" {
        if aidv, ok := payload["analysisId"].(string); ok && aidv != "" {
            var uid2 string
            if err := s.db.QueryRowContext(ctx, `SELECT user_id FROM "SiterankAnalysis" WHERE id=$1`, aidv).Scan(&uid2); err == nil && uid2 != "" {
                userID = uid2
            }
        }
    }
    // Rule engine: compute title/severity/category and normalized message
    title, msg := composeNotification(eventType, payload)
    messageB, _ := json.Marshal(msg)
    var id int64
    err := s.db.QueryRowContext(ctx, `INSERT INTO user_notifications (user_id, type, title, message, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id`, userID, eventType, title, string(messageB)).Scan(&id)
    if err != nil {
        log.Printf("notifications: insert failed: %v", err)
    } else {
        log.Printf("notifications: insert ok userId=%s type=%s id=%d", userID, eventType, id)
    }
    // Best-effort Firestore UI cache
    _ = writeNotificationUI(ctx, userID, map[string]any{"type": eventType, "title": title, "payload": msg, "createdAt": time.Now().UTC()})
    // Publish NotificationSent for downstream consumers (best-effort)
    if s.pub != nil && id > 0 {
        _ = s.pub.Publish(ctx, ev.EventNotificationSent, map[string]any{
            "userId": userID,
            "notificationId": fmt.Sprintf("%d", id),
            "type": eventType,
            "title": title,
            "time": time.Now().UTC().Format(time.RFC3339),
        }, ev.WithSource("notifications"), ev.WithSubject(fmt.Sprintf("%d", id)))
    }
    return err
}

func strMap(m map[string]any, k string) (string, bool) {
    if v, ok := m[k]; ok {
        if s, ok2 := v.(string); ok2 { return s, true }
    }
    return "", false
}

// composeNotification maps an event into a structured in-app notification payload.
// Minimal rules: classify severity & category, keep original payload under data.
func composeNotification(eventType string, p map[string]any) (string, map[string]any) {
    // helpers
    str := func(k string) string { if v, ok := p[k].(string); ok { return v }; return "" }
    now := time.Now().UTC().Format(time.RFC3339)
    msg := map[string]any{
        "severity": "info",
        "category": "general",
        "eventType": eventType,
        "time": now,
        "data": p,
    }
    title := eventType
    switch eventType {
    case "SiterankCompleted":
        title = "评估完成"
        msg["category"] = "siterank"
        msg["severity"] = "info"
    case "SiterankRequested":
        title = "评估已入队"
        msg["category"] = "siterank"
        msg["severity"] = "info"
    case "OfferCreated":
        title = "Offer 已创建"
        msg["category"] = "offer"
        msg["severity"] = "info"
        if name := str("name"); name != "" { msg["summary"] = fmt.Sprintf("%s 已创建", name) }
    case "BatchOpsTaskQueued":
        title = "批量任务已入队"
        msg["category"] = "batchopen"
        msg["severity"] = "info"
    case "BatchOpsTaskStarted":
        title = "批量任务开始执行"
        msg["category"] = "batchopen"
        msg["severity"] = "info"
    case "BatchOpsTaskCompleted":
        title = "批量任务完成"
        msg["category"] = "batchopen"
        msg["severity"] = "success"
    case "BatchOpsTaskFailed":
        title = "批量任务失败"
        msg["category"] = "batchopen"
        msg["severity"] = "error"
        if r := str("reason"); r != "" { msg["summary"] = r }
    case "WorkflowStarted":
        title = "工作流开始"
        msg["category"] = "workflow"
        msg["severity"] = "info"
    case "WorkflowStepCompleted":
        title = "工作流步骤完成"
        msg["category"] = "workflow"
        msg["severity"] = "info"
    case "WorkflowCompleted":
        title = "工作流完成"
        msg["category"] = "workflow"
        msg["severity"] = "success"
    case "TokenReserved":
        title = "已预留代币"
        msg["category"] = "billing"
        msg["severity"] = "info"
    case "TokenDebited":
        title = "扣费成功"
        msg["category"] = "billing"
        msg["severity"] = "success"
    case "TokenReverted":
        title = "已释放预留代币"
        msg["category"] = "billing"
        msg["severity"] = "warn"
    case "BrowserExecRequested":
        title = "浏览器执行已请求"
        msg["category"] = "browser_exec"
        msg["severity"] = "info"
        if u := str("url"); u != "" { msg["url"] = u }
        if t := str("taskId"); t != "" { msg["taskId"] = t }
    case "BrowserExecCompleted":
        ok := false
        if v, ok2 := p["ok"].(bool); ok2 { ok = v }
        if ok { title = "浏览器执行完成"; msg["severity"] = "success" } else { title = "浏览器执行失败"; msg["severity"] = "error" }
        msg["category"] = "browser_exec"
        if t := str("taskId"); t != "" { msg["taskId"] = t }
        if q, ok2 := p["quality"].(float64); ok2 { msg["quality"] = int(q) }
    case "NotificationCreated":
        // passthrough using provided fields
        if t := str("title"); t != "" { title = t }
        if sev := str("type"); sev != "" { msg["severity"] = sev } else { msg["severity"] = "info" }
        msg["category"] = "system"
    default:
        // keep defaults
    }
    return title, msg
}

// --- Saga Coordinator (minimal) ---

func (s *Subscriber) handleBatchopenSaga(ctx context.Context, eventType string, p map[string]any) error {
    // Extract basics
    userID, _ := strMap(p, "userId")
    taskID, _ := strMap(p, "taskId")
    if userID == "" || taskID == "" { return nil }
    if err := s.sagaEnsureDDL(); err != nil { return err }
    sagaID := "batchopen:" + taskID
    switch eventType {
    case "BatchOpsTaskQueued", "BatchOpsTaskStarted":
        _ = s.sagaUpsertInstance(ctx, sagaID, userID, "batchopen", taskID, "running")
        // reserve tokens (idempotent)
        if err := s.sagaBilling(ctx, userID, taskID, "reserve"); err != nil {
            _ = s.sagaInsertStep(ctx, sagaID, "reserve", "failed", err.Error())
            return err
        }
        _ = s.sagaInsertStep(ctx, sagaID, "reserve", "ok", "")
    case "BatchOpsTaskCompleted":
        if err := s.sagaBilling(ctx, userID, taskID, "commit"); err != nil {
            _ = s.sagaInsertStep(ctx, sagaID, "commit", "failed", err.Error())
            return err
        }
        _ = s.sagaInsertStep(ctx, sagaID, "commit", "ok", "")
        _ = s.sagaUpdateStatus(ctx, sagaID, "completed")
    case "BatchOpsTaskFailed":
        if err := s.sagaBilling(ctx, userID, taskID, "release"); err != nil {
            _ = s.sagaInsertStep(ctx, sagaID, "release", "failed", err.Error())
            return err
        }
        _ = s.sagaInsertStep(ctx, sagaID, "release", "ok", "")
        _ = s.sagaUpdateStatus(ctx, sagaID, "compensated")
    }
    return nil
}

func (s *Subscriber) sagaEnsureDDL() error {
    stmts := []string{
        `CREATE TABLE IF NOT EXISTS "SagaInstance" (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            task_id TEXT,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS "SagaStep" (
            id BIGSERIAL PRIMARY KEY,
            saga_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            last_error TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    }
    for _, q := range stmts { if _, err := s.db.Exec(q); err != nil { return err } }
    return nil
}

func (s *Subscriber) sagaUpsertInstance(ctx context.Context, sagaID, userID, kind, taskID, status string) error {
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO "SagaInstance"(id, user_id, kind, task_id, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
        ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
    `, sagaID, userID, kind, taskID, status)
    return err
}

func (s *Subscriber) sagaUpdateStatus(ctx context.Context, sagaID, status string) error {
    _, err := s.db.ExecContext(ctx, `UPDATE "SagaInstance" SET status=$1, updated_at=NOW() WHERE id=$2`, status, sagaID)
    return err
}

func (s *Subscriber) sagaInsertStep(ctx context.Context, sagaID, name, status, lastErr string) error {
    _, err := s.db.ExecContext(ctx, `INSERT INTO "SagaStep"(saga_id, name, status, attempts, last_error, updated_at) VALUES ($1,$2,$3,1,$4,NOW())`, sagaID, name, status, lastErr)
    return err
}

func (s *Subscriber) sagaBilling(ctx context.Context, userID, taskID, action string) error {
    base := strings.TrimRight(os.Getenv("BILLING_URL"), "/")
    if base == "" { return fmt.Errorf("BILLING_URL not set") }
    url := base + "/api/v1/billing/tokens/" + action
    amount := 1
    if v := strings.TrimSpace(os.Getenv("SAGA_RESERVE_AMOUNT")); v != "" {
        var n int; _, _ = fmt.Sscanf(v, "%d", &n); if n > 0 { amount = n }
    }
    body := map[string]any{"amount": amount, "taskId": taskID}
    if action == "commit" || action == "release" { body["txId"] = taskID }
    b, _ := json.Marshal(body)
    cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(cctx, http.MethodPost, url, strings.NewReader(string(b)))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-User-Id", userID)
    req.Header.Set("X-Idempotency-Key", fmt.Sprintf("saga:%s:%s", action, taskID))
    resp, err := http.DefaultClient.Do(req)
    if resp != nil { _ = resp.Body.Close() }
    if err != nil { return err }
    // accept any 2xx/202
    if resp.StatusCode < 200 || resp.StatusCode >= 300 { return fmt.Errorf("billing %s status=%d", action, resp.StatusCode) }
    return nil
}

// projectOfferCreated writes the Offer read model row (id,userId,name,originalUrl,status,createdAt)
func (s *Subscriber) projectOfferCreated(ctx context.Context, p map[string]any) error {
    // extract fields safely
    getStr := func(k string) string { if v, ok := p[k].(string); ok { return v }; return "" }
    id := getStr("offerId")
    user := getStr("userId")
    name := getStr("name")
    original := getStr("originalUrl")
    status := getStr("status")
    if id == "" || user == "" || original == "" { return nil }
    // createdAt is optional; server defaults now()
    _, err := s.db.ExecContext(ctx, `
        INSERT INTO "Offer" (id, userid, name, originalurl, status, created_at)
        VALUES ($1,$2,$3,$4,$5, NOW())
        ON CONFLICT (id) DO NOTHING
    `, id, user, name, original, status)
    if err != nil { log.Printf("notifications: projectOfferCreated failed: %v", err) }
    return err
}

// projectBatchopenTask upserts task status into read model table BatchopenTask.
func (s *Subscriber) projectBatchopenTask(ctx context.Context, eventType string, p map[string]any) error {
    getStr := func(k string) string { if v, ok := p[k].(string); ok { return v }; return "" }
    taskID := getStr("taskId")
    userID := getStr("userId")
    offerID := getStr("offerId")
    if taskID == "" || userID == "" { return nil }
    status := "queued"
    switch eventType {
    case "BatchOpsTaskQueued": status = "queued"
    case "BatchOpsTaskStarted": status = "running"
    case "BatchOpsTaskCompleted": status = "completed"
    case "BatchOpsTaskFailed": status = "failed"
    }
    // optional result
    var resultJSON string
    if m, ok := p["result"].(map[string]any); ok { if b, err := json.Marshal(m); err == nil { resultJSON = string(b) } }
    // upsert
    if status == "queued" {
        _, err := s.db.ExecContext(ctx, `
            INSERT INTO "BatchopenTask"(id, "userId", "offerId", status, created_at, updated_at)
            VALUES ($1,$2,$3,$4,NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
        `, taskID, userID, offerID, status)
        if err != nil { log.Printf("projectBatchopenTask insert failed: %v", err) }
        return err
    }
    if resultJSON != "" {
        _, err := s.db.ExecContext(ctx, `UPDATE "BatchopenTask" SET status=$1, result=$2::jsonb, updated_at=NOW() WHERE id=$3`, status, resultJSON, taskID)
        if err != nil { log.Printf("projectBatchopenTask update failed: %v", err) }
        return err
    }
    _, err := s.db.ExecContext(ctx, `UPDATE "BatchopenTask" SET status=$1, updated_at=NOW() WHERE id=$2`, status, taskID)
    if err != nil { log.Printf("projectBatchopenTask update failed: %v", err) }
    return err
}

func writeNotificationUI(ctx context.Context, userID string, doc map[string]any) error {
    if userID == "" { return nil }
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if pid == "" { pid = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if pid == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
    defer cancel()
    cli, err := firestore.NewClient(cctx, pid)
    if err != nil { return err }
    defer cli.Close()
    // auto doc ID (server timestamp fallback); for ordering rely on createdAt
    _, err = cli.Collection("users/"+userID+"/notifications").NewDoc().Set(cctx, doc)
    return err
}
