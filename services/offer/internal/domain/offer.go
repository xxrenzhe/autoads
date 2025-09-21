package domain

import (
	"time"
)

// Offer represents a user's offer in the system.
type Offer struct {
	ID            string     `json:"id"`
	UserID        string     `json:"userId"`
	Name          string     `json:"name"`
	OriginalURL   string     `json:"originalUrl"`
	Status        string     `json:"status"` // "evaluating", "optimizing", "scaling", "archived"
	SiterankScore *float64   `json:"siterankScore,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// NewOffer creates a new offer with a default "evaluating" status.
func NewOffer(id, userID, name, originalURL string) *Offer {
	return &Offer{
		ID:          id,
		UserID:      userID,
		Name:        name,
		OriginalURL: originalURL,
		Status:      "evaluating",
		CreatedAt:   time.Now(),
	}
}

// UpdateSiterankScore updates the offer's Siterank score and status.
func (o *Offer) UpdateSiterankScore(score float64) {
	o.SiterankScore = &score
	o.Status = "optimizing"
}

// Archive archives the offer.
func (o *Offer) Archive() {
	o.Status = "archived"
}
