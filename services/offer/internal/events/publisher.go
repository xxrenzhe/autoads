// Wrapper factory kept for compatibility with cmd/server and tests.
package events

import (
    "context"
    "fmt"
    "os"
)

// NewPublisher returns a Publisher backed by Pub/Sub using environment variables.
func NewPublisher(ctx context.Context) (Publisher, error) {
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    if projectID == "" {
        return nil, fmt.Errorf("GOOGLE_CLOUD_PROJECT environment variable must be set")
    }
    topicID := os.Getenv("PUBSUB_TOPIC_ID")
    if topicID == "" {
        return nil, fmt.Errorf("PUBSUB_TOPIC_ID environment variable must be set")
    }
    return NewPubSubPublisher(ctx, projectID, topicID)
}
