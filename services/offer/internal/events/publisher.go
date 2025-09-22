// github.com/xxrenzhe/autoads/services/offer/internal/events/publisher.go
package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"cloud.google.com/go/pubsub"
)

// Publisher sends domain events to Google Cloud Pub/Sub.
type Publisher struct {
	client *pubsub.Client
	topic  *pubsub.Topic
}

// NewPublisher creates a new event publisher.
func NewPublisher(ctx context.Context) (*Publisher, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_PROJECT environment variable must be set")
	}

	topicID := os.Getenv("PUBSUB_TOPIC_ID")
	if topicID == "" {
		return nil, fmt.Errorf("PUBSUB_TOPIC_ID environment variable must be set")
	}

	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}

	topic := client.Topic(topicID)
	exists, err := topic.Exists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check if topic exists: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("topic %s does not exist in project %s", topicID, projectID)
	}

	return &Publisher{
		client: client,
		topic:  topic,
	}, nil
}

// Publish sends an event to the topic.
func (p *Publisher) Publish(ctx context.Context, eventType string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %w", err)
	}

	msg := &pubsub.Message{
		Data: data,
		Attributes: map[string]string{
			"eventType": eventType,
		},
	}

	result := p.topic.Publish(ctx, msg)
	// Block until the result is returned and log server-generated message ID.
	id, err := result.Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	log.Printf("Published event of type '%s' with message ID: %s", eventType, id)
	return nil
}

// Close cleans up the publisher's resources.
func (p *Publisher) Close() {
	if p.topic != nil {
		p.topic.Stop()
	}
	if p.client != nil {
		p.client.Close()
	}
}
