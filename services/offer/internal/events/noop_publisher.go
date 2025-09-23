package events

import "context"

// NoopPublisher implements Publisher but does nothing.
type NoopPublisher struct{}

func (n *NoopPublisher) Publish(ctx context.Context, event DomainEvent) error { return nil }
func (n *NoopPublisher) Close()                                  {}

