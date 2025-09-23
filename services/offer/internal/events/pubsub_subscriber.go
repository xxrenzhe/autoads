package events

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "sync"
    "time"

    "cloud.google.com/go/pubsub"
    "github.com/xxrenzhe/autoads/services/offer/internal/domain"
)

// PubSubSubscriber listens for messages and dispatches them to handlers by eventType.
type PubSubSubscriber struct {
    client         *pubsub.Client
    subscription   *pubsub.Subscription
    subscriptionID string
    handlers       map[string]Subscriber
    mu             sync.RWMutex
}

func NewPubSubSubscriber(ctx context.Context, projectID, topicName, subscriptionID string) (*PubSubSubscriber, error) {
    client, err := pubsub.NewClient(ctx, projectID)
    if err != nil { return nil, fmt.Errorf("create pubsub client: %w", err) }

    sub := client.Subscription(subscriptionID)
    exists, err := sub.Exists(ctx)
    if err != nil { return nil, fmt.Errorf("check subscription exists: %w", err) }
    if !exists {
        log.Printf("Subscription %s not exists, creating...", subscriptionID)
        topic := client.Topic(topicName)
        sub, err = client.CreateSubscription(ctx, subscriptionID, pubsub.SubscriptionConfig{Topic: topic, AckDeadline: 20 * time.Second})
        if err != nil { return nil, fmt.Errorf("create subscription: %w", err) }
    }
    return &PubSubSubscriber{client: client, subscription: sub, subscriptionID: subscriptionID, handlers: make(map[string]Subscriber)}, nil
}

func (s *PubSubSubscriber) On(eventType string, h Subscriber) {
    s.mu.Lock(); defer s.mu.Unlock()
    s.handlers[eventType] = h
}

func (s *PubSubSubscriber) Start(ctx context.Context) {
    go func() {
        err := s.subscription.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
            et := msg.Attributes["eventType"]
            if et == "" { log.Printf("WARN: message without eventType"); msg.Ack(); return }
            s.mu.RLock(); h, ok := s.handlers[et]; s.mu.RUnlock()
            if !ok { log.Printf("WARN: no handler for %s", et); msg.Ack(); return }
            // Simplified: unmarshal to OfferCreatedEvent (only event supported here)
            var e domain.OfferCreatedEvent
            if err := json.Unmarshal(msg.Data, &e); err != nil { log.Printf("ERROR: unmarshal: %v", err); msg.Nack(); return }
            if err := h(ctx, e); err != nil { log.Printf("ERROR: handler: %v", err); msg.Nack(); return }
            msg.Ack()
        })
        if err != nil { log.Fatalf("subscriber receive error: %v", err) }
    }()
}

func (s *PubSubSubscriber) Close() { if s.client != nil { s.client.Close() } }

