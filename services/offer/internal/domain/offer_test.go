package domain

import (
	"testing"
	"time"
)

func TestNewOffer(t *testing.T) {
	id := "offer-123"
	userID := "user-456"
	name := "My Awesome Offer"
	originalURL := "https://example.com/offer"

	offer := NewOffer(id, userID, name, originalURL)

	if offer.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, offer.ID)
	}
	if offer.UserID != userID {
		t.Errorf("Expected UserID to be %s, but got %s", userID, offer.UserID)
	}
	if offer.Name != name {
		t.Errorf("Expected Name to be %s, but got %s", name, offer.Name)
	}
	if offer.OriginalURL != originalURL {
		t.Errorf("Expected OriginalURL to be %s, but got %s", originalURL, offer.OriginalURL)
	}
	if offer.Status != "evaluating" {
		t.Errorf("Expected Status to be 'evaluating', but got %s", offer.Status)
	}
	if time.Since(offer.CreatedAt) > time.Second {
		t.Errorf("Expected CreatedAt to be recent, but it's %s", offer.CreatedAt)
	}
	if offer.SiterankScore != nil {
		t.Errorf("Expected SiterankScore to be nil initially")
	}
}

func TestUpdateSiterankScore(t *testing.T) {
	offer := NewOffer("offer-123", "user-456", "Test Offer", "https://example.com")
	score := 85.5

	offer.UpdateSiterankScore(score)

	if offer.SiterankScore == nil {
		t.Fatal("Expected SiterankScore to be updated, but it's still nil")
	}
	if *offer.SiterankScore != score {
		t.Errorf("Expected SiterankScore to be %f, but got %f", score, *offer.SiterankScore)
	}
	if offer.Status != "optimizing" {
		t.Errorf("Expected Status to be 'optimizing' after updating score, but got %s", offer.Status)
	}
}

func TestArchive(t *testing.T) {
	offer := &Offer{Status: "optimizing"}
	offer.Archive()

	if offer.Status != "archived" {
		t.Errorf("Expected Status to be 'archived', but got %s", offer.Status)
	}
}
