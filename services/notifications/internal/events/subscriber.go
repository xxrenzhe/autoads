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
)

type Subscriber struct {
    client *pubsub.Client
    sub    *pubsub.Subscription
    db     *sql.DB
}

func NewSubscriber(ctx context.Context, db *sql.DB) (*Subscriber, error) {
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
    return &Subscriber{client: c, sub: s, db: db}, nil
}

func (s *Subscriber) Start(ctx context.Context) {
    go func() {
        err := s.sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
            et := msg.Attributes["eventType"]
            if et == "" { log.Printf("notifications: drop message(no eventType)"); msg.Ack(); return }
            switch et {
            case "SiterankCompleted":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                _ = s.insertNotification(cctx, payload, "SiterankCompleted")
                msg.Ack()
            case "OfferCreated", "SiterankRequested":
                var payload map[string]any
                if err := json.Unmarshal(msg.Data, &payload); err != nil { log.Printf("notifications: bad payload: %v", err); msg.Nack(); return }
                _ = s.insertNotification(cctx, payload, et)
                msg.Ack()
            default:
                msg.Ack()
            }
        })
        if err != nil { log.Printf("notifications: subscriber stopped: %v", err) }
    }()
}

func (s *Subscriber) Close() { if s.client != nil { s.client.Close() } }

func (s *Subscriber) insertNotification(ctx context.Context, payload map[string]any, eventType string) error {
    // Resolve userId (best-effort)
    userID := ""
    if v, ok := payload["userId"].(string); ok { userID = v }
    title := eventType
    messageB, _ := json.Marshal(payload)
    _, err := s.db.ExecContext(ctx, `INSERT INTO user_notifications (user_id, type, title, message, created_at) VALUES ($1,$2,$3,$4,NOW())`, userID, eventType, title, string(messageB))
    if err != nil { log.Printf("notifications: insert failed: %v", err) }
    return err
}

