
// services/workflow/internal/events/subscriber.go
package events

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"cloud.google.com/go/pubsub"
)

// Subscriber listens for domain events from Google Cloud Pub/Sub.
type Subscriber struct {
	client    *pubsub.Client
	db        *sql.DB
	publisher *Publisher // Add publisher to the subscriber struct
}

// NewSubscriber creates a new event subscriber.
func NewSubscriber(ctx context.is, db *sql.DB, publisher *Publisher) (*Subscriber, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_PROJECT environment variable must be set")
	}

	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}

	return &Subscriber{
		client:    client,
		db:        db,
		publisher: publisher,
	}, nil
}

// StartListening begins listening for events on a specific subscription.
func (s *Subscriber) StartListening(ctx context.Context) {
	subscriptionID := os.Getenv("PUBSUB_WORKFLOW_SUBSCRIPTION_ID") // Using a specific subscription for this service
	if subscriptionID == "" {
		log.Fatal("PUBSUB_WORKFLOW_SUBSCRIPTION_ID environment variable must be set")
	}

	sub := s.client.Subscription(subscriptionID)
	log.Printf("Starting to listen for events on subscription: %s", subscriptionID)

	err := sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
		eventType := msg.Attributes["eventType"]
		log.Printf("Received event of type: %s", eventType)

		var err error
		switch eventType {
		case "OfferCreated":
			err = HandleOfferCreated(cctx, s.db, s.publisher, msg.Data)
		default:
			log.Printf("Workflow service is not subscribed to event type: %s. Acknowledging.", eventType)
			msg.Ack()
			return
		}

		if err != nil {
			log.Printf("Error processing event '%s': %v", eventType, err)
			msg.Nack()
		} else {
			log.Printf("Successfully processed event '%s'", eventType)
			msg.Ack()
		}
	})

	if err != nil {
		log.Fatalf("Pub/Sub Receive error: %v. The service will shut down.", err)
	}
}
