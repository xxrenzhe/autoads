package domain

import (
	"time"
)

// UserRegisteredEvent represents the event when a new user signs up.
type UserRegisteredEvent struct {
	UserID       string    `json:"userId"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName,omitempty"`
	Role         string    `json:"role"`
	RegisteredAt time.Time `json:"registeredAt"`
}

// EventType returns the type of the event.
func (e UserRegisteredEvent) EventType() string {
	return "user.registered"
}
