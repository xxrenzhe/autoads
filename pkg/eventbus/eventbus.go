package eventbus

import (
	"context"
	"encoding/json"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/xxrenzhe/autoads/pkg/logger"
)

var log = logger.Get()

const eventChannel = "events"

type Event struct {
	Type      string
	Timestamp time.Time
	Payload   interface{}
}

type Publisher struct {
	rdb *redis.Client
}

func NewPublisher(rdb *redis.Client) *Publisher {
	return &Publisher{rdb: rdb}
}

func (p *Publisher) Publish(ctx context.Context, eventType string, payload interface{}) error {
	event := Event{
		Type:      eventType,
		Timestamp: time.Now(),
		Payload:   payload,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal event")
		return err
	}

	if err := p.rdb.Publish(ctx, eventChannel, eventJSON).Err(); err != nil {
		log.Error().Err(err).Msg("Failed to publish event to Redis")
		return err
	}

	log.Info().Str("eventType", eventType).Msg("Event published to Redis")
	return nil
}

type Subscriber struct {
	rdb *redis.Client
}

func NewSubscriber(rdb *redis.Client) *Subscriber {
	return &Subscriber{rdb: rdb}
}

func (s *Subscriber) Subscribe(ctx context.Context, handler func(Event)) {
	pubsub := s.rdb.Subscribe(ctx, eventChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	log.Info().Str("channel", eventChannel).Msg("Subscribed to event channel")

	for msg := range ch {
		var event Event
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal event from Redis")
			continue
		}
		handler(event)
	}
}
