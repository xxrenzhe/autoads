package domain

import (
	"time"
)

// OfferCreatedEvent represents the event when a user creates a new offer.
type OfferCreatedEvent struct {
	OfferID     string    `json:"offerId"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	OriginalUrl string    `json:"originalUrl"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// EventType returns the type of the event.
func (e OfferCreatedEvent) EventType() string {
	return "offer.created"
}
