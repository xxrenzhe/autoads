package events

import (
	"context"
	"encoding/json"
	"log"
	"sync"
)

// DomainEvent represents a generic domain event.
type DomainEvent interface {
	EventType() string
}

// Publisher defines the interface for publishing domain events.
type Publisher interface {
	Publish(ctx context.Context, event DomainEvent) error
}

// Subscriber defines the function signature for an event handler.
type Subscriber func(ctx context.Context, event DomainEvent) error

// InMemoryBus is a simple in-memory event bus for local development.
type InMemoryBus struct {
	subscribers map[string][]Subscriber
	mu          sync.RWMutex
}

// NewInMemoryBus creates a new InMemoryBus.
func NewInMemoryBus() *InMemoryBus {
	return &InMemoryBus{
		subscribers: make(map[string][]Subscriber),
	}
}

// Publish sends an event to all registered subscribers for that event type.
func (b *InMemoryBus) Publish(ctx context.Context, event DomainEvent) error {
	b.mu.RLock()
	defer b.mu.RUnlock()

	subscribers, ok := b.subscribers[event.EventType()]
	if !ok {
		return nil // No subscribers for this event
	}

	for _, sub := range subscribers {
		// In a real implementation, this would be concurrent with error handling.
		if err := sub(ctx, event); err != nil {
			log.Printf("ERROR: Subscriber for event %s failed: %v", event.EventType(), err)
			// Decide on error handling strategy: continue or stop?
		}
	}
	return nil
}

// Subscribe registers a handler for a specific event type.
func (b *InMemoryBus) Subscribe(eventType string, subscriber Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscribers[eventType] = append(b.subscribers[eventType], subscriber)
}

// --- Logging Middleware ---

// LoggingMiddleware is a decorator for a Publisher that adds logging.
type LoggingMiddleware struct {
	Next Publisher
}

// Publish logs the event and then passes it to the next publisher in the chain.
func (m *LoggingMiddleware) Publish(ctx context.Context, event DomainEvent) error {
	eventData, err := json.Marshal(event)
	if err != nil {
		return err
	}
	log.Printf("EVENT PUBLISHED: Type='%s', Data=%s", event.EventType(), string(eventData))
	return m.Next.Publish(ctx, event)
}
