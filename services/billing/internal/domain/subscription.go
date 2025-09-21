package domain

import (
	"time"
)

// Subscription represents a user's subscription plan.
type Subscription struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	PlanID           string    `json:"planId"`
	PlanName         string    `json:"planName"`
	Status           string    `json:"status"` // "trialing", "active", "canceled"
	TrialEndsAt      *time.Time `json:"trialEndsAt,omitempty"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
	StripeCustomerID string    `json:"stripeCustomerId,omitempty"`
}

// NewTrialSubscription creates a new trial subscription for a user.
func NewTrialSubscription(id, userID, planID, planName string, trialDays int) *Subscription {
	now := time.Now()
	trialEnds := now.AddDate(0, 0, trialDays)

	return &Subscription{
		ID:               id,
		UserID:           userID,
		PlanID:           planID,
		PlanName:         planName,
		Status:           "trialing",
		TrialEndsAt:      &trialEnds,
		CurrentPeriodEnd: trialEnds,
	}
}

// IsTrialing checks if the subscription is currently in a trial period.
func (s *Subscription) IsTrialing() bool {
	return s.Status == "trialing" && s.TrialEndsAt != nil && s.TrialEndsAt.After(time.Now())
}

// Activate activates the subscription, typically after a successful payment.
func (s *Subscription) Activate(periodEnd time.Time) {
	s.Status = "active"
	s.TrialEndsAt = nil
	s.CurrentPeriodEnd = periodEnd
}

// Cancel cancels the subscription.
func (s *Subscription) Cancel() {
	s.Status = "canceled"
}
