package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"cloud.google.com/go/pubsub"
)

// PubSubPublisher is a publisher that sends events to a Google Cloud Pub/Sub topic.
type PubSubPublisher struct {
	client    *pubsub.Client
	topic     *pubsub.Topic
	topicName string
	mu        sync.RWMutex
}

// NewPubSubPublisher creates a new PubSubPublisher.
func NewPubSubPublisher(ctx context.Context, projectID, topicName string) (*PubSubPublisher, error) {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}

	topic := client.Topic(topicName)
	exists, err := topic.Exists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check if topic exists: %w", err)
	}
	if !exists {
		log.Printf("Topic %s does not exist, creating it...", topicName)
		topic, err = client.CreateTopic(ctx, topicName)
		if err != nil {
			return nil, fmt.Errorf("failed to create topic %s: %w", topicName, err)
		}
	}

	return &PubSubPublisher{
		client:    client,
		topic:     topic,
		topicName: topicName,
	}, nil
}

// Publish sends an event to the Pub/Sub topic.
func (p *PubSubPublisher) Publish(ctx context.Context, event DomainEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := &pubsub.Message{
		Data: data,
		Attributes: map[string]string{
			"eventType": event.EventType(),
		},
	}

	result := p.topic.Publish(ctx, msg)
	// Block until the result is returned and log server-generated ID
	id, err := result.Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}
	log.Printf("Published message; msg ID: %v\n", id)
	return nil
}

// Close cleans up the Pub/Sub client resources.
func (p *PubSubPublisher) Close() {
	if p.topic != nil {
		p.topic.Stop()
	}
	if p.client != nil {
		p.client.Close()
	}
}
