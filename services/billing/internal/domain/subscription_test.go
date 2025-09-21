package domain

import (
	"testing"
	"time"
)

func TestNewTrialSubscription(t *testing.T) {
	id := "sub-123"
	userID := "user-456"
	planID := "pro"
	planName := "Pro Plan"
	trialDays := 14

	sub := NewTrialSubscription(id, userID, planID, planName, trialDays)

	if sub.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, sub.ID)
	}
	if sub.UserID != userID {
		t.Errorf("Expected UserID to be %s, but got %s", userID, sub.UserID)
	}
	if sub.PlanID != planID {
		t.Errorf("Expected PlanID to be %s, but got %s", planID, sub.PlanID)
	}
	if sub.PlanName != planName {
		t.Errorf("Expected PlanName to be %s, but got %s", planName, sub.PlanName)
	}
	if sub.Status != "trialing" {
		t.Errorf("Expected Status to be 'trialing', but got %s", sub.Status)
	}
	if sub.TrialEndsAt == nil {
		t.Fatal("Expected TrialEndsAt to be set, but it's nil")
	}
	if time.Until(*sub.TrialEndsAt).Hours() < float64(trialDays*24-1) {
		t.Errorf("Expected TrialEndsAt to be approximately %d days from now", trialDays)
	}
}

func TestIsTrialing(t *testing.T) {
	// Active trial
	trialEnds := time.Now().Add(24 * time.Hour)
	sub := &Subscription{Status: "trialing", TrialEndsAt: &trialEnds}
	if !sub.IsTrialing() {
		t.Errorf("Expected IsTrialing to be true for an active trial")
	}

	// Expired trial
	expiredTrialEnds := time.Now().Add(-24 * time.Hour)
	sub.TrialEndsAt = &expiredTrialEnds
	if sub.IsTrialing() {
		t.Errorf("Expected IsTrialing to be false for an expired trial")
	}

	// Active (non-trial) subscription
	sub.Status = "active"
	sub.TrialEndsAt = nil
	if sub.IsTrialing() {
		t.Errorf("Expected IsTrialing to be false for an active subscription")
	}
}

func TestActivate(t *testing.T) {
	sub := NewTrialSubscription("sub-123", "user-456", "pro", "Pro Plan", 14)
	periodEnd := time.Now().AddDate(0, 1, 0) // 1 month from now
	sub.Activate(periodEnd)

	if sub.Status != "active" {
		t.Errorf("Expected Status to be 'active', but got %s", sub.Status)
	}
	if sub.TrialEndsAt != nil {
		t.Errorf("Expected TrialEndsAt to be nil after activation")
	}
	if !sub.CurrentPeriodEnd.Equal(periodEnd) {
		t.Errorf("Expected CurrentPeriodEnd to be %s, but got %s", periodEnd, sub.CurrentPeriodEnd)
	}
}

func TestCancel(t *testing.T) {
	sub := &Subscription{Status: "active"}
	sub.Cancel()

	if sub.Status != "canceled" {
		t.Errorf("Expected Status to be 'canceled', but got %s", sub.Status)
	}
}
