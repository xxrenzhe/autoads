// services/siterank/internal/events/subscriber.go
package events

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"cloud.google.com/go/pubsub"
)

type Subscriber struct {
	client    *pubsub.Client
	db        *sql.DB
	publisher *Publisher
}

func NewSubscriber(ctx context.Context, db *sql.DB, publisher *Publisher) (*Subscriber, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}
	return &Subscriber{ client: client, db: db, publisher: publisher }, nil
}

func (s *Subscriber) StartListening(ctx context.Context) {
	subscriptionID := os.Getenv("PUBSUB_SITERANK_SUBSCRIPTION_ID")
	sub := s.client.Subscription(subscriptionID)
	log.Printf("Starting to listen for events on subscription: %s", subscriptionID)

	err := sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
		eventType := msg.Attributes["eventType"]
		log.Printf("Received event of type: %s", eventType)
		
		var err error
		switch eventType {
		case "WorkflowStepStarted":
			err = HandleWorkflowStepStarted(cctx, s.db, s.publisher, msg.Data)
		default:
			msg.Ack()
			return
		}

		if err != nil {
			log.Printf("Error processing event '%s': %v", eventType, err)
			msg.Nack()
		} else {
			msg.Ack()
		}
	})
	if err != nil {
		log.Fatalf("Pub/Sub Receive error: %v", err)
	}
}
