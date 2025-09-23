package events

import (
    "context"
    "encoding/json"
    "log"
)

// DomainEvent represents a generic domain event with a type.
type DomainEvent interface {
    EventType() string
}

// Publisher defines the interface for publishing domain events.
type Publisher interface {
    Publish(ctx context.Context, event DomainEvent) error
}

// Subscriber is the function signature for an event handler.
type Subscriber func(ctx context.Context, event DomainEvent) error

// LoggingMiddleware decorates a Publisher to add logging around Publish.
type LoggingMiddleware struct {
    Next Publisher
}

func (m *LoggingMiddleware) Publish(ctx context.Context, event DomainEvent) error {
    b, _ := json.Marshal(event)
    log.Printf("EVENT PUBLISHED: type=%s payload=%s", event.EventType(), string(b))
    return m.Next.Publish(ctx, event)
}

